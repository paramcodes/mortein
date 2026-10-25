import { z } from 'zod';

export const nodeKinds = [
  'webhook',
  'manual',
  'http',
  'condition',
  'google-sheets',
  'email',
] as const;

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(nodeKinds),
  title: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

export const workflowSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(120),
  status: z.enum(['draft', 'active']).default('draft'),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type Workflow = z.infer<typeof workflowSchema>;

export function validateGraph(workflow: Workflow): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  if (nodeIds.size !== workflow.nodes.length) errors.push('Step IDs must be unique.');
  if (workflow.nodes.length === 0) return ['Add at least one step to this workflow.'];

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push(`Connection ${edge.id} refers to a missing step.`);
    }
  }

  const incoming = new Set(workflow.edges.map((edge) => edge.target));
  const roots = workflow.nodes.filter((node) => !incoming.has(node.id));
  const triggers = workflow.nodes.filter(
    (node) => node.kind === 'manual' || node.kind === 'webhook',
  );
  if (triggers.length !== 1)
    errors.push('A workflow must have exactly one manual or webhook trigger.');
  if (triggers.length === 1 && !roots.some((node) => node.id === triggers[0]?.id))
    errors.push('The trigger must be the first step in the workflow.');

  const indegree = new Map(workflow.nodes.map((node) => [node.id, 0]));
  for (const edge of workflow.edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target))
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const queue = workflow.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    visited += 1;
    for (const edge of workflow.edges.filter((item) => item.source === id)) {
      const nextDegree = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, nextDegree);
      if (nextDegree === 0) queue.push(edge.target);
    }
  }
  if (visited !== workflow.nodes.length)
    errors.push('Workflow connections must not contain a cycle.');

  return errors;
}
