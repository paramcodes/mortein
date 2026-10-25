import { z } from 'zod';

export const executionStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);

export const stepStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']);

export const executionStepSchema = z.object({
  nodeId: z.string(),
  status: stepStatusSchema,
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  duplicateRisk: z.boolean().default(false),
});

export const executionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workspaceId: z.string(),
  status: executionStatusSchema,
  trigger: z.enum(['manual', 'webhook']),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  steps: z.array(executionStepSchema),
});

export type Execution = z.infer<typeof executionSchema>;
export type ExecutionStep = z.infer<typeof executionStepSchema>;
