import type { Workflow, WorkflowNode } from '@mortein/workflow-domain/workflow';
import nodemailer from 'nodemailer';

export type CredentialValue = Record<string, string>;
export type StepResult = {
  nodeId: string;
  status: 'succeeded' | 'failed' | 'skipped';
  input?: unknown;
  output?: unknown;
  error?: string;
  duplicateRisk: boolean;
};

type RuntimeOptions = {
  readCredential: (id: string) => Promise<CredentialValue>;
  onStep: (result: StepResult) => Promise<void>;
};

function pathValue(object: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, object);
}

function interpolate(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const exact = value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (exact) return pathValue(context, exact[1] ?? '');
    return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, path: string) => {
      const result = pathValue(context, path);
      return result === undefined ? '' : String(result);
    });
  }
  if (Array.isArray(value)) return value.map((item) => interpolate(item, context));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, interpolate(item, context)]),
    );
  }
  return value;
}

function findNext(
  nodes: WorkflowNode[],
  edges: Workflow['edges'],
  startId: string,
): WorkflowNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  const queue = nodes.filter((node) => indegree.get(node.id) === 0);
  const ordered: WorkflowNode[] = [];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    ordered.push(current);
    for (const edge of edges.filter((item) => item.source === current.id)) {
      const left = (indegree.get(edge.target) ?? 1) - 1;
      indegree.set(edge.target, left);
      if (left === 0) {
        const next = byId.get(edge.target);
        if (next) queue.push(next);
      }
    }
  }
  const start = ordered.findIndex((node) => node.id === startId);
  return start < 0 ? ordered : ordered.slice(start);
}

async function executeNode(
  node: WorkflowNode,
  input: unknown,
  context: Record<string, unknown>,
  readCredential: RuntimeOptions['readCredential'],
): Promise<{ output: unknown; branch?: 'true' | 'false'; duplicateRisk: boolean }> {
  const config = interpolate(node.config, context) as Record<string, unknown>;
  if (node.kind === 'manual' || node.kind === 'webhook') {
    return { output: input ?? {}, duplicateRisk: false };
  }
  if (node.kind === 'http') {
    const url = String(config.url ?? '');
    if (!url) throw new Error('Set a request URL before running this step.');
    const method = String(config.method ?? 'GET').toUpperCase();
    const headers = (config.headers ?? {}) as Record<string, string>;
    const response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(method === 'GET' || method === 'HEAD'
        ? {}
        : { body: JSON.stringify(config.body ?? input ?? {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* Keep plain text response bodies readable. */
    }
    if (!response.ok)
      throw new Error(`Request failed with ${response.status}: ${String(text).slice(0, 500)}`);
    return {
      output: { status: response.status, headers: Object.fromEntries(response.headers), body },
      duplicateRisk: method !== 'GET' && method !== 'HEAD',
    };
  }
  if (node.kind === 'condition') {
    const actual = pathValue(context, String(config.path ?? ''));
    const expectedRaw = config.value;
    const expected = expectedRaw === 'true' ? true : expectedRaw === 'false' ? false : expectedRaw;
    const operator = String(config.operator ?? 'equals');
    const branch =
      operator === 'contains'
        ? String(actual ?? '').includes(String(expected ?? ''))
        : operator === 'exists'
          ? actual !== undefined && actual !== null
          : operator === 'not-equals'
            ? actual !== expected
            : actual === expected;
    return {
      output: { matched: branch, value: actual },
      branch: branch ? 'true' : 'false',
      duplicateRisk: false,
    };
  }
  if (node.kind === 'google-sheets') {
    const id = String(config.credentialId ?? '');
    const credential = await readCredential(id);
    const spreadsheetId = String(config.spreadsheetId ?? '');
    const range = String(config.range ?? 'Sheet1!A:Z');
    if (!spreadsheetId) throw new Error('Add the Google spreadsheet ID.');
    const token = await refreshGoogleToken(credential);
    const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const values = Array.isArray(config.values)
      ? config.values
      : [Object.values((input ?? {}) as object)];
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ values }),
      signal: AbortSignal.timeout(20_000),
    });
    const output = (await response.json()) as Record<string, unknown>;
    if (!response.ok)
      throw new Error(String(output.error ?? `Google Sheets returned ${response.status}.`));
    return { output, duplicateRisk: true };
  }
  if (node.kind === 'email') {
    const credential = await readCredential(String(config.credentialId ?? ''));
    const transporter = nodemailer.createTransport({
      host: credential.host,
      port: Number(credential.port || 587),
      secure: credential.secure === 'true',
      auth: { user: credential.user, pass: credential.password },
      connectionTimeout: 15_000,
    });
    const info = await transporter.sendMail({
      from: String(config.from ?? credential.from ?? credential.user ?? ''),
      to: String(config.to ?? ''),
      subject: String(config.subject ?? 'Workflow notification'),
      text: String(config.text ?? JSON.stringify(input, null, 2)),
    });
    return { output: { messageId: info.messageId, accepted: info.accepted }, duplicateRisk: true };
  }
  throw new Error(`The ${node.kind} step is not supported by this runtime.`);
}

async function refreshGoogleToken(credential: CredentialValue): Promise<string> {
  if (credential.accessToken && Number(credential.expiresAt ?? 0) > Date.now() + 60_000) {
    return credential.accessToken;
  }
  if (
    !credential.refreshToken ||
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET
  ) {
    throw new Error('Reconnect Google Sheets in workspace credentials.');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: credential.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!response.ok || !data.access_token)
    throw new Error(data.error ?? 'Google token refresh failed.');
  return data.access_token;
}

export async function executeWorkflow(
  workflow: Workflow,
  triggerData: unknown,
  options: RuntimeOptions,
): Promise<void> {
  const start = workflow.nodes.find((node) => node.kind === 'manual' || node.kind === 'webhook');
  if (!start) throw new Error('This workflow has no trigger.');
  const ordered = findNext(workflow.nodes, workflow.edges, start.id);
  const values = new Map<string, unknown>();
  const branches = new Map<string, 'true' | 'false'>();
  const skipped = new Set<string>();
  for (const node of ordered) {
    const parentEdges = workflow.edges.filter((edge) => edge.target === node.id);
    const activeParent = parentEdges.some((edge) => {
      if (skipped.has(edge.source)) return false;
      const parent = workflow.nodes.find((item) => item.id === edge.source);
      return (
        parent?.kind !== 'condition' ||
        !edge.sourceHandle ||
        edge.sourceHandle === branches.get(edge.source)
      );
    });
    if (node.id !== start.id && (parentEdges.length === 0 || !activeParent)) {
      skipped.add(node.id);
      await options.onStep({ nodeId: node.id, status: 'skipped', duplicateRisk: false });
      continue;
    }
    const inputEdge = parentEdges.find((edge) => !skipped.has(edge.source));
    const input = inputEdge ? values.get(inputEdge.source) : triggerData;
    const context = { steps: Object.fromEntries(values), trigger: triggerData };
    try {
      const result = await executeNode(node, input, context, options.readCredential);
      values.set(node.id, result.output);
      if (result.branch) branches.set(node.id, result.branch);
      await options.onStep({
        nodeId: node.id,
        status: 'succeeded',
        input,
        output: result.output,
        duplicateRisk: result.duplicateRisk,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Step failed.';
      await options.onStep({
        nodeId: node.id,
        status: 'failed',
        input,
        error: message,
        duplicateRisk:
          node.kind === 'http' || node.kind === 'email' || node.kind === 'google-sheets',
      });
      throw new Error(`${node.title}: ${message}`);
    }
  }
}
