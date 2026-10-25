import cors from '@fastify/cors';
import { repository } from '@mortein/database/repository';
import { encryptCredential } from '@mortein/integrations/crypto';
import { validateGraph, workflowSchema } from '@mortein/workflow-domain/workflow';
import Fastify, { type FastifyReply } from 'fastify';
import { PgBoss } from 'pg-boss';
import { z } from 'zod';

const app = Fastify({ logger: true, bodyLimit: 1_000_000 });
const appOrigin = process.env.PUBLIC_APP_URL ?? 'http://localhost:5173';
const boss = new PgBoss(process.env.DATABASE_URL ?? '');
const oauthStates = new Map<string, string>();

await app.register(cors, { origin: appOrigin, credentials: true });
await boss.start();
await boss.createQueue('workflow-run');

const workspaceQuery = z.object({ workspaceId: z.string().uuid() });
const workflowInput = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
});
const credentialInput = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  kind: z.enum(['smtp']),
  data: z.record(z.string(), z.string()),
});

function badRequest(reply: FastifyReply, error: unknown) {
  return reply
    .code(400)
    .send({ error: error instanceof Error ? error.message : 'Invalid request.' });
}

async function queueExecution(
  workflowId: string,
  workspaceId: string,
  trigger: 'manual' | 'webhook',
  triggerData: unknown,
) {
  const [workflow] = await repository.getWorkflow(workspaceId, workflowId);
  if (!workflow) throw new Error('Workflow not found.');
  if (trigger === 'webhook' && workflow.status !== 'active')
    throw new Error('Activate the workflow first.');
  const parsed = workflowSchema.safeParse({
    ...workflow,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  });
  if (!parsed.success) throw new Error('Workflow data is invalid.');
  const graphErrors = validateGraph(parsed.data);
  if (graphErrors.length) throw new Error(graphErrors.join(' '));
  const id = crypto.randomUUID();
  await repository.createExecution({
    id,
    workflowId,
    workspaceId,
    trigger,
    status: 'queued',
    steps: parsed.data.nodes.map((node) => ({
      nodeId: node.id,
      status: 'pending',
      duplicateRisk: false,
    })),
  });
  await boss.send('workflow-run', { executionId: id, workflowId, workspaceId, triggerData });
  return id;
}

app.get('/api/health', async () => ({ status: 'ok' }));

app.get('/api/workspaces', async (_request, reply) => {
  try {
    return await repository.listWorkspaces();
  } catch (error) {
    return badRequest(reply, error);
  }
});

app.post<{ Body: { name: string } }>('/api/workspaces', async (request, reply) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(request.body);
  if (!parsed.success) return badRequest(reply, parsed.error);
  const [workspace] = await repository.createWorkspace(parsed.data.name);
  return reply.code(201).send(workspace);
});

app.get<{ Querystring: { workspaceId: string } }>('/api/workflows', async (request, reply) => {
  const parsed = workspaceQuery.safeParse(request.query);
  if (!parsed.success) return badRequest(reply, parsed.error);
  return repository.listWorkflows(parsed.data.workspaceId);
});

app.get<{ Querystring: { workspaceId: string } }>('/api/workflows/:id', async (request, reply) => {
  const parsed = workspaceQuery.safeParse(request.query);
  if (!parsed.success) return badRequest(reply, parsed.error);
  const [workflow] = await repository.getWorkflow(
    parsed.data.workspaceId,
    (request.params as { id: string }).id,
  );
  return workflow ?? reply.code(404).send({ error: 'Workflow not found.' });
});

app.post<{ Body: unknown }>('/api/workflows', async (request, reply) => {
  const parsed = workflowInput.safeParse(request.body);
  if (!parsed.success) return badRequest(reply, parsed.error);
  const now = new Date();
  const [workflow] = await repository.createWorkflow({
    workspaceId: parsed.data.workspaceId,
    name: parsed.data.name,
    nodes: parsed.data.nodes,
    edges: parsed.data.edges,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  });
  return reply.code(201).send(workflow);
});

app.put<{ Params: { id: string }; Body: unknown }>('/api/workflows/:id', async (request, reply) => {
  const parsed = workflowInput.safeParse(request.body);
  if (!parsed.success) return badRequest(reply, parsed.error);
  const [workflow] = await repository.updateWorkflow(parsed.data.workspaceId, request.params.id, {
    name: parsed.data.name,
    nodes: parsed.data.nodes,
    edges: parsed.data.edges,
    updatedAt: new Date(),
  });
  return workflow ?? reply.code(404).send({ error: 'Workflow not found in this workspace.' });
});

app.delete<{ Params: { id: string }; Querystring: { workspaceId: string } }>(
  '/api/workflows/:id',
  async (request, reply) => {
    const parsed = workspaceQuery.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);
    const [deleted] = await repository.deleteWorkflow(parsed.data.workspaceId, request.params.id);
    return deleted ? { deleted: true } : reply.code(404).send({ error: 'Workflow not found.' });
  },
);

app.post<{ Params: { id: string }; Body: { workspaceId: string; active: boolean } }>(
  '/api/workflows/:id/activation',
  async (request, reply) => {
    const parsed = z
      .object({ workspaceId: z.string().uuid(), active: z.boolean() })
      .safeParse(request.body);
    if (!parsed.success) return badRequest(reply, parsed.error);
    const [workflow] = await repository.getWorkflow(parsed.data.workspaceId, request.params.id);
    if (!workflow) return reply.code(404).send({ error: 'Workflow not found.' });
    if (parsed.data.active) {
      const parsedWorkflow = workflowSchema.safeParse({
        ...workflow,
        createdAt: workflow.createdAt.toISOString(),
        updatedAt: workflow.updatedAt.toISOString(),
      });
      if (!parsedWorkflow.success) return badRequest(reply, new Error('Workflow data is invalid.'));
      const errors = validateGraph(parsedWorkflow.data);
      if (errors.length) return badRequest(reply, new Error(errors.join(' ')));
    }
    const changed = await repository.updateWorkflow(parsed.data.workspaceId, request.params.id, {
      status: parsed.data.active ? 'active' : 'draft',
    });
    return changed[0];
  },
);

app.post<{ Params: { id: string }; Body: { workspaceId: string; data?: unknown } }>(
  '/api/workflows/:id/runs',
  async (request, reply) => {
    const parsed = z
      .object({ workspaceId: z.string().uuid(), data: z.unknown().optional() })
      .safeParse(request.body);
    if (!parsed.success) return badRequest(reply, parsed.error);
    const id = await queueExecution(
      request.params.id,
      parsed.data.workspaceId,
      'manual',
      parsed.data.data ?? {},
    );
    return reply.code(202).send({ id });
  },
);

app.get<{ Querystring: { workspaceId: string; workflowId?: string } }>(
  '/api/executions',
  async (request, reply) => {
    const parsed = z
      .object({ workspaceId: z.string().uuid(), workflowId: z.string().uuid().optional() })
      .safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);
    return repository.listExecutions(parsed.data.workspaceId, parsed.data.workflowId);
  },
);

app.get<{ Params: { id: string }; Querystring: { workspaceId: string } }>(
  '/api/executions/:id',
  async (request, reply) => {
    const parsed = workspaceQuery.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);
    const [execution] = await repository.getExecution(parsed.data.workspaceId, request.params.id);
    return execution ?? reply.code(404).send({ error: 'Execution not found.' });
  },
);

app.get<{ Querystring: { workspaceId: string } }>('/api/credentials', async (request, reply) => {
  const parsed = workspaceQuery.safeParse(request.query);
  if (!parsed.success) return badRequest(reply, parsed.error);
  return repository.listCredentials(parsed.data.workspaceId);
});

app.post<{ Body: unknown }>('/api/credentials', async (request, reply) => {
  const parsed = credentialInput.safeParse(request.body);
  if (!parsed.success) return badRequest(reply, parsed.error);
  const [credential] = await repository.createCredential({
    workspaceId: parsed.data.workspaceId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    encryptedData: encryptCredential(parsed.data.data),
  });
  if (!credential) return reply.code(500).send({ error: 'Credential could not be saved.' });
  return reply.code(201).send({ id: credential.id, name: credential.name, kind: credential.kind });
});

app.delete<{ Params: { id: string }; Querystring: { workspaceId: string } }>(
  '/api/credentials/:id',
  async (request, reply) => {
    const parsed = workspaceQuery.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);
    const [deleted] = await repository.deleteCredential(parsed.data.workspaceId, request.params.id);
    return deleted ? { deleted: true } : reply.code(404).send({ error: 'Credential not found.' });
  },
);

app.get<{ Params: { workspaceId: string } }>(
  '/api/google/connect/:workspaceId',
  async (request, reply) => {
    const workspaceId = request.params.workspaceId;
    if (!z.string().uuid().safeParse(workspaceId).success)
      return reply.code(400).send({ error: 'Invalid workspace.' });
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return reply
        .code(503)
        .send({ error: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to connect Google Sheets.' });
    }
    const state = crypto.randomUUID();
    oauthStates.set(state, workspaceId);
    const redirectUri = `${appOrigin}/api/google/callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      state,
    }).toString();
    return reply.redirect(url.toString());
  },
);

app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
  '/api/google/callback',
  async (request, reply) => {
    const { code, state, error } = request.query;
    if (error) return reply.redirect(`${appOrigin}/app?notice=google-denied`);
    if (!code || !state || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return reply.code(400).send({ error: 'Google authorization could not be completed.' });
    }
    const workspaceId = oauthStates.get(state);
    oauthStates.delete(state);
    if (!workspaceId)
      return reply.code(400).send({ error: 'Google authorization state expired. Try again.' });
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${appOrigin}/api/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const token = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!tokenResponse.ok || !token.access_token)
      return reply.code(400).send({ error: token.error ?? 'Google token exchange failed.' });
    await repository.createCredential({
      workspaceId,
      name: 'Google Sheets',
      kind: 'google-sheets',
      encryptedData: encryptCredential({
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? '',
        expiresAt: String(Date.now() + (token.expires_in ?? 3600) * 1000),
      }),
    });
    return reply.redirect(`${appOrigin}/app?notice=google-connected`);
  },
);

app.post<{ Params: { id: string } }>('/webhooks/:id', async (request, reply) => {
  const workspaces = await repository.listWorkspaces();
  for (const workspace of workspaces) {
    const [workflow] = await repository.getWorkflow(workspace.id, request.params.id);
    if (
      workflow?.status === 'active' &&
      Array.isArray(workflow.nodes) &&
      (workflow.nodes as Array<{ kind?: string }>).some((node) => node.kind === 'webhook')
    ) {
      const id = await queueExecution(workflow.id, workspace.id, 'webhook', request.body ?? {});
      return reply.code(202).send({ id, accepted: true });
    }
  }
  return reply.code(404).send({ error: 'Active webhook workflow not found.' });
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  return reply.code(500).send({ error: 'The request could not be completed.' });
});

const port = Number(process.env.PORT ?? 4310);
await app.listen({ port, host: '0.0.0.0' });
app.log.info(`Mortein API listening on ${port}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await boss.stop({ graceful: true, timeout: 10_000 });
    process.exit(0);
  });
}
