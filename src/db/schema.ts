/**
 * D1 Database Schema — ClawdyClaw task lifecycle.
 *
 * Run `migrate()` on first boot or deploy to apply the schema.
 * All tables use D1's built-in INTEGER PRIMARY KEY (rowid alias).
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL,
  priority      TEXT NOT NULL DEFAULT 'normal',
  action        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  payload       TEXT NOT NULL,
  operator_note TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  executed_at   INTEGER
);

CREATE TABLE IF NOT EXISTS approvals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    TEXT NOT NULL REFERENCES tasks(id),
  operator   TEXT NOT NULL,
  decision   TEXT NOT NULL,
  note       TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS ingress_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source     TEXT NOT NULL,
  raw_body   TEXT NOT NULL,
  headers    TEXT,
  task_id    TEXT REFERENCES tasks(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS intent_cache (
  pattern_hash TEXT PRIMARY KEY,
  intent       TEXT NOT NULL,
  action       TEXT NOT NULL,
  confidence   REAL NOT NULL DEFAULT 0.0,
  hit_count    INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_approvals_task ON approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_ingress_task ON ingress_log(task_id);

CREATE TABLE IF NOT EXISTS executions (
  id          TEXT PRIMARY KEY,
  task_id     TEXT REFERENCES tasks(id),
  tool        TEXT NOT NULL,
  args        TEXT NOT NULL,
  result      TEXT,
  ok          INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_executions_task ON executions(task_id);

CREATE TABLE IF NOT EXISTS vault_tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  provider      TEXT NOT NULL,
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    INTEGER,
  scope         TEXT,
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_user_provider ON vault_tokens(user_id, provider);
`;

export async function migrate(db: D1Database): Promise<void> {
  const statements = SCHEMA_SQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  await db.batch(statements.map((sql) => db.prepare(sql)));
}
