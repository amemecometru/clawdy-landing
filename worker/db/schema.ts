/**
 * D1 Database Schema — ClawdyClaw task lifecycle.
 *
 * Run `migrate()` on first boot or deploy to apply the schema.
 * All tables use D1's built-in INTEGER PRIMARY KEY (rowid alias).
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  sub        TEXT PRIMARY KEY,
  email      TEXT,
  name       TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

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

CREATE TABLE IF NOT EXISTS portal_widgets (
  user_id    TEXT NOT NULL,
  platform   TEXT NOT NULL,
  config     TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, platform)
);

CREATE TABLE IF NOT EXISTS feed_events (
  id         TEXT PRIMARY KEY,
  platform   TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_feed_events_platform ON feed_events(platform, created_at);

CREATE TABLE IF NOT EXISTS professionals (
  id                    TEXT PRIMARY KEY,
  owner_sub             TEXT NOT NULL REFERENCES sessions(sub),
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  current_role          TEXT NOT NULL,
  current_company       TEXT,
  years_experience      INTEGER,
  target_role           TEXT NOT NULL,
  target_industry       TEXT,
  linkedin_url          TEXT,
  resume_url            TEXT,
  resume_content        TEXT,
  source                TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'linkedin', 'job_board', 'referral')),
  status                TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'qualified', 'in_design', 'approved', 'live', 'cancelled')),
  tier                  TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'professional', 'sophisticated')),
  domain_preference     TEXT,
  domain_tld            TEXT NOT NULL DEFAULT '.com',
  domain_custom_tld     TEXT,
  professional_email    TEXT,
  budget_range          TEXT NOT NULL DEFAULT 'flexible' CHECK (budget_range IN ('flexible', 'under_200', '200_500', '500_plus')),
  notes                 TEXT,
  qualification_score   REAL NOT NULL DEFAULT 0,
  qualified_at          INTEGER,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  archived_at           INTEGER
);

CREATE INDEX IF NOT EXISTS idx_professionals_owner ON professionals(owner_sub, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_professionals_status ON professionals(owner_sub, status);
CREATE INDEX IF NOT EXISTS idx_professionals_tier ON professionals(owner_sub, tier);
CREATE INDEX IF NOT EXISTS idx_professionals_source ON professionals(owner_sub, source);

CREATE TABLE IF NOT EXISTS professional_sites (
  id                        TEXT PRIMARY KEY,
  professional_id           TEXT NOT NULL REFERENCES professionals(id),
  tier                      TEXT NOT NULL CHECK (tier IN ('basic', 'professional', 'sophisticated')),
  status                    TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'deployed', 'live', 'archived')),
  hero_headline             TEXT,
  hero_tagline              TEXT,
  about_summary             TEXT,
  profile_image_url         TEXT,
  domain_name               TEXT,
  domain_tld                TEXT NOT NULL DEFAULT '.com',
  domain_status             TEXT NOT NULL DEFAULT 'checking' CHECK (domain_status IN ('checking', 'available', 'reserved', 'registered', 'failed')),
  domain_registrar          TEXT,
  domain_nameservers        TEXT,
  site_url                  TEXT,
  professional_email        TEXT,
  email_routing_status      TEXT NOT NULL DEFAULT 'pending' CHECK (email_routing_status IN ('pending', 'configured', 'failed')),
  email_inbound_target      TEXT,
  portfolio_items           TEXT,
  meta_description          TEXT,
  og_title                  TEXT,
  og_image                  TEXT,
  submitted_for_review_at   INTEGER,
  approved_by               TEXT REFERENCES sessions(sub),
  approved_at               INTEGER,
  approval_notes            TEXT,
  deployed_at               INTEGER,
  deployed_by               TEXT,
  last_updated_at           INTEGER,
  created_at                INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at                INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_professional_sites_professional ON professional_sites(professional_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_professional_sites_status ON professional_sites(status);

CREATE TABLE IF NOT EXISTS professional_site_sections (
  id                    TEXT PRIMARY KEY,
  professional_site_id  TEXT NOT NULL REFERENCES professional_sites(id),
  section_type          TEXT NOT NULL CHECK (section_type IN ('hero', 'about', 'portfolio', 'services', 'testimonials', 'blog', 'cta')),
  tier_minimum          TEXT NOT NULL CHECK (tier_minimum IN ('basic', 'professional', 'sophisticated')),
  content               TEXT NOT NULL,
  display_order         INTEGER NOT NULL DEFAULT 0,
  enabled               INTEGER NOT NULL DEFAULT 1,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_site_sections_site ON professional_site_sections(professional_site_id, display_order);

CREATE TABLE IF NOT EXISTS professional_campaigns (
  id          TEXT PRIMARY KEY,
  owner_sub   TEXT NOT NULL REFERENCES sessions(sub),
  name        TEXT NOT NULL,
  description TEXT,
  tier        TEXT NOT NULL CHECK (tier IN ('basic', 'professional', 'sophisticated')),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_professional_campaigns_owner ON professional_campaigns(owner_sub, created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_leads (
  id              TEXT PRIMARY KEY,
  campaign_id     TEXT NOT NULL REFERENCES professional_campaigns(id),
  professional_id TEXT NOT NULL REFERENCES professionals(id),
  sequence_step   INTEGER NOT NULL DEFAULT 0,
  sequence_status TEXT NOT NULL DEFAULT 'pending' CHECK (sequence_status IN ('pending', 'message_approved', 'sent', 'replied', 'positive', 'negative', 'no_reply', 'unsubscribe', 'stopped')),
  next_action_at  INTEGER,
  stop_reason     TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (campaign_id, professional_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_professional ON campaign_leads(professional_id);

CREATE TABLE IF NOT EXISTS campaign_messages (
  id                 TEXT PRIMARY KEY,
  campaign_lead_id   TEXT NOT NULL REFERENCES campaign_leads(id),
  step               INTEGER NOT NULL CHECK (step BETWEEN 0 AND 2),
  message_type       TEXT NOT NULL CHECK (message_type IN ('discovery', 'warm_reply', 'no_reply_followup')),
  subject            TEXT,
  body               TEXT NOT NULL,
  personalization    TEXT,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'sent', 'failed', 'bounced', 'replied')),
  approved_by        TEXT REFERENCES sessions(sub),
  approved_at        INTEGER,
  sent_at            INTEGER,
  gmail_message_id   TEXT,
  provider_response  TEXT,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at         INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_lead ON campaign_messages(campaign_lead_id, step, created_at DESC);

CREATE TABLE IF NOT EXISTS professional_subscriptions (
  id                     TEXT PRIMARY KEY,
  professional_id        TEXT NOT NULL REFERENCES professionals(id),
  tier                   TEXT NOT NULL CHECK (tier IN ('basic', 'professional', 'sophisticated')),
  billing_period_start   INTEGER NOT NULL,
  billing_period_end     INTEGER NOT NULL,
  price_setup            REAL NOT NULL,
  price_monthly          REAL NOT NULL,
  domain_addon_price     REAL NOT NULL DEFAULT 0,
  total_setup            REAL NOT NULL,
  total_monthly          REAL NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'failed')),
  stripe_subscription_id TEXT,
  cancel_reason          TEXT,
  cancelled_at           INTEGER,
  created_at             INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_professional_subscriptions_professional ON professional_subscriptions(professional_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inference_usage (
  id                TEXT PRIMARY KEY,
  operator_sub      TEXT NOT NULL,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  fee_bps           INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_inference_usage_operator ON inference_usage(operator_sub, created_at DESC);

CREATE TABLE IF NOT EXISTS follow_ups (
  id         TEXT PRIMARY KEY,
  owner_sub  TEXT NOT NULL,
  contact    TEXT,
  channel    TEXT NOT NULL DEFAULT 'email',
  due_at     INTEGER NOT NULL,
  payload    TEXT,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'cancelled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

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

CREATE INDEX IF NOT EXISTS idx_follow_ups_due ON follow_ups(status, due_at);

-- ── Agent-ordered pages ──────────────────────────────────────────────────────
-- One row per page an agent has ordered. The spec is the source of truth; the
-- rendered HTML is a derived artifact regenerated on every rebuild.

CREATE TABLE IF NOT EXISTS page_builds (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  kind          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'building'
                CHECK (status IN ('draft','building','review','published','failed')),
  title         TEXT NOT NULL,
  brand         TEXT,
  agent_name    TEXT,
  spec_json     TEXT NOT NULL,
  html          TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  built_at      INTEGER,
  published_at  INTEGER,
  -- Asking price, set at order time. Deliberately not derived from order
  -- history: what a page last sold for is not what it is worth today.
  price_micros  INTEGER NOT NULL DEFAULT 0,
  sold_count    INTEGER NOT NULL DEFAULT 0,
  revenue_micros INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_page_builds_status ON page_builds(status);
CREATE INDEX IF NOT EXISTS idx_page_builds_created ON page_builds(created_at DESC);

-- Sales against a page. Revenue on page_builds is denormalised from this so the
-- tools board is one query instead of one per row.

CREATE TABLE IF NOT EXISTS page_orders (
  id            TEXT PRIMARY KEY,
  page_id       TEXT NOT NULL REFERENCES page_builds(id),
  buyer         TEXT NOT NULL,
  amount_micros INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  tx_ref        TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_page_orders_page ON page_orders(page_id, created_at DESC);
`;

/**
 * Split a schema into individual statements.
 *
 * Line comments are stripped before splitting, because a `--` comment may
 * legitimately contain a semicolon and splitting on it would hand the leftover
 * fragment to the database as a statement of its own. This ran fine for a long
 * time and only broke once a comment was written with a colon in it.
 */
export function splitStatements(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => {
      // Only strip a comment marker that is outside a quoted string. Schema DDL
      // has no such strings today, but a future one must not be mangled.
      let inSingle = false;
      let inDouble = false;
      for (let i = 0; i < line.length - 1; i++) {
        const ch = line[i];
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        else if (!inSingle && !inDouble && ch === "-" && line[i + 1] === "-") {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function migrate(db: D1Database): Promise<void> {
  const statements = splitStatements(SCHEMA_SQL);
  await db.batch(statements.map((sql) => db.prepare(sql)));
}
