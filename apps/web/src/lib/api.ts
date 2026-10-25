export type Workspace = { id: string; name: string };
export type ApiWorkflow = {
  id: string;
  workspaceId: string;
  name: string;
  status: 'draft' | 'active';
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  createdAt: string | Date;
  updatedAt: string | Date;
};
export type ApiExecution = {
  id: string;
  workflowId: string;
  workspaceId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  trigger: 'manual' | 'webhook';
  startedAt: string | Date;
  finishedAt?: string | Date | null;
  steps: Array<{
    nodeId: string;
    status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
    input?: unknown;
    output?: unknown;
    error?: string;
    duplicateRisk: boolean;
  }>;
  duplicateRisk: boolean;
};
export type ApiCredential = { id: string; name: string; kind: 'google-sheets' | 'smtp' };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed with ${response.status}.`);
  return body;
}

export function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}
