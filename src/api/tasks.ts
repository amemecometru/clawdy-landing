/**
 * Task API — /api/v1/tasks
 *
 * CRUD + approval endpoints for the HITL task queue.
 */

import { Hono } from "hono";
import {
  getTask,
  listTasks,
  updateTaskStatus,
  recordApproval,
} from "../db/tasks";
import { execute, type ExecutorContext } from "./executor";
import { requireSession, authedUser } from "../lib/require-auth";

export interface TaskEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  VAULT_CIPHER_KEY?: string;
}

const tasks = new Hono<{ Bindings: TaskEnv }>();

// List tasks (filterable by status, source) — signed-in operators only.
// Queue contents are sensitive: task payloads carry client contact details.
tasks.get("/", requireSession, async (c) => {
  const status = c.req.query("status") ?? undefined;
  const source = c.req.query("source") ?? undefined;
  const limit = Number(c.req.query("limit") ?? "50");
  const offset = Number(c.req.query("offset") ?? "0");

  const results = await listTasks(c.env.DB, { status, source, limit, offset });
  return c.json({ tasks: results, count: results.length });
});

// Get single task — signed-in operators only.
tasks.get("/:id", requireSession, async (c) => {
  const task = await getTask(c.env.DB, c.req.param("id"));
  if (!task) return c.json({ error: "Task not found" }, 404);
  return c.json(task);
});

// Approve a task — the operator is the SIGNED-IN user, never the request
// body. (Previously `body.operator ?? "anonymous"` let anyone with curl
// approve HITL tasks as anyone.)
tasks.post("/:id/approve", requireSession, async (c) => {
  const id = c.req.param("id");
  const task = await getTask(c.env.DB, id);
  if (!task) return c.json({ error: "Task not found" }, 404);
  if (task.status !== "pending") {
    return c.json({ error: `Task is already ${task.status}` }, 409);
  }

  let body: { note?: string } = {};
  try { body = await c.req.json(); } catch { /* empty */ }

  const operator = authedUser(c).sub;
  const note = body.note ?? undefined;

  await recordApproval(c.env.DB, id, operator, "approved", note);
  const updated = await getTask(c.env.DB, id);
  return c.json({ task: updated, decision: "approved" });
});

// Reject a task — same rule: the operator is the signed-in user.
tasks.post("/:id/reject", requireSession, async (c) => {
  const id = c.req.param("id");
  const task = await getTask(c.env.DB, id);
  if (!task) return c.json({ error: "Task not found" }, 404);
  if (task.status !== "pending") {
    return c.json({ error: `Task is already ${task.status}` }, 409);
  }

  let body: { note?: string } = {};
  try { body = await c.req.json(); } catch { /* empty */ }

  const operator = authedUser(c).sub;
  const note = body.note ?? undefined;

  await recordApproval(c.env.DB, id, operator, "rejected", note);
  const updated = await getTask(c.env.DB, id);
  return c.json({ task: updated, decision: "rejected" });
});

// Mark task as executed (after HITL approval triggers downstream action).
// Execution must never run as anonymous — the approving operator's vault
// tokens drive the downstream call.
tasks.post("/:id/execute", requireSession, async (c) => {
  const id = c.req.param("id");
  const task = await getTask(c.env.DB, id);
  if (!task) return c.json({ error: "Task not found" }, 404);
  if (task.status !== "approved") {
    return c.json({ error: `Task must be approved before execution (current: ${task.status})` }, 409);
  }

  // Fire the downstream execution with the stored tool args.
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(task.payload); } catch { /* keep empty */ }

  const tool = (payload.tool as string) ?? task.action;
  const args = ((payload.args as Record<string, unknown>) ?? {});

  // Resolve the approving operator so their vault tokens drive the call.
  const operator = authedUser(c);
  const result = await execute(tool, args, { ...(c.env as unknown as object), operator } as unknown as ExecutorContext);

  await updateTaskStatus(c.env.DB, id, "executed");
  await c.env.DB.prepare(
    `INSERT INTO executions (id, task_id, tool, args, result, ok, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    `${id}-${Date.now()}`,
    id,
    tool,
    JSON.stringify(args),
    JSON.stringify(result.output),
    result.ok ? 1 : 0,
    Math.floor(Date.now() / 1000)
  ).run();

  const updated = await getTask(c.env.DB, id);
  return c.json({ task: updated, decision: "executed", execution: result });
});

export default tasks;
