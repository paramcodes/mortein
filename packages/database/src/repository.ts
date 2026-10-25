import { and, desc, eq } from 'drizzle-orm';
import { db } from './client';
import { credentials, executions, workflows, workspaces } from './schema';

export const repository = {
  listWorkspaces: () => db.select().from(workspaces).orderBy(workspaces.createdAt),
  createWorkspace: (name: string) => db.insert(workspaces).values({ name }).returning(),
  listWorkflows: (workspaceId: string) =>
    db
      .select()
      .from(workflows)
      .where(eq(workflows.workspaceId, workspaceId))
      .orderBy(desc(workflows.updatedAt)),
  getWorkflow: (workspaceId: string, id: string) =>
    db
      .select()
      .from(workflows)
      .where(and(eq(workflows.workspaceId, workspaceId), eq(workflows.id, id)))
      .limit(1),
  createWorkflow: (values: typeof workflows.$inferInsert) =>
    db.insert(workflows).values(values).returning(),
  updateWorkflow: (
    workspaceId: string,
    id: string,
    values: Partial<typeof workflows.$inferInsert>,
  ) =>
    db
      .update(workflows)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(workflows.workspaceId, workspaceId), eq(workflows.id, id)))
      .returning(),
  deleteWorkflow: (workspaceId: string, id: string) =>
    db
      .delete(workflows)
      .where(and(eq(workflows.workspaceId, workspaceId), eq(workflows.id, id)))
      .returning(),
  listExecutions: (workspaceId: string, workflowId?: string) =>
    db
      .select()
      .from(executions)
      .where(
        workflowId
          ? and(eq(executions.workspaceId, workspaceId), eq(executions.workflowId, workflowId))
          : eq(executions.workspaceId, workspaceId),
      )
      .orderBy(desc(executions.startedAt))
      .limit(100),
  getExecution: (workspaceId: string, id: string) =>
    db
      .select()
      .from(executions)
      .where(and(eq(executions.workspaceId, workspaceId), eq(executions.id, id)))
      .limit(1),
  createExecution: (values: typeof executions.$inferInsert) =>
    db.insert(executions).values(values).returning(),
  updateExecution: (id: string, values: Partial<typeof executions.$inferInsert>) =>
    db.update(executions).set(values).where(eq(executions.id, id)).returning(),
  listCredentials: (workspaceId: string) =>
    db
      .select({
        id: credentials.id,
        name: credentials.name,
        kind: credentials.kind,
        createdAt: credentials.createdAt,
      })
      .from(credentials)
      .where(eq(credentials.workspaceId, workspaceId))
      .orderBy(credentials.name),
  getCredential: (workspaceId: string, id: string) =>
    db
      .select()
      .from(credentials)
      .where(and(eq(credentials.workspaceId, workspaceId), eq(credentials.id, id)))
      .limit(1),
  createCredential: (values: typeof credentials.$inferInsert) =>
    db.insert(credentials).values(values).returning(),
  deleteCredential: (workspaceId: string, id: string) =>
    db
      .delete(credentials)
      .where(and(eq(credentials.workspaceId, workspaceId), eq(credentials.id, id)))
      .returning(),
};
