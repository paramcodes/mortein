# MVP delivery plan

## Goal

Deliver a workflow automation MVP where a user can create a workflow, run it with sample or live data, inspect every step, and activate a trigger for repeated runs.

## Assumptions

- The product is a greenfield web application.
- The first users are automation consultants and technical operators at small teams.
- The first release is a single-user, self-hostable application. The user can create isolated workspaces for each client, but team permissions are deferred.
- The first integration surface is manual and webhook triggers, HTTP request, condition, Google Sheets append, and generic SMTP email actions.
- The product uses its own design and branding while taking workflow concepts from n8n.
- PostgreSQL stores workflows and execution history. A separate worker consumes a durable PostgreSQL-backed queue through `pg-boss` for the initial deployment.
- Workflow delivery is at least once, with bounded retries, execution timeouts, and visible run history. The UI must make duplicate-risk clear when an external action may have completed before a failure.
- Bun is the runtime, package manager, and workspace tool for the TypeScript monorepo.
- The product includes a searchable, first-party wiki. Wiki pages are Markdown files maintained with the codebase.
- Biome handles linting and formatting across the TypeScript workspaces.
- The public landing page is a route in the existing web app, not a separate site.

## Stage 1: Validate the product slice

**Outcome:** choose a first user, workflow, and deployment model that make the MVP concrete.

**Work:**

- Interview automation consultants and technical operators or review their observed automation tasks.
- Select one end-to-end workflow to support: webhook → HTTP request → condition → Google Sheets append → email → inspect result.
- Confirm that a single-user, self-hostable first release with isolated client workspaces fits the selected users.
- Write acceptance criteria for creating, testing, activating, and diagnosing that workflow.

**Acceptance:** the team can name the target user, first workflow, launch environment, and the user-visible success condition.

## Stage 2: Establish the domain and architecture

**Outcome:** define contracts before building the canvas and runtime independently.

**Work:**

- Define workflow, node, connection, credential reference, trigger, and execution data shapes.
- Define workflow draft versus active version behavior.
- Use PostgreSQL for persistence and `pg-boss` for the durable worker queue in the first deployment.
- Define at-least-once delivery, bounded retry, timeout, and idempotency behavior. Do not promise exactly-once execution across external services.
- Define credential encryption and access boundaries before integrating external services.
- Set up TypeScript strictness, Biome linting and formatting, type checking, and a reproducible local boot path.

**Acceptance:** the chosen workflow can be represented without ambiguous node types or implicit execution semantics. A local development environment boots from documented commands.

## Stage 3: Build the editor shell

**Outcome:** users can create and save a visual workflow draft.

**Work:**

- Build the navigation, workflow header, canvas, node picker, and contextual inspector.
- Use React Flow with custom node and edge visuals.
- Configure shadcn/ui with Base UI for accessible primitives.
- Add draft persistence and restore the canvas after reload.
- Add keyboard focus, selection, basic shortcuts, and responsive inspector behavior.

**Acceptance:** a user can add, move, connect, configure, save, reload, and delete supported nodes without losing the workflow.

## Stage 4: Add the first execution path

**Outcome:** users can run a saved workflow and understand its result.

**Work:**

- Implement manual execution for the selected vertical slice: HTTP request, condition, Google Sheets append, and SMTP email action.
- Pass typed output between nodes and validate node inputs at the execution boundary.
- Store execution status, timestamps, node-level inputs and outputs, and failure details.
- Show progress and results in the editor without blocking the canvas.
- Add bounded retries and idempotency support where the integration allows it. Mark steps that may have completed before a failure.

**Acceptance:** a successful run shows each node's result. A failed run identifies the failing node, provides its error, and preserves inspectable prior outputs.

## Stage 5: Add credentials and useful triggers

**Outcome:** users can connect an external service and start workflows automatically.

**Work:**

- Add encrypted credential storage and a reusable credential reference in node configuration.
- Connect Google Sheets through OAuth and implement row append as the first named SaaS action. Google’s API supports appending values to a spreadsheet range.
- Add workspace ownership to workflows, credentials, and execution history so each consultant can keep client data separate.
- Implement manual and webhook triggers. Defer schedule triggers until user research confirms the need.
- Add activation controls that clearly separate saved drafts from active behavior.
- Add request validation and webhook authentication or signing appropriate for self-hosted deployments.

**Acceptance:** a configured workflow can be activated and triggered as documented. Secrets do not appear in workflow exports or execution output.

## Stage 6: Polish, harden, and release the MVP

**Outcome:** users can recover from common mistakes and operate the first release safely.

**Work:**

- Add run history, empty states, loading feedback, and actionable error messages.
- Add a public landing page that explains the product and directs users to setup.
- Add a first-party wiki with guides for building, running, and troubleshooting workflows. Render Markdown in the web app and add client-side search.
- Review keyboard access, focus, touch targets, contrast, and reduced-motion behavior.
- Add rate limits, execution time limits, retry limits, and data retention rules appropriate to the hosting model.
- Exercise the whole workflow in a browser from creation through failure diagnosis.
- Document deployment, backups, environment variables, and credential key recovery.

**Acceptance:** the primary workflow completes from a clean account. The same flow handles invalid configuration and a failed external request with clear recovery steps. The public landing page has a working setup action. A user can find and read the relevant wiki page from the app.

## Deferred after MVP

- Large integration catalog and community node marketplace.
- Custom code execution and arbitrary packages.
- Collaborative editing, role-based access control, and enterprise SSO.
- Nested workflows, complex branching, and visual loop builders.
- AI agent builder and managed hosting tiers.
- Advanced analytics and high-volume distributed execution.

## Decisions to record

Revisit workspace sharing and a distributed queue after observing usage. Add dark mode only after MVP feedback supports the work.
