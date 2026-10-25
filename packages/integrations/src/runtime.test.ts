import { afterEach, expect, test } from 'bun:test';
import type { Workflow } from '@mortein/workflow-domain/workflow';
import { executeWorkflow } from './runtime';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('conditions route data and step outputs remain addressable by expressions', async () => {
  const requests: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ id: 42 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  const workflow = {
    id: 'workflow-1',
    workspaceId: 'workspace-1',
    name: 'Branch check',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      { id: 'trigger', kind: 'manual', title: 'Start', position: { x: 0, y: 0 }, config: {} },
      {
        id: 'condition',
        kind: 'condition',
        title: 'Has email',
        position: { x: 1, y: 0 },
        config: { path: 'steps.trigger.email', operator: 'exists', value: '' },
      },
      {
        id: 'yes',
        kind: 'http',
        title: 'Fetch accepted',
        position: { x: 2, y: 0 },
        config: { method: 'GET', url: 'https://example.test/accepted/{{steps.trigger.email}}' },
      },
      {
        id: 'no',
        kind: 'http',
        title: 'Fetch rejected',
        position: { x: 2, y: 1 },
        config: { method: 'GET', url: 'https://example.test/rejected' },
      },
    ],
    edges: [
      { id: 'a', source: 'trigger', target: 'condition' },
      { id: 'b', source: 'condition', sourceHandle: 'true', target: 'yes' },
      { id: 'c', source: 'condition', sourceHandle: 'false', target: 'no' },
    ],
  } satisfies Workflow;
  const steps: Array<{ nodeId: string; status: string; output?: unknown }> = [];

  await executeWorkflow(
    workflow,
    { email: 'avery@example.com' },
    {
      readCredential: async () => ({}),
      onStep: async (step) => {
        steps.push(step);
      },
    },
  );

  expect(requests).toEqual(['https://example.test/accepted/avery@example.com']);
  expect(steps.map(({ nodeId, status }) => [nodeId, status])).toEqual([
    ['trigger', 'succeeded'],
    ['condition', 'succeeded'],
    ['yes', 'succeeded'],
    ['no', 'skipped'],
  ]);
  expect(steps[2]?.output).toEqual({ status: 200, headers: expect.any(Object), body: { id: 42 } });
});
