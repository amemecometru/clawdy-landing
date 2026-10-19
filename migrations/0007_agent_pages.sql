-- Pages: agent-ordered deliverables.
-- Mirrors the runtime schema in worker/db/schema.ts; that file is what actually
-- runs on boot, this file exists so `wrangler d1 migrations apply` converges on
-- the same shape instead of silently diverging.

CREATE TABLE IF NOT EXISTS page_builds (
  id             TEXT PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  kind           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'building'
                 CHECK (status IN ('draft','building','review','published','failed')),
  title          TEXT NOT NULL,
  brand          TEXT,
  agent_name     TEXT,
  spec_json      TEXT NOT NULL,
  html           TEXT,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  built_at       INTEGER,
  published_at   INTEGER,
  price_micros   INTEGER NOT NULL DEFAULT 0,
  sold_count     INTEGER NOT NULL DEFAULT 0,
  revenue_micros INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_page_builds_status ON page_builds(status);
CREATE INDEX IF NOT EXISTS idx_page_builds_created ON page_builds(created_at DESC);

CREATE TABLE IF NOT EXISTS page_orders (
  id             TEXT PRIMARY KEY,
  page_id        TEXT NOT NULL REFERENCES page_builds(id),
  buyer          TEXT NOT NULL,
  amount_micros  INTEGER NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'USD',
  tx_ref         TEXT,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_page_orders_page ON page_orders(page_id, created_at DESC);