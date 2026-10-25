# Architecture

## Runtime pieces

- **Web app (`apps/web`)** serves the landing page, workflow editor, execution inspector, and Markdown wiki. Vite proxies `/api` and `/webhooks` to the API during local development.
- **API (`apps/api`)** validates requests, scopes workflow and credential access to workspaces, stores workflows, creates execution records, and enqueues runs.
- **Worker (`apps/worker`)** claims queued jobs from pg-boss, loads the workflow and workspace-scoped credentials, executes nodes, and persists each step result.
- **PostgreSQL** stores workspaces, workflows, encrypted credentials, executions, and pg-boss queue state.
- **Shared packages** hold workflow schemas/graph validation, database access, integration execution/encryption, and wiki content.

## Run lifecycle

1. A manual run is requested from the editor, or an active workflow receives a POST at `/webhooks/:workflowId`.
2. The API loads the workflow in its workspace, validates its graph, creates a queued execution, and submits a pg-boss job.
3. The worker executes the graph in topological order. It stores raw node outputs by node ID, resolves `{{steps.nodeId.path}}` expressions, follows condition handles, and records skipped nodes on inactive paths.
4. Each step update is written to the execution record. The UI polls for changes and exposes step input, output, errors, and duplicate-risk status.

Delivery is at least once: external effects such as sending email or appending a row may have happened before a worker loses its connection. The inspector reports that risk; users should make external actions idempotent when possible.

## Deliberate MVP limits

The editor and API are single-user and do not provide login, role-based access, or team collaboration. Webhook URLs are bearer secrets and the sample deployment is for local development. The first node set is manual/webhook, HTTP, condition, Google Sheets append, and SMTP email. See [SECURITY.md](SECURITY.md) before exposing an instance.
