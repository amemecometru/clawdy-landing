-- Professionals workflow payment: one-time checkout per tier and the digital
-- receipt issued when it settles. A paid checkout row is the entitlement.

CREATE TABLE IF NOT EXISTS professionals_checkout (
  id                TEXT PRIMARY KEY,
  owner_sub         TEXT NOT NULL REFERENCES sessions(sub),
  tier              TEXT NOT NULL CHECK (tier IN ('t1','t2','t3','t4')),
  price_usd         REAL NOT NULL,
  price_cents       INTEGER NOT NULL,
  domain_cost_usd   REAL,
  method            TEXT NOT NULL CHECK (method IN ('stripe','crypto')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','failed')),
  network           TEXT,
  asset             TEXT,
  pay_to            TEXT,
  amount_atomic     TEXT,
  buyer_wallet      TEXT,
  reference         TEXT NOT NULL,
  stripe_session_id TEXT,
  payment_reference TEXT,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  paid_at           INTEGER,
  expires_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pro_checkout_owner ON professionals_checkout(owner_sub, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_checkout_reference ON professionals_checkout(reference);
CREATE INDEX IF NOT EXISTS idx_pro_checkout_status ON professionals_checkout(status);

CREATE TABLE IF NOT EXISTS professionals_receipts (
  id           TEXT PRIMARY KEY,
  checkout_id  TEXT NOT NULL REFERENCES professionals_checkout(id),
  owner_sub    TEXT NOT NULL REFERENCES sessions(sub),
  tier         TEXT NOT NULL,
  price_usd    REAL NOT NULL,
  method       TEXT NOT NULL,
  reference    TEXT NOT NULL,
  body         TEXT NOT NULL,
  signature    TEXT NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_receipt_checkout ON professionals_receipts(checkout_id);
