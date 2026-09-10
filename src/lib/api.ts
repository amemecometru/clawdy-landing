/**
 * ClawdyClaw Studio API client.
 * Speaks to the edge Worker at /api/v1/* on the current host.
 */

export interface TaskPayload {
  client_name: string | null;
  contact: string | null;
  intent: string;
  estimated_value: number | null;
  source_url: string | null;
  _classification?: {
    intent: string;
    autonomy: string;
    confidence: number;
  };
}

export interface Task {
  id: string;
  source: string;
  priority: string;
  action: string;
  status: string;
  payload: string;
  operator_note: string | null;
  created_at: number;
  updated_at: number;
  executed_at: number | null;
}

function decode<T>(res: Response): Promise<T> {
  if (!res.ok) return Promise.reject(new ApiError(res.status, res.statusText));
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchTasks(opts: { status?: string } = {}): Promise<Task[]> {
  const q = opts.status ? `?status=${opts.status}` : "";
  const res = await fetch(`/api/v1/tasks${q}`);
  const data = await decode<{ tasks: Task[] }>(res);
  return data.tasks;
}

export async function approveTask(
  id: string,
  opts: { operator?: string; note?: string } = {}
): Promise<Task> {
  const res = await fetch(`/api/v1/tasks/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = await decode<{ task: Task }>(res);
  return data.task;
}

export async function rejectTask(
  id: string,
  opts: { operator?: string; note?: string } = {}
): Promise<Task> {
  const res = await fetch(`/api/v1/tasks/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = await decode<{ task: Task }>(res);
  return data.task;
}

export async function executeTask(id: string): Promise<Task> {
  const res = await fetch(`/api/v1/tasks/${id}/execute`, { method: "POST" });
  const data = await decode<{ task: Task }>(res);
  return data.task;
}

// ── Integrations / Auth Vault ──────────────────────────────────────────────

export interface Integration {
  provider: string;
  name: string;
  icon: string;
  mode: "oauth" | "api_key" | "core";
  description: string;
  tools: string[];
  badge: string;
  badgeTone: "ok" | "warn" | "core";
  scopes?: string;
  connected: boolean;
}

export async function fetchIntegrations(): Promise<{ user: { sub: string; email: string | null }; integrations: Integration[] }> {
  const res = await fetch(`/api/v1/integrations`);
  return decode(res);
}

export async function getConnectMeta(provider: string): Promise<
  | { provider: string; mode: "oauth"; redirect?: never }
  | { provider: string; mode: "api_key"; bind_url: string }
  | { provider: string; mode: "core" }
> {
  const res = await fetch(`/api/v1/auth/${provider}/connect`);
  return decode(res);
}

export async function bindApiKey(provider: string, key: string): Promise<{ ok: boolean; provider: string; connected: boolean }> {
  const res = await fetch(`/api/v1/integrations/${provider}/key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  return decode(res);
}

// ── Telemetry ──────────────────────────────────────────────────────────────

export interface IngressRecord {
  id: number;
  source: string;
  raw_body: string;
  headers: string | null;
  task_id: string | null;
  created_at: number;
}

export interface ExecutionRecord {
  id: string;
  task_id: string;
  tool: string;
  args: string;
  result: string | null;
  ok: number;
  created_at: number;
}

export async function fetchTelemetry(): Promise<{ ingress: IngressRecord[]; executions: ExecutionRecord[]; generated_at: number }> {
  const res = await fetch(`/api/v1/telemetry`);
  return decode(res);
}

// ── Sandbox simulate ───────────────────────────────────────────────────────

export interface SandboxStep {
  step: string;
  detail: unknown;
}

export async function simulatePayload(payload: Record<string, unknown>): Promise<{
  sandbox: boolean;
  trace: SandboxStep[];
  proposed_task: Record<string, unknown>;
}> {
  const res = await fetch(`/api/v1/sandbox/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return decode(res);
}