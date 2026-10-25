import { db } from '@mortein/database/client';
import { repository } from '@mortein/database/repository';
import { credentials } from '@mortein/database/schema';
import { decryptCredential } from '@mortein/integrations/crypto';
import { executeWorkflow, type StepResult } from '@mortein/integrations/runtime';
import { workflowSchema } from '@mortein/workflow-domain/workflow';
import { and, eq } from 'drizzle-orm';
import { PgBoss } from 'pg-boss';

const boss = new PgBoss(process.env.DATABASE_URL ?? '');
await boss.start();
await boss.createQueue('workflow-run');

await boss.work<{
  executionId: string;
  workflowId: string;
  workspaceId: string;
  triggerData: unknown;
}>('workflow-run', { localConcurrency: 4 }, async (jobs) => {
  const job = jobs[0];
  if (!job) return;
  const { executionId, workflowId, workspaceId, triggerData } = job.data;
  await repository.updateExecution(executionId, { status: 'running' });
  const [record] = await repository.getWorkflow(workspaceId, workflowId);
  if (!record) {
    await repository.updateExecution(executionId, {
      status: 'failed',
      finishedAt: new Date(),
      steps: [
        {
          nodeId: 'workflow',
          status: 'failed',
          error: 'Workflow not found.',
          duplicateRisk: false,
        },
      ],
    });
    return;
  }
  const parsed = workflowSchema.safeParse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
  if (!parsed.success) {
    await repository.updateExecution(executionId, {
      status: 'failed',
      finishedAt: new Date(),
      steps: [
        {
          nodeId: 'workflow',
          status: 'failed',
          error: 'Workflow data is invalid.',
          duplicateRisk: false,
        },
      ],
    });
    return;
  }
  const stepResults: StepResult[] = [];
  let duplicateRisk = false;
  try {
    await executeWorkflow(parsed.data, triggerData, {
      readCredential: async (credentialId) => {
        const [credential] = await db
          .select()
          .from(credentials)
          .where(
            // Workspace scope prevents one client's flow from reading another client's credential.
            and(eq(credentials.id, credentialId), eq(credentials.workspaceId, workspaceId)),
          )
          .limit(1);
        if (!credential || credential.workspaceId !== workspaceId)
          throw new Error('Credential not found in this workspace.');
        return decryptCredential<Record<string, string>>(credential.encryptedData);
      },
      onStep: async (result) => {
        stepResults.push(result);
        duplicateRisk ||= result.duplicateRisk;
        await repository.updateExecution(executionId, { steps: [...stepResults], duplicateRisk });
      },
    });
    await repository.updateExecution(executionId, {
      status: 'succeeded',
      steps: stepResults,
      duplicateRisk,
      finishedAt: new Date(),
    });
  } catch (error) {
    await repository.updateExecution(executionId, {
      status: 'failed',
      steps: stepResults,
      duplicateRisk,
      finishedAt: new Date(),
    });
    throw error;
  }
});

console.log('Workflow worker is listening.');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await boss.stop({ graceful: true, timeout: 10_000 });
    process.exit(0);
  });
}
