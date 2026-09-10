-- ClawdyClaw — MCP execution log
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