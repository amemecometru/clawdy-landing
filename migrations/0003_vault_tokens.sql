-- ClawdyClaw — Auth Vault & OAuth Broker
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