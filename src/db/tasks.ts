/**
 * Task CRUD — thin wrappers over D1 for the task lifecycle.
 */

export interface Task {
  id: string;
  source: string;
  priority: string;
  action: string;
  status: string;
  payload: string;       // JSON string
  operator_note: string | null;
  created_at: number;
  updated_at: number;
  executed_at: number | null;
}

export interface NewTask {
  id: string;
  source: string;
  priority?: string;
  action: string;
  payload: Record<string, unknown>;
}

export async function createTask(db: D1Database, task: NewTask): Promise<Task> {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    `INSERT INTO tasks (id, source, priority, action, status, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
  );
  await stmt.bind(
    task.id,
    task.source,
    task.priority ?? "normal",
    task.action,
    JSON.stringify(task.payload),
    now,
    now
  ).run();
  return (await getTask(db, task.id))!;
}

export async function getTask(db: D1Database, id: string): Promise<Task | null> {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first<Task>();
}

export async function listTasks(
  db: D1Database,
  opts: { status?: string; source?: string; limit?: number; offset?: number } = {}
): Promise<Task[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (opts.status) { clauses.push("status = ?"); binds.push(opts.status); }
  if (opts.source) { clauses.push("source = ?"); binds.push(opts.source); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  return db
    .prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset)
    .all<Task>()
    .then((r) => r.results);
}

export async function updateTaskStatus(
  db: D1Database,
  id: string,
  status: string,
  note?: string
): Promise<Task | null> {
  const now = Math.floor(Date.now() / 1000);
  const extras =
    status === "executed"
      ? ", executed_at = ?"
      : "";
  const sql = `UPDATE tasks SET status = ?, operator_note = COALESCE(?, operator_note), updated_at = ?${extras} WHERE id = ?`;
  const binds =
    status === "executed"
      ? [status, note ?? null, now, now, id]
      : [status, note ?? null, now, id];
  await db.prepare(sql).bind(...binds).run();
  return getTask(db, id);
}

export async function recordApproval(
  db: D1Database,
  taskId: string,
  operator: string,
  decision: "approved" | "rejected",
  note?: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO approvals (task_id, operator, decision, note, created_at) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(taskId, operator, decision, note ?? null, now)
    .run();
  await updateTaskStatus(db, taskId, decision === "approved" ? "approved" : "rejected", note);
}
