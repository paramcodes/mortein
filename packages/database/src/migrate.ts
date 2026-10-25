import { sql } from './client';

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS workflows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
    edges jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    kind text NOT NULL,
    encrypted_data text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'queued',
    trigger text NOT NULL,
    steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    duplicate_risk boolean NOT NULL DEFAULT false
  );
  CREATE INDEX IF NOT EXISTS workflows_workspace_idx ON workflows(workspace_id);
  CREATE INDEX IF NOT EXISTS executions_workspace_idx ON executions(workspace_id, started_at DESC);
  CREATE INDEX IF NOT EXISTS credentials_workspace_idx ON credentials(workspace_id);
`);

const existing = await sql`SELECT id FROM workspaces LIMIT 1`;
if (existing.length === 0) {
  await sql`INSERT INTO workspaces (name) VALUES ('My workspace')`;
}

console.log('Database schema is ready.');
await sql.end();
