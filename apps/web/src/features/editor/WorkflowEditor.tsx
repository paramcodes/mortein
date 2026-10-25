import { Dialog } from '@base-ui/react/dialog';
import { Link } from '@tanstack/react-router';
import {
  addEdge,
  Background,
  type Connection,
  Controls,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import '@xyflow/react/dist/style.css';
import type {
  WorkflowEdge,
  Workflow as WorkflowModel,
  WorkflowNode,
} from '@mortein/workflow-domain/workflow';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Code2,
  Copy,
  Ellipsis,
  FileJson2,
  Filter,
  Globe2,
  History,
  KeyRound,
  Mail,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Webhook,
  Workflow,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type ApiCredential,
  type ApiExecution,
  type ApiWorkflow,
  api,
  json,
  type Workspace,
} from '../../lib/api';

type CanvasKind = WorkflowNode['kind'];
type NodeData = {
  title: string;
  kind: CanvasKind;
  config: Record<string, unknown>;
  runStatus?: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
};
type CanvasNode = Node<NodeData>;

const kindInfo: Record<
  CanvasKind,
  { title: string; eyebrow: string; description: string; icon: typeof Webhook; tone: string }
> = {
  webhook: {
    title: 'Webhook',
    eyebrow: 'Trigger',
    description: 'Starts when a request arrives',
    icon: Webhook,
    tone: 'violet',
  },
  manual: {
    title: 'Manual trigger',
    eyebrow: 'Trigger',
    description: 'Start a run yourself',
    icon: Play,
    tone: 'violet',
  },
  http: {
    title: 'HTTP request',
    eyebrow: 'Request',
    description: 'Send data to an API',
    icon: Globe2,
    tone: 'blue',
  },
  condition: {
    title: 'Condition',
    eyebrow: 'Logic',
    description: 'Choose a path based on data',
    icon: Filter,
    tone: 'amber',
  },
  'google-sheets': {
    title: 'Google Sheets',
    eyebrow: 'Action',
    description: 'Add a row to a spreadsheet',
    icon: FileJson2,
    tone: 'green',
  },
  email: {
    title: 'Send email',
    eyebrow: 'Action',
    description: 'Send a message with SMTP',
    icon: Mail,
    tone: 'orange',
  },
};

const starterNodes: CanvasNode[] = [
  {
    id: 'incoming',
    type: 'workflowNode',
    position: { x: 90, y: 238 },
    data: { title: 'New lead arrives', kind: 'webhook', config: {} },
  },
  {
    id: 'lookup',
    type: 'workflowNode',
    position: { x: 360, y: 238 },
    data: {
      title: 'Look up the lead',
      kind: 'http',
      config: {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/todos/1',
        headers: {},
        body: '',
      },
    },
  },
  {
    id: 'qualified',
    type: 'workflowNode',
    position: { x: 640, y: 238 },
    data: {
      title: 'Is this qualified?',
      kind: 'condition',
      config: { path: 'steps.lookup.body.completed', operator: 'equals', value: 'true' },
    },
  },
  {
    id: 'add-to-sheet',
    type: 'workflowNode',
    position: { x: 930, y: 124 },
    data: {
      title: 'Add to pipeline',
      kind: 'google-sheets',
      config: {
        credentialId: '',
        spreadsheetId: '',
        range: 'Leads!A:D',
        values: [
          [
            '{{steps.lookup.body.id}}',
            '{{steps.lookup.body.title}}',
            '{{trigger.email}}',
            'Qualified',
          ],
        ],
      },
    },
  },
  {
    id: 'notify',
    type: 'workflowNode',
    position: { x: 930, y: 390 },
    data: {
      title: 'Send notification',
      kind: 'email',
      config: {
        credentialId: '',
        to: '{{trigger.email}}',
        subject: 'Your lead is ready',
        text: 'A qualified lead was added to the pipeline.',
      },
    },
  },
];

const starterEdges: Edge[] = [
  { id: 'e-incoming-lookup', source: 'incoming', target: 'lookup', type: 'smoothstep' },
  { id: 'e-lookup-qualified', source: 'lookup', target: 'qualified', type: 'smoothstep' },
  {
    id: 'e-qualified-sheet',
    source: 'qualified',
    sourceHandle: 'true',
    target: 'add-to-sheet',
    type: 'smoothstep',
    label: 'Yes',
  },
  { id: 'e-sheet-email', source: 'add-to-sheet', target: 'notify', type: 'smoothstep' },
  {
    id: 'e-qualified-email',
    source: 'qualified',
    sourceHandle: 'false',
    target: 'notify',
    type: 'smoothstep',
    label: 'No',
  },
];

function WorkflowNodeCard({ data, selected }: NodeProps<CanvasNode>) {
  const info = kindInfo[data.kind];
  const Icon = info.icon;
  return (
    <article
      className={`workflow-node tone-${info.tone} ${selected ? 'is-selected' : ''} ${data.runStatus ? `run-${data.runStatus}` : ''}`}
    >
      {data.kind !== 'webhook' && data.kind !== 'manual' && (
        <Handle type="target" position={Position.Left} />
      )}
      <div className="node-card-top">
        <span className="node-icon">
          <Icon size={16} />
        </span>
        <span className="node-kind">{info.eyebrow}</span>
        <button
          type="button"
          className="node-more nodrag"
          aria-label={`More options for ${data.title}`}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      <strong>{data.title}</strong>
      <span className="node-description">{info.description}</span>
      {data.kind === 'condition' && (
        <div className="condition-outputs">
          <span>
            <i className="branch-yes" /> True
          </span>
          <span>
            <i className="branch-no" /> False
          </span>
        </div>
      )}
      {data.runStatus && (
        <span className={`node-run-state ${data.runStatus}`}>
          {data.runStatus === 'succeeded' ? (
            <Check size={12} />
          ) : data.runStatus === 'failed' ? (
            <X size={12} />
          ) : (
            <span className="state-pulse" />
          )}
          {data.runStatus}
        </span>
      )}
      {data.kind === 'condition' ? (
        <>
          <Handle id="true" type="source" position={Position.Right} style={{ top: '44%' }} />
          <Handle id="false" type="source" position={Position.Right} style={{ top: '73%' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </article>
  );
}

const nodeTypes = { workflowNode: WorkflowNodeCard };

function fromApi(workflow: ApiWorkflow): { nodes: CanvasNode[]; edges: Edge[] } {
  const nodes = workflow.nodes.map((item) => {
    const node = item as unknown as WorkflowNode;
    return {
      id: node.id,
      type: 'workflowNode',
      position: node.position,
      data: { title: node.title, kind: node.kind, config: node.config ?? {} },
    } satisfies CanvasNode;
  });
  const edges = workflow.edges.map((item) => ({ ...item, type: 'smoothstep' })) as Edge[];
  return { nodes, edges };
}

function toApiNodes(nodes: CanvasNode[]): WorkflowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    kind: node.data.kind,
    title: node.data.title,
    position: node.position,
    config: node.data.config,
  }));
}

function template(workspaceId: string, id = crypto.randomUUID()) {
  return {
    workspaceId,
    name: 'Lead intake',
    nodes: toApiNodes(starterNodes),
    edges: starterEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
      ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
    })) as WorkflowEdge[],
    id,
    status: 'draft' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies WorkflowModel;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function ConfigInspector({
  node,
  credentials: savedCredentials,
  onChange,
  onOpenCredentials,
  onClose,
  onDelete,
  workflowId,
}: {
  node: CanvasNode;
  credentials: ApiCredential[];
  onChange: (patch: Partial<NodeData>) => void;
  onOpenCredentials: () => void;
  onClose: () => void;
  onDelete: () => void;
  workflowId: string;
}) {
  const config = node.data.config;
  const set = (key: string, value: unknown) => onChange({ config: { ...config, [key]: value } });
  const info = kindInfo[node.data.kind];
  const Icon = info.icon;
  const credentialKind = node.data.kind === 'email' ? 'smtp' : 'google-sheets';
  const options = savedCredentials.filter((credential) => credential.kind === credentialKind);
  const stringValue = (key: string) => String(config[key] ?? '');

  return (
    <div className="inspector-form">
      <div className="inspector-node-title">
        <span className={`node-icon tone-icon-${info.tone}`}>
          <Icon size={16} />
        </span>
        <div>
          <strong>{info.title}</strong>
          <small>{info.eyebrow} step</small>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close inspector"
        >
          <X size={16} />
        </button>
      </div>
      <Field
        label="Step name"
        value={node.data.title}
        onChange={(value) => onChange({ title: value })}
      />
      {node.data.kind === 'webhook' && (
        <div className="info-callout">
          <Webhook size={15} />
          <div>
            <strong>Webhook URL</strong>
            <code>
              {window.location.origin}/webhooks/{workflowId}
            </code>
            <small>Activate this workflow to receive requests.</small>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(
                `${window.location.origin}/webhooks/${workflowId}`,
              );
              toast.success('Webhook URL copied');
            }}
            aria-label="Copy webhook URL"
          >
            <Copy size={14} />
          </button>
        </div>
      )}
      {node.data.kind === 'manual' && (
        <p className="form-note">
          Run this workflow by hand from the toolbar. Use the test data panel to pass an example
          payload.
        </p>
      )}
      {node.data.kind === 'http' && (
        <>
          <label className="field">
            <span>Method</span>
            <select
              value={stringValue('method') || 'GET'}
              onChange={(event) => set('method', event.target.value)}
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </select>
          </label>
          <Field
            label="Request URL"
            value={stringValue('url')}
            onChange={(value) => set('url', value)}
            placeholder="https://api.example.com/leads"
          />
          <Field
            label="Headers (JSON)"
            value={JSON.stringify(config.headers ?? {}, null, 2)}
            onChange={(value) => {
              try {
                set('headers', JSON.parse(value));
              } catch {
                set('headersText', value);
              }
            }}
            multiline
            hint="Use JSON to set request headers."
          />
          <Field
            label="Body (JSON)"
            value={
              typeof config.body === 'string'
                ? stringValue('body')
                : JSON.stringify(config.body ?? {}, null, 2)
            }
            onChange={(value) => {
              try {
                set('body', JSON.parse(value));
                set('bodyText', undefined);
              } catch {
                set('bodyText', value);
              }
            }}
            multiline
            hint="Expressions like {{steps.trigger.email}} use earlier step data."
          />
        </>
      )}
      {node.data.kind === 'condition' && (
        <>
          <Field
            label="Value path"
            value={stringValue('path')}
            onChange={(value) => set('path', value)}
            placeholder="steps.request.body.status"
            hint="Start with steps. and select a value from an earlier step."
          />
          <label className="field">
            <span>Comparison</span>
            <select
              value={stringValue('operator') || 'equals'}
              onChange={(event) => set('operator', event.target.value)}
            >
              <option value="equals">Equals</option>
              <option value="not-equals">Does not equal</option>
              <option value="contains">Contains</option>
              <option value="exists">Exists</option>
            </select>
          </label>
          <Field
            label="Expected value"
            value={stringValue('value')}
            onChange={(value) => set('value', value)}
            placeholder="Qualified"
          />
          <div className="condition-help">
            <span>
              <i className="branch-yes" /> True output
            </span>
            <span>
              <i className="branch-no" /> False output
            </span>
          </div>
        </>
      )}
      {(node.data.kind === 'google-sheets' || node.data.kind === 'email') && (
        <>
          <div className="credential-picker">
            <label className="field">
              <span>Credential</span>
              <select
                value={stringValue('credentialId')}
                onChange={(event) => set('credentialId', event.target.value)}
              >
                <option value="">Choose a credential</option>
                {options.map((credential) => (
                  <option key={credential.id} value={credential.id}>
                    {credential.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="text-button" onClick={onOpenCredentials}>
              Manage
            </button>
          </div>
          {node.data.kind === 'google-sheets' && (
            <>
              <Field
                label="Spreadsheet ID"
                value={stringValue('spreadsheetId')}
                onChange={(value) => set('spreadsheetId', value)}
                placeholder="Copy the ID from the spreadsheet URL"
              />
              <Field
                label="Range"
                value={stringValue('range')}
                onChange={(value) => set('range', value)}
                placeholder="Leads!A:D"
              />
              <Field
                label="Rows (JSON)"
                value={JSON.stringify(config.values ?? [], null, 2)}
                onChange={(value) => {
                  try {
                    set('values', JSON.parse(value));
                  } catch {
                    set('valuesText', value);
                  }
                }}
                multiline
                hint="Rows can include expressions from earlier steps."
              />
            </>
          )}
          {node.data.kind === 'email' && (
            <>
              <Field
                label="To"
                value={stringValue('to')}
                onChange={(value) => set('to', value)}
                placeholder="person@example.com"
              />
              <Field
                label="Subject"
                value={stringValue('subject')}
                onChange={(value) => set('subject', value)}
                placeholder="A new qualified lead"
              />
              <Field
                label="Message"
                value={stringValue('text')}
                onChange={(value) => set('text', value)}
                placeholder="Write a message"
                multiline
              />
            </>
          )}
        </>
      )}
      <div className="inspector-bottom-note">
        <ShieldCheck size={14} />
        <span>Step data is recorded for this run.</span>
      </div>
      <button type="button" className="text-button inspector-delete" onClick={onDelete}>
        Delete step
      </button>
    </div>
  );
}

function CredentialDialog({
  open,
  onOpenChange,
  workspaceId,
  credentials,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  workspaceId: string;
  credentials: ApiCredential[];
  onUpdated: () => void;
}) {
  const [name, setName] = useState('SMTP server');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [from, setFrom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('notice') === 'google-connected') {
      toast.success('Google Sheets connected');
      onUpdated();
      window.history.replaceState({}, '', '/app');
    }
    if (new URLSearchParams(window.location.search).get('notice') === 'google-denied') {
      toast.error('Google Sheets connection was cancelled');
      window.history.replaceState({}, '', '/app');
    }
  }, [onUpdated]);

  async function saveSmtp(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(
        '/credentials',
        json('POST', {
          workspaceId,
          name,
          kind: 'smtp',
          data: { host, port, user, password, from, secure: port === '465' ? 'true' : 'false' },
        }),
      );
      toast.success('SMTP credential saved');
      onUpdated();
      setPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save credential.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Viewport className="dialog-viewport">
          <Dialog.Popup className="credential-dialog">
            <header>
              <div>
                <span className="dialog-icon">
                  <KeyRound size={17} />
                </span>
                <div>
                  <Dialog.Title className="credential-title">Workspace credentials</Dialog.Title>
                  <Dialog.Description className="credential-description">
                    Secrets are encrypted before they reach the database.
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className="icon-button" aria-label="Close">
                <X size={17} />
              </Dialog.Close>
            </header>
            <div className="credential-existing">
              <strong>Connected accounts</strong>
              {credentials.length ? (
                credentials.map((credential) => (
                  <div className="credential-row" key={credential.id}>
                    <span className={`credential-logo ${credential.kind}`}>
                      {credential.kind === 'smtp' ? <Mail size={15} /> : <FileJson2 size={15} />}
                    </span>
                    <span>
                      {credential.name}
                      <small>{credential.kind === 'smtp' ? 'SMTP server' : 'Google Sheets'}</small>
                    </span>
                    <Check size={14} className="credential-check" />
                  </div>
                ))
              ) : (
                <p>No credentials in this workspace yet.</p>
              )}
            </div>
            <div className="credential-connect">
              <strong>Connect an account</strong>
              <a className="connect-card" href={`/api/google/connect/${workspaceId}`}>
                <span className="google-mark">G</span>
                <span>
                  <b>Google Sheets</b>
                  <small>Authorize access to append spreadsheet rows</small>
                </span>
                <ArrowUpRight size={15} />
              </a>
            </div>
            <form className="smtp-form" onSubmit={(event) => void saveSmtp(event)}>
              <h3>SMTP email</h3>
              <div className="form-grid">
                <Field
                  label="Credential name"
                  value={name}
                  onChange={setName}
                  placeholder="Team email"
                />
                <Field
                  label="SMTP host"
                  value={host}
                  onChange={setHost}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="form-grid">
                <Field label="Port" value={port} onChange={setPort} placeholder="587" />
                <Field
                  label="Username"
                  value={user}
                  onChange={setUser}
                  placeholder="SMTP username"
                />
              </div>
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="SMTP password or token"
              />
              <Field
                label="From address"
                value={from}
                onChange={setFrom}
                placeholder="automation@example.com"
              />
              {error && <p className="field-error">{error}</p>}
              <button
                type="submit"
                className="button button-primary button-full"
                disabled={saving || !host || !user || !password}
              >
                {saving ? 'Saving…' : 'Save SMTP credential'} <ArrowRight size={15} />
              </button>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function WorkflowEditor() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [workflows, setWorkflows] = useState<ApiWorkflow[]>([]);
  const [workflowId, setWorkflowId] = useState('');
  const [workflowName, setWorkflowName] = useState('Lead intake');
  const [status, setStatus] = useState<'draft' | 'active'>('draft');
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(starterNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(starterEdges);
  const [selectedId, setSelectedId] = useState<string | null>('lookup');
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [executions, setExecutions] = useState<ApiExecution[]>([]);
  const [activeExecution, setActiveExecution] = useState<ApiExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [nodeSearch, setNodeSearch] = useState('');
  const [section, setSection] = useState<'builder' | 'runs'>('builder');
  const [testData, _setTestData] = useState(
    '{\n  "name": "Avery Morgan",\n  "email": "avery@example.com",\n  "source": "Website"\n}',
  );
  const pollRef = useRef<number | null>(null);

  const selectedNode = nodes.find((node) => node.id === selectedId) ?? null;
  const selectedRunStep = activeExecution?.steps.find((step) => step.nodeId === selectedId);
  const currentWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
  const filteredKinds = (Object.keys(kindInfo) as CanvasKind[]).filter((kind) =>
    `${kindInfo[kind].title} ${kindInfo[kind].description}`
      .toLowerCase()
      .includes(nodeSearch.toLowerCase()),
  );

  const loadWorkflows = useCallback(async (id: string) => {
    const items = await api<ApiWorkflow[]>(`/workflows?workspaceId=${id}`);
    if (items.length === 0) {
      const created = await api<ApiWorkflow>('/workflows', json('POST', template(id)));
      setWorkflows([created]);
      setWorkflowId(created.id);
      setWorkflowName(created.name);
      setStatus(created.status);
      return created;
    }
    setWorkflows(items);
    return items[0];
  }, []);

  const loadCredentials = useCallback(async () => {
    if (!workspaceId) return;
    const items = await api<ApiCredential[]>(`/credentials?workspaceId=${workspaceId}`);
    setCredentials(items);
  }, [workspaceId]);

  const loadRuns = useCallback(async () => {
    if (!workspaceId || !workflowId) return;
    const items = await api<ApiExecution[]>(
      `/executions?workspaceId=${workspaceId}&workflowId=${workflowId}`,
    );
    setExecutions(items);
    if (activeExecution) {
      const current = items.find((item) => item.id === activeExecution.id);
      if (current) setActiveExecution(current);
      if (current && current.status !== 'queued' && current.status !== 'running') {
        setRunning(false);
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [workspaceId, workflowId, activeExecution]);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const spaces = await api<Workspace[]>('/workspaces');
        if (cancelled) return;
        setWorkspaces(spaces);
        const first = spaces[0];
        if (!first) throw new Error('Create a workspace before opening the workflow editor.');
        setWorkspaceId(first.id);
        const workflow = await loadWorkflows(first.id);
        if (cancelled || !workflow) return;
        setWorkflowId(workflow.id);
        setWorkflowName(workflow.name);
        setStatus(workflow.status);
        if (workflow.nodes.length) {
          const graph = fromApi(workflow);
          setNodes(graph.nodes);
          setEdges(graph.edges);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not connect to the API.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [loadWorkflows, setEdges, setNodes]);

  useEffect(() => {
    void loadCredentials().catch((error) => toast.error(error.message));
  }, [loadCredentials]);
  useEffect(() => {
    void loadRuns().catch((error) => toast.error(error.message));
  }, [loadRuns]);
  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          { ...connection, id: crypto.randomUUID(), type: 'smoothstep', animated: false },
          current,
        ),
      );
    },
    [setEdges],
  );

  function updateNode(id: string, patch: Partial<NodeData>) {
    setNodes((current) =>
      current.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    );
  }

  async function saveWorkflow(): Promise<boolean> {
    if (!workspaceId || !workflowId) return false;
    setSaving(true);
    try {
      const updated = await api<ApiWorkflow>(
        `/workflows/${workflowId}`,
        json('PUT', {
          workspaceId,
          name: workflowName,
          nodes: toApiNodes(nodes),
          edges: edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
            ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
          })),
        }),
      );
      setWorkflows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success('Workflow saved');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Workflow could not be saved.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function switchWorkflow(id: string, targetWorkspaceId = workspaceId) {
    const workflow = await api<ApiWorkflow>(`/workflows/${id}?workspaceId=${targetWorkspaceId}`);
    setWorkflowId(workflow.id);
    setWorkflowName(workflow.name);
    setStatus(workflow.status);
    const graph = fromApi(workflow);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setActiveExecution(null);
    setSelectedId(null);
  }

  async function createWorkflow() {
    if (!workspaceId) return;
    const created = await api<ApiWorkflow>(
      '/workflows',
      json('POST', { ...template(workspaceId), name: 'Untitled workflow' }),
    );
    setWorkflows((current) => [created, ...current]);
    setWorkflowId(created.id);
    setWorkflowName(created.name);
    setStatus('draft');
    const graph = fromApi(created);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setSelectedId(null);
    setActiveExecution(null);
    toast.success('Workflow created');
  }

  async function createWorkspace() {
    const name = window.prompt('Name this client workspace');
    if (!name?.trim()) return;
    try {
      const created = await api<Workspace>('/workspaces', json('POST', { name: name.trim() }));
      const nextSpaces = [...workspaces, created];
      setWorkspaces(nextSpaces);
      setWorkspaceId(created.id);
      const workflow = await loadWorkflows(created.id);
      if (workflow) await switchWorkflow(workflow.id, created.id);
      toast.success('Client workspace created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Workspace could not be created.');
    }
  }

  async function toggleActive() {
    if (!workflowId || !workspaceId) return;
    if (!(await saveWorkflow())) return;
    try {
      const updated = await api<ApiWorkflow>(
        `/workflows/${workflowId}/activation`,
        json('POST', { workspaceId, active: status !== 'active' }),
      );
      setStatus(updated.status);
      toast.success(updated.status === 'active' ? 'Workflow activated' : 'Workflow paused');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Activation could not be changed.');
    }
  }

  async function runWorkflow() {
    if (!workflowId || !workspaceId) return;
    let data: unknown;
    try {
      data = JSON.parse(testData);
    } catch {
      toast.error('Test data must be valid JSON.');
      return;
    }
    if (!(await saveWorkflow())) return;
    setRunning(true);
    setActiveExecution(null);
    try {
      const { id } = await api<{ id: string }>(
        `/workflows/${workflowId}/runs`,
        json('POST', { workspaceId, data }),
      );
      const initial = await api<ApiExecution>(`/executions/${id}?workspaceId=${workspaceId}`);
      setActiveExecution(initial);
      setSection('runs');
      toast.success('Workflow run started');
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        void loadRuns();
      }, 800);
    } catch (error) {
      setRunning(false);
      toast.error(error instanceof Error ? error.message : 'Workflow could not start.');
    }
  }

  async function addNode(kind: CanvasKind) {
    const id = crypto.randomUUID().slice(0, 8);
    const info = kindInfo[kind];
    const center = document.querySelector('.flow-canvas')?.getBoundingClientRect();
    const position = center
      ? { x: center.width / 2 - 70, y: center.height / 2 - 50 }
      : { x: 340, y: 260 };
    setNodes((current) => [
      ...current,
      {
        id,
        type: 'workflowNode',
        position,
        data: {
          title: info.title,
          kind,
          config: kind === 'http' ? { method: 'GET', url: '', headers: {}, body: '' } : {},
        },
      },
    ]);
    setSelectedId(id);
    setAddMenuOpen(false);
    setNodeSearch('');
  }

  function removeSelectedNode() {
    if (!selectedId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedId));
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId),
    );
    setSelectedId(null);
  }

  const renderedNodes = useMemo<CanvasNode[]>(() => {
    const statuses = new Map(
      activeExecution?.steps.map((step) => [step.nodeId, step.status]) ?? [],
    );
    return nodes.map((node) => {
      const runStatus = statuses.get(node.id);
      return runStatus ? { ...node, data: { ...node.data, runStatus } } : node;
    });
  }, [nodes, activeExecution]);

  return (
    <div className="editor-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand-row">
          <Link to="/" className="brand-lockup">
            <span className="brand-mark">
              <Workflow size={15} />
            </span>
            <span>Mortein</span>
          </Link>
          <button type="button" className="icon-button subtle" aria-label="Collapse sidebar">
            <Ellipsis size={17} />
          </button>
        </div>
        <label className="workspace-select">
          <span className="workspace-avatar">
            {(currentWorkspace?.name ?? 'W').slice(0, 1).toUpperCase()}
          </span>
          <select
            value={workspaceId}
            onChange={async (event) => {
              const id = event.target.value;
              setWorkspaceId(id);
              const workflow = await loadWorkflows(id);
              if (workflow) await switchWorkflow(workflow.id);
            }}
            aria-label="Client workspace"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <div className="workspace-add">
          <button type="button" onClick={() => void createWorkspace()}>
            <Plus size={14} /> Add client workspace
          </button>
        </div>
        <div className="sidebar-group-label">Workspace</div>
        <nav className="app-nav" aria-label="Workspace navigation">
          <button
            type="button"
            className={section === 'builder' ? 'is-active' : ''}
            onClick={() => setSection('builder')}
          >
            <Workflow size={16} /> Workflows <span>{workflows.length}</span>
          </button>
          <button
            type="button"
            className={section === 'runs' ? 'is-active' : ''}
            onClick={() => setSection('runs')}
          >
            <History size={16} /> Runs <span>{executions.length || ''}</span>
          </button>
          <Link to="/wiki">
            <BookOpen size={16} /> Wiki
          </Link>
        </nav>
        <div className="sidebar-group-title">
          <span>Flows</span>
          <button type="button" onClick={() => void createWorkflow()} aria-label="Create workflow">
            <Plus size={15} />
          </button>
        </div>
        <div className="workflow-list">
          {workflows.map((workflow) => (
            <button
              type="button"
              key={workflow.id}
              className={`workflow-list-item ${workflow.id === workflowId ? 'is-current' : ''}`}
              onClick={() => void switchWorkflow(workflow.id)}
            >
              <span className={`flow-state ${workflow.status}`} />
              <span>{workflow.name}</span>
              <MoreHorizontal size={15} />
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-user-avatar">P</div>
          <div>
            <strong>Personal workspace</strong>
            <small>Self-hosted instance</small>
          </div>
          <button type="button" className="icon-button subtle" aria-label="Instance settings">
            <Settings2 size={16} />
          </button>
        </div>
      </aside>

      <main className="editor-main">
        <header className="editor-topbar">
          <div className="editor-breadcrumb">
            <button
              type="button"
              className="back-to-flows"
              onClick={() => setSection('builder')}
              aria-label="Back to workflows"
            >
              <ArrowLeft size={15} />
            </button>
            <span>{currentWorkspace?.name ?? 'Workspace'}</span>
            <span className="breadcrumb-slash">/</span>
            <input
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              aria-label="Workflow name"
            />
            <ChevronDown size={13} className="name-chevron" />
          </div>
          <div className="editor-top-actions">
            <span className={`save-indicator ${saving ? 'is-saving' : ''}`}>
              <span /> {saving ? 'Saving' : 'All changes saved'}
            </span>
            <button type="button" className="icon-button" aria-label="Notifications">
              <Bell size={16} />
            </button>
            <button type="button" className="avatar-button" aria-label="Personal workspace">
              P
            </button>
          </div>
        </header>
        <div className="workflow-toolbar">
          <div className="toolbar-left">
            <div className="mode-switch">
              <button
                type="button"
                className={section === 'builder' ? 'is-current' : ''}
                onClick={() => setSection('builder')}
              >
                <Workflow size={14} /> Builder
              </button>
              <button
                type="button"
                className={section === 'runs' ? 'is-current' : ''}
                onClick={() => setSection('runs')}
              >
                <Activity size={14} /> Runs
              </button>
            </div>
            <span className="toolbar-divider" />
            <span className={`draft-status ${status}`}>
              {status === 'active' ? (
                <>
                  <span /> Active
                </>
              ) : (
                'Draft'
              )}
            </span>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className="button button-secondary button-sm"
              onClick={() => void saveWorkflow()}
              disabled={saving}
            >
              <Check size={14} /> {saving ? 'Saving' : 'Save changes'}
            </button>
            <button
              type="button"
              className="button button-primary button-sm"
              onClick={() => void runWorkflow()}
              disabled={running || loading}
            >
              <Play size={14} fill="currentColor" /> {running ? 'Running…' : 'Run workflow'}
            </button>
            <button
              type="button"
              className={`button button-sm ${status === 'active' ? 'button-active' : 'button-secondary'}`}
              onClick={() => void toggleActive()}
            >
              <span className={`activation-dot ${status}`} />
              {status === 'active' ? 'Pause' : 'Activate'}
            </button>
          </div>
        </div>

        {section === 'builder' ? (
          <div className="editor-canvas-area">
            <div className="canvas-subbar">
              <div className="canvas-tabs">
                <button type="button" className="is-current">
                  Workflow
                </button>
                <button type="button" onClick={() => setSection('runs')}>
                  Executions
                </button>
              </div>
              <div className="canvas-sub-actions">
                <button type="button" className="icon-button" aria-label="Undo">
                  <ArrowLeft size={15} />
                </button>
                <button type="button" className="icon-button" aria-label="Redo">
                  <ArrowRight size={15} />
                </button>
                <span className="toolbar-divider" />
                <button
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      JSON.stringify({ nodes: toApiNodes(nodes), edges }, null, 2),
                    );
                    toast.success('Workflow JSON copied');
                  }}
                >
                  <Code2 size={14} /> Export JSON
                </button>
              </div>
            </div>
            <div className="canvas-and-inspector">
              <div className="flow-canvas">
                {loading ? (
                  <div className="canvas-loading">
                    <span className="loading-spinner" /> Loading your workspace
                  </div>
                ) : null}
                <ReactFlow
                  nodes={renderedNodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(_event, node) => setSelectedId(node.id)}
                  onPaneClick={() => {
                    setSelectedId(null);
                    setAddMenuOpen(false);
                  }}
                  fitView
                  fitViewOptions={{ padding: 0.18 }}
                  minZoom={0.35}
                  maxZoom={1.5}
                  deleteKeyCode={['Backspace', 'Delete']}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background color="var(--line-grid)" gap={24} size={1} />
                  <Controls position="bottom-left" showInteractive={false} />
                  <MiniMap
                    position="bottom-right"
                    pannable
                    zoomable
                    nodeColor={(node) => {
                      const data = node.data as NodeData;
                      return `var(--tone-${kindInfo[data.kind]?.tone ?? 'blue'})`;
                    }}
                    maskColor="rgba(243,246,249,.75)"
                  />
                </ReactFlow>
                <div className="canvas-zoom-label">
                  <span className="live-dot" /> Live canvas
                </div>
                <div className="canvas-add-wrap">
                  <button
                    type="button"
                    className="canvas-add-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setAddMenuOpen((open) => !open);
                    }}
                  >
                    <Plus size={15} /> Add step <ChevronDown size={13} />
                  </button>
                  {addMenuOpen && (
                    <div className="add-node-menu">
                      <label className="add-node-search">
                        <Search size={14} />
                        <input
                          value={nodeSearch}
                          onChange={(event) => setNodeSearch(event.target.value)}
                          placeholder="Search steps"
                        />
                      </label>
                      <span className="menu-section-label">Available steps</span>
                      {filteredKinds.map((kind) => {
                        const info = kindInfo[kind];
                        const Icon = info.icon;
                        return (
                          <button
                            type="button"
                            key={kind}
                            className="add-node-option"
                            onClick={() => void addNode(kind)}
                          >
                            <span className={`node-icon tone-icon-${info.tone}`}>
                              <Icon size={15} />
                            </span>
                            <span>
                              <strong>{info.title}</strong>
                              <small>{info.description}</small>
                            </span>
                            <Plus size={14} />
                          </button>
                        );
                      })}
                      {filteredKinds.length === 0 && (
                        <p className="empty-search">No steps match “{nodeSearch}”.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <aside className={`inspector ${selectedNode ? 'has-selection' : ''}`}>
                {selectedNode ? (
                  <>
                    <div className="inspector-tabs">
                      <button
                        type="button"
                        className={!selectedRunStep ? 'is-current' : ''}
                        onClick={() => {
                          if (activeExecution) setActiveExecution(null);
                        }}
                      >
                        Parameters
                      </button>
                      <button
                        type="button"
                        className={selectedRunStep ? 'is-current' : ''}
                        onClick={() => {
                          if (!activeExecution) void loadRuns();
                        }}
                      >
                        Output{' '}
                        {selectedRunStep && (
                          <span className={`tiny-status ${selectedRunStep.status}`} />
                        )}
                      </button>
                    </div>
                    {selectedRunStep && activeExecution ? (
                      <div className="run-output-panel">
                        <div className={`run-result-banner ${selectedRunStep.status}`}>
                          <span>
                            {selectedRunStep.status === 'succeeded' ? (
                              <Check size={14} />
                            ) : selectedRunStep.status === 'failed' ? (
                              <X size={14} />
                            ) : selectedRunStep.status === 'skipped' ? (
                              <ArrowDown size={14} />
                            ) : (
                              <Clock3 size={14} />
                            )}
                          </span>
                          <div>
                            <strong>Step {selectedRunStep.status}</strong>
                            <small>
                              {activeExecution.status === 'failed' && selectedRunStep.duplicateRisk
                                ? 'This action may have completed before the connection failed.'
                                : 'Run data for this step.'}
                            </small>
                          </div>
                        </div>
                        {selectedRunStep.error && (
                          <div className="run-error-text">{selectedRunStep.error}</div>
                        )}
                        <div className="output-label">Input</div>
                        <pre className="json-output">
                          {JSON.stringify(selectedRunStep.input ?? {}, null, 2)}
                        </pre>
                        <div className="output-label">Output</div>
                        <pre className="json-output">
                          {JSON.stringify(selectedRunStep.output ?? {}, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <ConfigInspector
                        node={selectedNode}
                        credentials={credentials}
                        onChange={(patch) => updateNode(selectedNode.id, patch)}
                        onOpenCredentials={() => setDialogOpen(true)}
                        onClose={() => setSelectedId(null)}
                        onDelete={removeSelectedNode}
                        workflowId={workflowId}
                      />
                    )}
                  </>
                ) : (
                  <div className="inspector-empty">
                    <div className="inspector-empty-icon">
                      <Workflow size={18} />
                    </div>
                    <strong>Select a step</strong>
                    <p>Choose a node on the canvas to edit its settings or inspect its run data.</p>
                    <div className="inspector-shortcut">
                      <kbd>⌘</kbd>
                      <kbd>↵</kbd>
                      <span>Open selected step</span>
                    </div>
                  </div>
                )}
              </aside>
            </div>
            <div className="canvas-statusbar">
              <span>
                <span className="statusbar-dot" /> Workflow saved
              </span>
              <span>
                {nodes.length} steps <b>·</b> {edges.length} connections
              </span>
              <span>
                Webhook URL <code>/webhooks/{workflowId || '…'}</code>
              </span>
            </div>
          </div>
        ) : (
          <RunsPanel
            executions={executions}
            activeExecution={activeExecution}
            onSelect={(execution) => {
              setActiveExecution(execution);
              setSection('builder');
            }}
          />
        )}
        <CredentialDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          workspaceId={workspaceId}
          credentials={credentials}
          onUpdated={() => {
            void loadCredentials();
          }}
        />
      </main>
    </div>
  );
}

function RunsPanel({
  executions,
  activeExecution,
  onSelect,
}: {
  executions: ApiExecution[];
  activeExecution: ApiExecution | null;
  onSelect: (execution: ApiExecution) => void;
}) {
  return (
    <section className="runs-panel">
      <div className="runs-heading">
        <div>
          <span className="eyebrow">Execution history</span>
          <h1>Runs</h1>
          <p>Inspect each workflow run and see where the data went.</p>
        </div>
        <button type="button" className="button button-secondary button-sm">
          <Filter size={14} /> All runs <ChevronDown size={13} />
        </button>
      </div>
      <div className="runs-table">
        <div className="runs-table-head">
          <span>Workflow</span>
          <span>Status</span>
          <span>Started</span>
          <span>Trigger</span>
          <span>Steps</span>
          <span />
        </div>
        {executions.length ? (
          executions.map((execution) => (
            <button
              type="button"
              className={`run-row ${activeExecution?.id === execution.id ? 'is-selected' : ''}`}
              key={execution.id}
              onClick={() => onSelect(execution)}
            >
              <span className="run-workflow-name">
                <span className={`run-icon ${execution.status}`}>
                  <Workflow size={15} />
                </span>
                <span>
                  Lead intake<small>Run {execution.id.slice(0, 8)}</small>
                </span>
              </span>
              <span>
                <span className={`table-status ${execution.status}`}>
                  <i />
                  {execution.status}
                </span>
              </span>
              <span className="run-time">{new Date(execution.startedAt).toLocaleString()}</span>
              <span className="run-trigger">
                <Webhook size={13} /> {execution.trigger}
              </span>
              <span>
                {execution.steps.filter((step) => step.status === 'succeeded').length}/
                {execution.steps.length}
              </span>
              <ArrowRight size={15} className="run-row-arrow" />
            </button>
          ))
        ) : (
          <div className="runs-empty">
            <div>
              <History size={20} />
            </div>
            <h2>No runs yet</h2>
            <p>Run this workflow to see every step and its data here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
