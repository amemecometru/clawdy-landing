-- ClawdyClaw — D1 initial schema (task lifecycle)

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