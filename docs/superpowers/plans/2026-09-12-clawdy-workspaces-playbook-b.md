# Clawdy Workspaces + AI-Audit Playbook (B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the Clawdy studio from a mirror of backend plumbing (Command Center, Queue, Telemetry, Vault, Sandbox, CLI, Models, Tool Registry) to an **output-first front where Workspaces = client engagements**, powered by Playbook B (the AI-Audit funnel: free audit → Gemini report → email-gate lead → chat → Stripe checkout → webhook → customer). Plumbing demotes into an "Engine Room" group behind-the-curtain. Stripe settles today through a settlement adapter built to accept wallet/402 providers later.

**Architecture:** New D1 tables (`workspaces`, `audit_leads`, `audit_reports`, `audit_payments`) hang off the existing Clawdy D1. Two new Hono routers mount under `/api/v1`: `workspaces` (CRUD + stats) and `audit` (funnel endpoints). A `SettlementProvider` interface abstracts payment (Stripe implementation shipped; wallet/ACH slots reserved). The funnel front-end is ported from `/home/book/AI-Auditing-template.Clawdy` into the existing SPA at the `/audit` route. `studio-page.tsx`/`studio-shell.tsx` gain a two-group nav (Front Door / Engine Room) with new Workspaces list + detail pages.

**Tech Stack:** Hono 4, Cloudflare Workers (wrangler 4), D1, SESSIONS KV, React 19, Vite 6, Tailwind 4, framer-motion 11, lucide-react, vitest + @cloudflare/vitest-pool-workers (new devDeps).

**Spec:** Design from brainstorming session 2026-09-12 ("Workspace = client engagement"; Playbook B = AI-Audit funnel; settlement = Stripe live keys now, wallet/402 next; front = results, back = plumbing). Source systems: `/home/book/AI-Auditing-template.Clawdy/server.ts` + `/home/book/AI-Auditing-template.Clawdy/src/*` (funnel), `/home/book/Clawdy/hackernoon.txt` (voice widget). Follow the Code, not stale roadmaps in `/home/book/ClawdyXtra.Components/`.

## Global Constraints

- **Codebase truth:** Current code is ground truth; do not follow EXECUTION-ROADMAPII/III or OrbitalHero docs — they are stale.
- **D1 dual-write:** Every schema change MUST be added to BOTH `migrations/0005_workspaces_audit.sql` (new file) AND appended to `SCHEMA_SQL` in `src/db/schema.ts`. They must stay byte-identical for the new tables.
- **HITL stays:** `send_email` / `draft_reply` remain interception-gated via the existing task queue. The funnel's `/chat` is read-only AI; it never sends.
- **No new secrets in git:** Stripe/Gemini keys go in Cloudflare secrets (`wrangler secret put`) at deploy, never in wrangler.jsonc or committed files.
- **No facebook naming change in this plan:** this is Clawdy repo work; reels/fb stuff lives in `/home/book/puppyclaw` and is out of scope.
- **Vault pattern:** provider secrets continue through `src/db/vault.ts`; server-side funnel secrets (Gemini, Stripe) come from `env` bindings, matching the AI-Auditing server pattern.
- **Verification commands:** `npm run build` (tsc --noEmit && vite build) and `npx vitest run` must both stay green each task.
- **Compatible deps only:** `@cloudflare/vitest-pool-workers` must match the installed wrangler major (4.x). If npm reports a peer conflict, pin the pool version listed as compatible with wrangler ^4.129.1.

---

## File Structure

**New files:**
- `migrations/0005_workspaces_audit.sql` — workspaces + audit funnel tables
- `src/db/workspaces.ts` — workspace + audit data access layer
- `src/api/workspaces.ts` — Hono CRUD + stats router
- `src/api/audit.ts` — funnel API (assess/leads/chat/checkout/webhook)
- `src/lib/settlement.ts` — SettlementProvider interface + Stripe impl
- `src/pages/studio/workspaces-page.tsx` — front-door workspace list
- `src/pages/studio/workspace-detail-page.tsx` — engagement detail (stats, leads, payments, reports)
- `src/pages/audit-funnel-page.tsx` — client-facing funnel route wrapper
- `src/components/audit/` — ported funnel components + types + data (from AI-Auditing-template.Clawdy/src)
- `src/components/widgets/hackernoon-voice-widget.tsx` — voice reader widget from hackernoon.txt
- `vitest.config.ts` — pool-workers test config
- `test/` — test files (mirroring src structure)

**Modified files:**
- `src/db/schema.ts` — append new DDL to `SCHEMA_SQL`
- `src/index.ts` — mount `/api/v1/workspaces` + `/api/v1/audit`, extend `ClawdyEnv`
- `src/App.tsx` — route `/audit` → funnel page
- `src/pages/studio-page.tsx` — two-group NAV, workspaces section, detail route
- `src/components/studio/studio-shell.tsx` — group headers in the rail
- `package.json` — add test script + vitest devDeps
- `wrangler.jsonc` — remove dead `facebook.clawdyclaw.com` / `fb.clawdyclaw.com` routes

**Untouched (do not edit):** `src/api/mcp.ts`, `src/api/tasks.ts`, `src/api/executor.ts`, `src/api/proxy-bridge.ts`, `src/db/tasks.ts`, `src/db/vault.ts`, `src/auth/`, `src/lib/feed-platforms.ts`.

---

### Task 1: Test harness (vitest + pool-workers)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `test/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` runs vitest against the real worker entry (`src/index.ts`) with in-memory D1 `DB` and KV `SESSIONS`.

- [ ] **Step 1: Install vitest + pool-workers**

Run:
```bash
npm i -D vitest @cloudflare/vitest-pool-workers
```
Expected: installs, no peer conflicts. If a peer conflict appears, retry with the pool version pinned to the wrangler-major-matched release (e.g. `@cloudflare/vitest-pool-workers@0.9.x`).

- [ ] **Step 2: Add test script**

Edit `package.json` scripts:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          compatibilityDate: "2026-09-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: { DB: "clawdy-test" },
          kvNamespaces: { SESSIONS: "sessions-test" },
          bindings: {
            GOOGLE_CLIENT_ID: "test",
            GOOGLE_CLIENT_SECRET: "test",
            AUTH_SECRET: "test",
            GEMINI_API_KEY: "test",
            STRIPE_SECRET_KEY: "test",
            STRIPE_WEBHOOK_SECRET: "test",
            STRIPE_PRICE_PRO: "price_pro_test",
            STRIPE_PRICE_ENTERPRISE: "price_ent_test",
            APP_URL: "http://localhost:5173",
          },
        },
      },
    },
  },
});
```

- [ ] **Step 4: Write the failing smoke test**

Create `test/smoke.test.ts`:
```ts
import { SELF } from "cloudflare:test";
import { it, expect } from "vitest";

it("serves /api/health", async () => {
  const res = await SELF.fetch("http://localhost/api/health");
  expect(res.status).toBe(200);
  const body = (await res.json()) as { status?: string };
  expect(body.status).toBe("ok");
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx vitest run test/smoke.test.ts`
Expected: FAIL (pool not configured yet / wrangler entry unresolved).

- [ ] **Step 6: Verify it passes**

Run: `npx vitest run test/smoke.test.ts`
Expected: PASS (after config + install settle).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts test/smoke.test.ts
git commit -m "test: add vitest pool-workers harness with health smoke test"
```

---

### Task 2: D1 schema — workspaces + audit funnel tables

**Files:**
- Create: `migrations/0005_workspaces_audit.sql`
- Modify: `src/db/schema.ts` (append to `SCHEMA_SQL`)
- Create: `test/db.schema.test.ts`

**Interfaces:**
- Produces tables: `workspaces(id, name, client_name, client_email, playbook, status, created_at, updated_at)`, `audit_leads(id, workspace_id, name, email, company, source, readiness_score, plan, is_customer, created_at, updated_at)`, `audit_reports(id, workspace_id, client_name, client_email, company_name, report_text, readiness_score, created_at)`, `audit_payments(id, workspace_id, stripe_event_id, stripe_customer_id, stripe_subscription_id, customer_email, plan, amount, currency, status, event_type, payload, created_at)`.
- Consumes: `migrate(db)` from `src/db/schema.ts` (existing).

- [ ] **Step 1: Write the failing schema test**

Create `test/db.schema.test.ts`:
```ts
import { env, SELF } from "cloudflare:test";
import { beforeAll, it, expect } from "vitest";
import { migrate } from "../src/db/schema";

beforeAll(async () => {
  await migrate(env.DB);
});

it("creates the workspaces + audit tables", async () => {
  const res = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workspaces','audit_leads','audit_reports','audit_payments')"
  ).all<{ name: string }>();
  const names = res.results.map((r) => r.name).sort();
  expect(names).toEqual(["audit_leads", "audit_payments", "audit_reports", "workspaces"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/db.schema.test.ts`
Expected: FAIL (tables missing).

- [ ] **Step 3: Create the migration file**

Create `migrations/0005_workspaces_audit.sql`:
```sql
-- ClawdyClaw — workspaces (client engagements) + AI-Audit funnel (Playbook B)

CREATE TABLE IF NOT EXISTS workspaces (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  client_name  TEXT,
  client_email TEXT,
  playbook     TEXT NOT NULL DEFAULT 'ai_audit',
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);

CREATE TABLE IF NOT EXISTS audit_leads (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id   TEXT REFERENCES workspaces(id),
  name           TEXT,
  email          TEXT NOT NULL,
  company        TEXT,
  source         TEXT DEFAULT 'email_gate',
  readiness_score INTEGER,
  plan           TEXT,
  is_customer    INTEGER DEFAULT 0,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_leads_ws_email ON audit_leads(workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_audit_leads_ws ON audit_leads(workspace_id);

CREATE TABLE IF NOT EXISTS audit_reports (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id   TEXT REFERENCES workspaces(id),
  client_name    TEXT,
  client_email   TEXT,
  company_name   TEXT,
  report_text    TEXT,
  readiness_score INTEGER,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_ws ON audit_reports(workspace_id);

CREATE TABLE IF NOT EXISTS audit_payments (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id          TEXT REFERENCES workspaces(id),
  stripe_event_id       TEXT UNIQUE,
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  customer_email        TEXT,
  plan                  TEXT,
  amount                INTEGER,
  currency              TEXT,
  status                TEXT,
  event_type            TEXT,
  payload               TEXT,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_audit_payments_ws ON audit_payments(workspace_id);
```

- [ ] **Step 4: Append identical DDL to schema.ts**

In `src/db/schema.ts`, append the exact same SQL text (tables + indexes above) to the end of the `SCHEMA_SQL` template string, before the closing backtick.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/db.schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify build + commit**

Run: `npm run build`
Expected: tsc clean + vite build succeeds.
```bash
git add migrations/0005_workspaces_audit.sql src/db/schema.ts test/db.schema.test.ts
git commit -m "feat(db): workspaces + audit funnel tables (migration 0005)"
```

---

### Task 3: Workspace data layer

**Files:**
- Create: `src/db/workspaces.ts`
- Create: `test/db.workspaces.test.ts`

**Interfaces:**
- Consumes: D1 `DB` (test env), tables from Task 2.
- Produces:
  - `createWorkspace(db, { id, name, client_name?, client_email?, playbook? }) → Workspace`
  - `listWorkspaces(db) → Array<Workspace & { lead_count, customer_count, revenue }>`
  - `getWorkspace(db, id) → Workspace | null`
  - `getWorkspaceDetail(db, id) → { workspace, leads, payments, reports } | null`
  - `updateWorkspaceStatus(db, id, status: "active"|"paused"|"closed") → Workspace | null`
  - `upsertAuditLead(db, { workspace_id, name?, email, company?, source?, readiness_score? }) → { id }`
  - `createAuditReport(db, { workspace_id, client_name?, client_email?, company_name?, report_text, readiness_score? }) → void`
  - `recordAuditPayment(db, { workspace_id, stripe_event_id, stripe_customer_id?, stripe_subscription_id?, customer_email?, plan?, amount?, currency?, status?, event_type?, payload? }) → void`
  - `markAuditLeadCustomer(db, workspace_id, email, plan) → void`
- Types: `Workspace = { id, name, client_name: string|null, client_email: string|null, playbook, status, created_at: number, updated_at: number }`

- [ ] **Step 1: Write the failing data-layer test**

Create `test/db.workspaces.test.ts`:
```ts
import { env } from "cloudflare:test";
import { beforeAll, it, expect } from "vitest";
import { migrate } from "../src/db/schema";
import {
  createWorkspace, listWorkspaces, getWorkspace, getWorkspaceDetail,
  updateWorkspaceStatus, upsertAuditLead, createAuditReport,
  recordAuditPayment, markAuditLeadCustomer,
} from "../src/db/workspaces";

beforeAll(async () => { await migrate(env.DB); });

it("creates, lists, and stats a workspace", async () => {
  const ws = await createWorkspace(env.DB, { id: "ws-1", name: "LogicLemon Audit", client_email: "ops@logiclemonai.com", playbook: "ai_audit" });
  expect(ws.status).toBe("active");

  await upsertAuditLead(env.DB, { workspace_id: "ws-1", name: "Ada", email: "ada@acme.com", readiness_score: 72 });
  await upsertAuditLead(env.DB, { workspace_id: "ws-1", name: "Ada", email: "ada@acme.com", readiness_score: 80 });
  await createAuditReport(env.DB, { workspace_id: "ws-1", client_email: "ada@acme.com", report_text: "{}", readiness_score: 80 });
  await recordAuditPayment(env.DB, { workspace_id: "ws-1", stripe_event_id: "evt_1", customer_email: "ada@acme.com", amount: 99700, currency: "usd", status: "complete", plan: "pro" });
  await markAuditLeadCustomer(env.DB, "ws-1", "ada@acme.com", "pro");

  const list = await listWorkspaces(env.DB);
  expect(list).toHaveLength(1);
  expect(list[0].lead_count).toBe(1);       // upsert dedupe by (workspace_id, email)
  expect(list[0].customer_count).toBe(1);
  expect(list[0].revenue).toBe(99700);

  const detail = await getWorkspaceDetail(env.DB, "ws-1");
  expect(detail?.leads).toHaveLength(1);
  expect(detail?.payments[0].customer_email).toBe("ada@acme.com");
  expect(detail?.reports[0].readiness_score).toBe(80);

  const paused = await updateWorkspaceStatus(env.DB, "ws-1", "paused");
  expect(paused?.status).toBe("paused");
  expect(await getWorkspace(env.DB, "ws-999")).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/db.workspaces.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/db/workspaces.ts`**

```ts
/**
 * Workspace data layer — client engagements + AI-Audit funnel (Playbook B).
 */

export interface Workspace {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  playbook: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export type WorkspaceStatus = "active" | "paused" | "closed";

export async function createWorkspace(
  db: D1Database,
  input: { id: string; name: string; client_name?: string; client_email?: string; playbook?: string }
): Promise<Workspace> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(
    `INSERT INTO workspaces (id, name, client_name, client_email, playbook, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
  )
    .bind(input.id, input.name, input.client_name ?? null, input.client_email ?? null, input.playbook ?? "ai_audit", now, now)
    .run();
  return (await getWorkspace(db, input.id))!;
}

export async function getWorkspace(db: D1Database, id: string): Promise<Workspace | null> {
  return db.prepare("SELECT * FROM workspaces WHERE id = ?").bind(id).first<Workspace>();
}

export async function listWorkspaces(
  db: D1Database
): Promise<Array<Workspace & { lead_count: number; customer_count: number; revenue: number }>> {
  const { results } = await db.prepare(
    `SELECT w.*,
       (SELECT COUNT(*) FROM audit_leads l WHERE l.workspace_id = w.id) AS lead_count,
       (SELECT COUNT(*) FROM audit_leads l WHERE l.workspace_id = w.id AND l.is_customer = 1) AS customer_count,
       (SELECT COALESCE(SUM(p.amount), 0) FROM audit_payments p WHERE p.workspace_id = w.id) AS revenue
     FROM workspaces w
     ORDER BY w.created_at DESC`
  ).all<Workspace & { lead_count: number; customer_count: number; revenue: number }>();
  return results;
}

export async function getWorkspaceDetail(
  db: D1Database,
  id: string
): Promise<{ workspace: Workspace; leads: unknown[]; payments: unknown[]; reports: unknown[] } | null> {
  const workspace = await getWorkspace(db, id);
  if (!workspace) return null;
  const leads = (await db.prepare("SELECT * FROM audit_leads WHERE workspace_id = ? ORDER BY created_at DESC").bind(id).all()).results;
  const payments = (await db.prepare("SELECT * FROM audit_payments WHERE workspace_id = ? ORDER BY created_at DESC").bind(id).all()).results;
  const reports = (await db.prepare("SELECT * FROM audit_reports WHERE workspace_id = ? ORDER BY created_at DESC").bind(id).all()).results;
  return { workspace, leads, payments, reports };
}

export async function updateWorkspaceStatus(
  db: D1Database,
  id: string,
  status: WorkspaceStatus
): Promise<Workspace | null> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare("UPDATE workspaces SET status = ?, updated_at = ? WHERE id = ?").bind(status, now, id).run();
  return getWorkspace(db, id);
}

export async function upsertAuditLead(
  db: D1Database,
  input: { workspace_id: string; name?: string; email: string; company?: string; source?: string; readiness_score?: number }
): Promise<{ id: number }> {
  const now = Math.floor(Date.now() / 1000);
  const existing = await db
    .prepare("SELECT id FROM audit_leads WHERE workspace_id = ? AND email = ?")
    .bind(input.workspace_id, input.email.toLowerCase().trim())
    .first<{ id: number }>();

  if (existing) {
    await db.prepare(
      `UPDATE audit_leads SET name = COALESCE(NULLIF(?, ''), name), company = COALESCE(NULLIF(?, ''), company),
         source = ?, readiness_score = COALESCE(?, readiness_score), updated_at = ? WHERE id = ?`
    )
      .bind(input.name ?? null, input.company ?? null, input.source ?? "email_gate", input.readiness_score ?? null, now, existing.id)
      .run();
    return { id: existing.id };
  }

  await db.prepare(
    `INSERT INTO audit_leads (workspace_id, name, email, company, source, readiness_score, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(input.workspace_id, input.name ?? null, input.email.toLowerCase().trim(), input.company ?? null, input.source ?? "email_gate", input.readiness_score ?? null, now, now)
    .run();
  const row = await db
    .prepare("SELECT id FROM audit_leads WHERE workspace_id = ? AND email = ?")
    .bind(input.workspace_id, input.email.toLowerCase().trim())
    .first<{ id: number }>();
  return { id: row!.id };
}

export async function createAuditReport(
  db: D1Database,
  input: { workspace_id: string; client_name?: string; client_email?: string; company_name?: string; report_text: string; readiness_score?: number }
): Promise<void> {
  await db.prepare(
    `INSERT INTO audit_reports (workspace_id, client_name, client_email, company_name, report_text, readiness_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(input.workspace_id, input.client_name ?? null, input.client_email ?? null, input.company_name ?? null, input.report_text, input.readiness_score ?? null, Math.floor(Date.now() / 1000))
    .run();
}

export async function recordAuditPayment(
  db: D1Database,
  input: { workspace_id: string; stripe_event_id: string; stripe_customer_id?: string; stripe_subscription_id?: string; customer_email?: string; plan?: string; amount?: number; currency?: string; status?: string; event_type?: string; payload?: string }
): Promise<void> {
  await db.prepare(
    `INSERT INTO audit_payments (workspace_id, stripe_event_id, stripe_customer_id, stripe_subscription_id, customer_email, plan, amount, currency, status, event_type, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(input.workspace_id, input.stripe_event_id, input.stripe_customer_id ?? null, input.stripe_subscription_id ?? null, input.customer_email ?? null, input.plan ?? null, input.amount ?? null, input.currency ?? "usd", input.status ?? "complete", input.event_type ?? null, input.payload ?? null, Math.floor(Date.now() / 1000))
    .run();
}

export async function markAuditLeadCustomer(db: D1Database, workspace_id: string, email: string, plan: string): Promise<void> {
  await db.prepare(
    "UPDATE audit_leads SET is_customer = 1, plan = ?, updated_at = ? WHERE workspace_id = ? AND email = ?"
  )
    .bind(plan, Math.floor(Date.now() / 1000), workspace_id, email.toLowerCase().trim())
    .run();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/db.workspaces.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify build + commit**

Run: `npm run build`
Expected: clean.
```bash
git add src/db/workspaces.ts test/db.workspaces.test.ts
git commit -m "feat(db): workspace + audit funnel data layer"
```

---

### Task 4: Settlement adapter (Stripe provider)

**Files:**
- Create: `src/lib/settlement.ts`
- Create: `test/settlement.test.ts`

**Interfaces:**
- Produces:
  - `interface SettlementProvider { id: "stripe"; createCheckout(input: CheckoutInput): Promise<{ ok: true; url: string } | { ok: false; error: string }>; verifyWebhook(rawBody: string, signatureHeader: string | null, secret: string): Promise<{ valid: boolean; event?: { id: string; type: string; data?: { object?: Record<string, unknown> } } }> }`
  - `CheckoutInput = { plan: "pro" | "enterprise"; lead?: { name?: string; email?: string; company?: string }; workspaceId: string; successUrl: string; cancelUrl: string }`
  - `settlementProvider(env: { STRIPE_SECRET_KEY?: string; STRIPE_PRICE_PRO?: string; STRIPE_PRICE_ENTERPRISE?: string }) → SettlementProvider | null` (null when key missing)
  - `verifyStripeSignature(payload: string, signatureHeader: string | null, secret: string): Promise<boolean>` (exported for tests)

- [ ] **Step 1: Write the failing settlement test**

Create `test/settlement.test.ts`:
```ts
import { vi, it, expect } from "vitest";
import { settlementProvider, verifyStripeSignature } from "../src/lib/settlement";

it("builds a Stripe checkout session URL (subscription mode)", async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = String(init?.body ?? "");
    expect(body).toContain("mode=subscription");
    expect(body).toContain("line_items%5B0%5D%5Bprice%5D=price_pro_test");
    expect(body).toContain("customer_email=ada%40acme.com");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer sk_test" });
    return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/test" }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);

  const provider = settlementProvider({ STRIPE_SECRET_KEY: "sk_test", STRIPE_PRICE_PRO: "price_pro_test", STRIPE_PRICE_ENTERPRISE: "price_ent_test" });
  expect(provider).not.toBeNull();
  const out = await provider!.createCheckout({
    plan: "pro",
    lead: { name: "Ada", email: "ada@acme.com", company: "Acme" },
    workspaceId: "ws-1",
    successUrl: "http://localhost:5173/audit?status=success&plan=pro",
    cancelUrl: "http://localhost:5173/audit?status=canceled",
  });
  expect(out).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/test" });
  expect(fetchMock).toHaveBeenCalledOnce();

  vi.unstubAllGlobals();
});

it("verifies a valid Stripe webhook signature and rejects bad ones", async () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_1","type":"checkout.session.completed"}';
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const sig = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const header = `t=${timestamp},v1=${sig}`;

  expect(await verifyStripeSignature(payload, header, secret)).toBe(true);
  expect(await verifyStripeSignature(payload, header, "whsec_wrong")).toBe(false);
  expect(await verifyStripeSignature(payload, null, secret)).toBe(false);
});

it("returns null provider without a secret key", () => {
  expect(settlementProvider({})).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/settlement.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/settlement.ts`**

```ts
/**
 * Settlement adapter — payment rail abstraction.
 * v1 ships the Stripe provider; wallet (Coinbase/Base 402) and ACH
 * providers implement the same interface later.
 */

export interface CheckoutInput {
  plan: "pro" | "enterprise";
  lead?: { name?: string; email?: string; company?: string };
  workspaceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
}

export interface SettlementProvider {
  readonly id: "stripe";
  createCheckout(input: CheckoutInput): Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  verifyWebhook(rawBody: string, signatureHeader: string | null, secret: string): Promise<{ valid: boolean; event?: WebhookEvent }>;
}

interface StripeEnv {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ENTERPRISE?: string;
}

export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const digest = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  const threshold = Math.floor(Date.now() / 1000) - 300;
  if (Number(timestamp) < threshold) return false;

  const expected = signatures.find((s) => {
    if (s.length !== digest.length) return false;
    let diff = 0;
    for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ digest.charCodeAt(i);
    return diff === 0;
  });
  return !!expected;
}

async function stripeFetch(path: string, secretKey: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(init.headers || {}),
    },
  });
}

export function settlementProvider(env: StripeEnv): SettlementProvider | null {
  if (!env.STRIPE_SECRET_KEY) return null;

  return {
    id: "stripe",
    async createCheckout(input) {
      const priceId = input.plan === "enterprise" ? env.STRIPE_PRICE_ENTERPRISE : env.STRIPE_PRICE_PRO;
      if (!priceId) return { ok: false, error: `No Stripe Price for plan "${input.plan}"` };

      const params = new URLSearchParams();
      params.set("mode", "subscription");
      params.set("success_url", input.successUrl);
      params.set("cancel_url", input.cancelUrl);
      params.set("line_items[0][price]", priceId);
      params.set("line_items[0][quantity]", "1");
      if (input.lead?.email) {
        params.set("customer_email", input.lead.email);
        params.set("metadata[workspace_id]", input.workspaceId);
        params.set("metadata[lead_email]", input.lead.email);
        params.set("metadata[lead_name]", input.lead.name ?? "");
        params.set("metadata[company]", input.lead.company ?? "");
        params.set("metadata[plan]", input.plan);
      } else {
        params.set("metadata[workspace_id]", input.workspaceId);
        params.set("metadata[plan]", input.plan);
      }

      const res = await stripeFetch("/checkout/sessions", env.STRIPE_SECRET_KEY, { method: "POST", body: params.toString() });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: { message?: string } } | null;
      if (!res.ok || !data?.url) {
        return { ok: false, error: data?.error?.message ?? "Could not create checkout session" };
      }
      return { ok: true, url: data.url };
    },

    async verifyWebhook(rawBody, signatureHeader, secret) {
      const valid = await verifyStripeSignature(rawBody, signatureHeader, secret);
      if (!valid) return { valid: false };
      const event = JSON.parse(rawBody) as WebhookEvent;
      return { valid: true, event };
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/settlement.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify build + commit**

Run: `npm run build`
Expected: clean.
```bash
git add src/lib/settlement.ts test/settlement.test.ts
git commit -m "feat: settlement adapter with Stripe provider"
```

---

### Task 5: Workspaces API router

**Files:**
- Create: `src/api/workspaces.ts`
- Create: `test/api.workspaces.test.ts`

**Interfaces:**
- Consumes: `src/db/workspaces.ts` (Task 3).
- Produces (Hono router mounted at `/api/v1/workspaces`):
  - `GET /` → `{ workspaces }` (with lead_count/customer_count/revenue)
  - `POST /` body `{ name, client_name?, client_email?, playbook? }` → `{ workspace }` (201)
  - `GET /:id` → `{ workspace, leads, payments, reports }` (404 if missing)
  - `PATCH /:id` body `{ status }` → `{ workspace }`

- [ ] **Step 1: Write the failing API test**

Create `test/api.workspaces.test.ts`:
```ts
import { env, SELF } from "cloudflare:test";
import { beforeAll, it, expect } from "vitest";
import { migrate } from "../src/db/schema";

beforeAll(async () => { await migrate(env.DB); });

it("creates, lists, and reads a workspace via the API", async () => {
  const create = await SELF.fetch("http://localhost/api/v1/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Acme Audit", client_name: "Acme Inc", client_email: "ops@acme.com", playbook: "ai_audit" }),
  });
  expect(create.status).toBe(201);
  const created = (await create.json()) as { workspace: { id: string } };
  expect(created.workspace.id).toBeTruthy();

  const list = await SELF.fetch("http://localhost/api/v1/workspaces");
  const { workspaces } = (await list.json()) as { workspaces: Array<{ id: string; lead_count: number; revenue: number }> };
  expect(workspaces.some((w) => w.id === created.workspace.id)).toBe(true);

  const detail = await SELF.fetch(`http://localhost/api/v1/workspaces/${created.workspace.id}`);
  expect(detail.status).toBe(200);
  const { workspace, leads, payments, reports } = (await detail.json()) as { workspace: { name: string }; leads: unknown[]; payments: unknown[]; reports: unknown[] };
  expect(workspace.name).toBe("Acme Audit");
  expect(leads).toEqual([]);
  expect(payments).toEqual([]);
  expect(reports).toEqual([]);

  const patch = await SELF.fetch(`http://localhost/api/v1/workspaces/${created.workspace.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "paused" }),
  });
  expect((await patch.json())?.workspace?.status).toBe("paused");

  const missing = await SELF.fetch("http://localhost/api/v1/workspaces/nope");
  expect(missing.status).toBe(404);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/api.workspaces.test.ts`
Expected: FAIL (404 / no route).

- [ ] **Step 3: Implement `src/api/workspaces.ts`**

```ts
/**
 * Workspaces API — /api/v1/workspaces
 * Client engagements (workspace = client) with funnel stats.
 */

import { Hono } from "hono";
import {
  createWorkspace, listWorkspaces, getWorkspaceDetail,
  updateWorkspaceStatus, type WorkspaceStatus,
} from "../db/workspaces";

export interface WorkspacesEnv {
  DB: D1Database;
}

const workspaces = new Hono<{ Bindings: WorkspacesEnv }>();

workspaces.get("/", async (c) => {
  const results = await listWorkspaces(c.env.DB);
  return c.json({ workspaces: results });
});

workspaces.post("/", async (c) => {
  const { name, client_name, client_email, playbook } = await c.req.json<{
    name: string; client_name?: string; client_email?: string; playbook?: string;
  }>();
  if (!name?.trim()) return c.json({ error: "name is required" }, 400);
  const id = `ws-${Date.now().toString(36)}`;
  const workspace = await createWorkspace(c.env.DB, { id, name: name.trim(), client_name, client_email, playbook });
  return c.json({ workspace }, 201);
});

workspaces.get("/:id", async (c) => {
  const detail = await getWorkspaceDetail(c.env.DB, c.req.param("id"));
  if (!detail) return c.json({ error: "Workspace not found" }, 404);
  return c.json(detail);
});

workspaces.patch("/:id", async (c) => {
  const { status } = await c.req.json<{ status: WorkspaceStatus }>();
  if (!["active", "paused", "closed"].includes(status)) {
    return c.json({ error: "status must be active | paused | closed" }, 400);
  }
  const workspace = await updateWorkspaceStatus(c.env.DB, c.req.param("id"), status);
  if (!workspace) return c.json({ error: "Workspace not found" }, 404);
  return c.json({ workspace });
});

export default workspaces;
```

- [ ] **Step 4: Mount the router in `src/index.ts`**

Add import + route (next to the other routers):
```ts
import workspaces from "./api/workspaces";
// ...
app.route("/api/v1/workspaces", workspaces);
```
Extend `ClawdyEnv` with the funnel secrets (used by Task 6; add now so the type is stable):
```ts
GEMINI_API_KEY?: string;
STRIPE_SECRET_KEY?: string;
STRIPE_WEBHOOK_SECRET?: string;
STRIPE_PRICE_PRO?: string;
STRIPE_PRICE_ENTERPRISE?: string;
APP_URL?: string;
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/api.workspaces.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify build + commit**

Run: `npm run build`
Expected: clean.
```bash
git add src/api/workspaces.ts src/index.ts test/api.workspaces.test.ts
git commit -m "feat(api): workspaces CRUD + stats router"
```

---

### Task 6: Audit funnel API (assess / leads / chat)

**Files:**
- Create: `src/api/audit.ts`
- Create: `test/api.audit.test.ts`

**Interfaces:**
- Consumes: `src/db/workspaces.ts` (upsertAuditLead, createAuditReport), `env.GEMINI_API_KEY`.
- Produces (Hono router mounted at `/api/v1/audit`):
  - `POST /assess` body `{ workspace_id, questionnaire }` → `{ success: true, result: AssessmentResultJson }` where result is the parsed report object. Gemini call via REST; report saved via `createAuditReport`.
  - `POST /leads` body `{ workspace_id, name?, email, company?, source?, readiness_score? }` → `{ success: true, id }`
  - `POST /chat` body `{ message, history?, assessmentResult?, lead? }` → `{ success: true, reply }`
- Gemini REST (OpenAI-compatible endpoint, same as `src/api/infer.ts` gemini case):
  `POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=<GEMINI_API_KEY>` with `{ model: "gemini-2.5-flash", messages }`.

- [ ] **Step 1: Write the failing API test**

Create `test/api.audit.test.ts`:
```ts
import { env, SELF } from "cloudflare:test";
import { beforeAll, it, expect, vi } from "vitest";
import { migrate } from "../src/db/schema";

beforeAll(async () => { await migrate(env.DB); });

function stubGemini(replyBody: string) {
  return vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({ choices: [{ message: { content: replyBody } }] }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }));
}

it("assess generates + stores a report", async () => {
  const report = JSON.stringify({ summary: "ok", readinessScore: 77, recommendedTools: [], roadmap: [], risks: [], criticalAdvice: "go" });
  const fetchMock = stubGemini(report);

  const res = await SELF.fetch("http://localhost/api/v1/audit/assess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: "ws-1", questionnaire: { industry: "saas", goals: ["automation"] } }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { success: boolean; result: { readinessScore: number } };
  expect(body.success).toBe(true);
  expect(body.result.readinessScore).toBe(77);
  expect(fetchMock).toHaveBeenCalledOnce();

  const reports = (await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_reports WHERE workspace_id = 'ws-1'").first<{ n: number }>());
  expect(reports?.n).toBe(1);

  vi.unstubAllGlobals();
});

it("leads upsert dedupes by workspace+email", async () => {
  const mk = (n: string) => SELF.fetch("http://localhost/api/v1/audit/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: "ws-1", name: "Ada", email: n, readiness_score: 60 }),
  });

  const a = await mk("ada@acme.com");
  const b = await mk("ada@acme.com");
  expect(a.status).toBe(200);
  expect((await a.json())?.id).toBe((await b.json())?.id);

  const { results } = await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_leads WHERE workspace_id = 'ws-1'").all<{ n: number }>();
  expect(results[0].n).toBe(1);
});

it("chat returns the assistant reply", async () => {
  stubGemini("Hello, here is your audit summary.");

  const res = await SELF.fetch("http://localhost/api/v1/audit/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What do I fix first?", history: [], assessmentResult: null }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { reply: string };
  expect(body.reply).toContain("audit summary");

  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/api.audit.test.ts`
Expected: FAIL (404 / no route).

- [ ] **Step 3: Implement `src/api/audit.ts`**

```ts
/**
 * Audit funnel API — /api/v1/audit (Playbook B).
 * assess → Gemini report (stored), leads → email-gate capture,
 * chat → report-context assistant. Payment endpoints in Task 7.
 */

import { Hono } from "hono";
import { upsertAuditLead, createAuditReport } from "../db/workspaces";

export interface AuditEnv {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ENTERPRISE?: string;
  SESSIONS?: KVNamespace;
  APP_URL?: string;
}

const MODEL = "gemini-2.5-flash";

async function geminiChat(
  apiKey: string,
  messages: Array<{ role: "user" | "model" | "system"; content: string }>
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

function buildAssessPrompt(questionnaire: unknown): string {
  return `You are an expert AI operations auditor. Analyze these assessment responses and generate a structured diagnostic audit report. Return strictly valid JSON matching this schema: { summary: string, readinessScore: number 0-100, recommendedTools: [{name, category, description, suitabilityScore, pros[], cons[], estimatedCost, implementationEffort ("Low"|"Medium"|"High"), recommendedUseCases[]}], roadmap: [{title, duration, actions: [{task, description, difficulty ("Easy"|"Medium"|"Hard"), impact ("High"|"Medium"|"Low")}]}], risks: [{riskType, severity ("High"|"Medium"|"Low"), description, mitigationStrategy}], criticalAdvice: string }.

Assessment responses:
${JSON.stringify(questionnaire, null, 2)}`;
}

function parseReport(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error("The audit engine returned an unreadable report.");
  }
}

const audit = new Hono<{ Bindings: AuditEnv }>();

audit.post("/assess", async (c) => {
  const body = await c.req.json<{ workspace_id?: string; questionnaire?: unknown }>();
  const workspace_id = body.workspace_id ?? "ws-public";
  if (!c.env.GEMINI_API_KEY) return c.json({ error: "GEMINI_API_KEY is not configured" }, 500);

  const rawText = await geminiChat(c.env.GEMINI_API_KEY, [
    { role: "system", content: "You are a precise JSON generator. Output only the JSON report." },
    { role: "user", content: buildAssessPrompt(body.questionnaire ?? {}) },
  ]);

  const result = parseReport(rawText);
  await createAuditReport(c.env.DB, {
    workspace_id,
    report_text: JSON.stringify(result),
    readiness_score: typeof result.readinessScore === "number" ? result.readinessScore : undefined,
  });
  return c.json({ success: true, result });
});

audit.post("/leads", async (c) => {
  const body = await c.req.json<{
    workspace_id?: string; name?: string; email?: string; company?: string;
    source?: string; readiness_score?: number;
  }>();
  const workspace_id = body.workspace_id ?? "ws-public";
  if (!body.email?.trim()) return c.json({ success: false, error: "Email is required." }, 400);
  const { id } = await upsertAuditLead(c.env.DB, {
    workspace_id,
    name: body.name,
    email: body.email,
    company: body.company,
    source: body.source ?? "email_gate",
    readiness_score: body.readiness_score,
  });
  return c.json({ success: true, id });
});

audit.post("/chat", async (c) => {
  const body = await c.req.json<{
    message?: string; history?: Array<{ sender: "user" | "auditor"; text: string }>;
    assessmentResult?: Record<string, unknown> | null;
    lead?: { name?: string; company?: string } | null;
  }>();
  const userMessage = (body.message ?? "").trim();
  if (!userMessage) return c.json({ error: "Message is required." }, 400);
  if (!c.env.GEMINI_API_KEY) return c.json({ error: "GEMINI_API_KEY is not configured" }, 500);

  const leadCtx = body.lead?.name
    ? `\nThe user's contact details: name=${body.lead.name}${body.lead.company ? `, company=${body.lead.company}` : ""}.`
    : "";
  const system = body.assessmentResult
    ? `You are a senior AI operations consultant speaking with a client whose full assessment report has already been generated. Use it as authoritative context.
ASSESSMENT REPORT:
${JSON.stringify(body.assessmentResult, null, 2)}${leadCtx}
Be concise and practical. Reference their specific readiness score, recommended tools, roadmap phases, and risks. When relevant, gently mention that premium tiers include 1:1 expert audits and implementation support. Format with markdown bold and bullets. Never invent data not in the report.`
    : `You are a senior AI operations consultant who helps businesses evaluate AI tools. The client has not yet completed a full assessment, so keep answers educational and general.${leadCtx} Encourage the client to complete the free Business Assessment. Format with markdown bold and bullets.`;

  const messages: Array<{ role: "user" | "model" | "system"; content: string }> = [{ role: "system", content: system }];
  for (const h of (body.history ?? []).slice(-12)) {
    messages.push({ role: h.sender === "user" ? "user" : "model", content: h.text });
  }
  messages.push({ role: "user", content: userMessage });

  const reply = await geminiChat(c.env.GEMINI_API_KEY, messages);
  return c.json({ success: true, reply });
});

export default audit;
```

- [ ] **Step 4: Mount the router in `src/index.ts`**

```ts
import audit from "./api/audit";
// ...
app.route("/api/v1/audit", audit);
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/api.audit.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify build + commit**

Run: `npm run build`
Expected: clean.
```bash
git add src/api/audit.ts src/index.ts test/api.audit.test.ts
git commit -m "feat(api): audit funnel assess/leads/chat endpoints"
```

---

### Task 7: Audit funnel API — checkout + Stripe webhook

**Files:**
- Modify: `src/api/audit.ts` (add two routes)
- Create: `test/api.audit.payments.test.ts`

**Interfaces:**
- Consumes: `src/lib/settlement.ts` (settlementProvider, verifyStripeSignature), `src/db/workspaces.ts` (recordAuditPayment, markAuditLeadCustomer).
- Produces:
  - `POST /checkout` body `{ workspace_id?, plan?, lead? }` → `{ success: true, url }`
  - `POST /webhook/stripe` raw body + `stripe-signature` header → `{ success: true, received: true, type }`; dedupes via SESSIONS KV key `stripe:<event.id>`; records payment; marks lead customer.

- [ ] **Step 1: Write the failing payment API test**

Create `test/api.audit.payments.test.ts`:
```ts
import { env, SELF } from "cloudflare:test";
import { beforeAll, it, expect, vi } from "vitest";
import { migrate } from "../src/db/schema";
import { verifyStripeSignature } from "../src/lib/settlement";

beforeAll(async () => { await migrate(env.DB); });

function signPayload(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const mac = new TextEncoder().encode(signedPayload); // placeholder replaced in impl below
  void mac;
  return `t=${timestamp},v1=placeholder`;
}

it("mocks signature and exercises checkout + webhook end-to-end", async () => {
  // Build a real signature via the exported verifier's algorithm
  const secret = "whsec_test";
  const event = { id: "evt_1", type: "checkout.session.completed", data: { object: { customer_email: "ada@acme.com", metadata: { workspace_id: "ws-1", lead_email: "ada@acme.com", plan: "pro" }, amount_total: 99700, currency: "usd", status: "complete" } } };
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const sig = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const header = `t=${timestamp},v1=${sig}`;

  // Seed lead
  await env.DB.prepare(
    "INSERT INTO audit_leads (id, workspace_id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, unixepoch(), unixepoch())"
  ).bind(1, "ws-1", "Ada", "ada@acme.com").run();

  // Checkout
  const checkout = await SELF.fetch("http://localhost/api/v1/audit/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: "ws-1", plan: "pro", lead: { name: "Ada", email: "ada@acme.com", company: "Acme" } }),
  });
  expect(checkout.status).toBe(200);

  // Webhook
  const webhook = await SELF.fetch("http://localhost/api/v1/audit/webhook/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": header },
    body: payload,
  });
  expect(webhook.status).toBe(200);
  expect((await webhook.json())?.type).toBe("checkout.session.completed");

  const customer = await env.DB.prepare("SELECT is_customer, plan FROM audit_leads WHERE email = 'ada@acme.com'").first<{ is_customer: number; plan: string }>();
  expect(customer?.is_customer).toBe(1);
  expect(customer?.plan).toBe("pro");
  const payment = await env.DB.prepare("SELECT amount, workspace_id FROM audit_payments WHERE stripe_event_id = 'evt_1'").first<{ amount: number; workspace_id: string }>();
  expect(payment?.amount).toBe(99700);
  expect(payment?.workspace_id).toBe("ws-1");

  // Replay is deduped (200, no duplicate rows)
  const replay = await SELF.fetch("http://localhost/api/v1/audit/webhook/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": header },
    body: payload,
  });
  expect(replay.status).toBe(200);
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_payments WHERE stripe_event_id = 'evt_1'").first<{ n: number }>();
  expect(count?.n).toBe(1);

  // Bad signature rejected
  const bad = await SELF.fetch("http://localhost/api/v1/audit/webhook/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
    body: payload,
  });
  expect(bad.status).toBe(400);
});
```

Note: the exported `verifyStripeSignature` import in this test is intentionally unused except as a seam — the webhook route must use the same algorithm internally (implemented in `src/lib/settlement.ts`, Task 4).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/api.audit.payments.test.ts`
Expected: FAIL (404 / no checkout route).

- [ ] **Step 3: Add checkout + webhook routes in `src/api/audit.ts`**

Append inside the file (before `export default audit;`), and add the import at the top:
```ts
import { settlementProvider } from "../lib/settlement";
import { recordAuditPayment, markAuditLeadCustomer } from "../db/workspaces";
```

```ts
audit.post("/checkout", async (c) => {
  const body = await c.req.json<{
    workspace_id?: string; plan?: "pro" | "enterprise";
    lead?: { name?: string; email?: string; company?: string };
  }>();
  const workspace_id = body.workspace_id ?? "ws-public";

  const provider = settlementProvider(c.env);
  if (!provider) return c.json({ success: false, error: "Stripe is not configured." }, 500);

  const appUrl = c.env.APP_URL ?? "https://clawdyclaw.com";
  const plan = body.plan === "enterprise" ? "enterprise" : "pro";
  const out = await provider.createCheckout({
    plan,
    lead: body.lead,
    workspaceId: workspace_id,
    successUrl: `${appUrl}/audit?status=success&plan=${plan}`,
    cancelUrl: `${appUrl}/audit?status=canceled`,
  });
  if (!out.ok) return c.json({ success: false, error: out.error }, 500);
  return c.json({ success: true, url: out.url });
});
```

```ts
audit.post("/webhook/stripe", async (c) => {
  const rawBody = await c.req.text();
  const sig = c.req.header("stripe-signature");
  const provider = settlementProvider(c.env);

  if (provider && c.env.STRIPE_WEBHOOK_SECRET) {
    const check = await provider.verifyWebhook(rawBody, sig, c.env.STRIPE_WEBHOOK_SECRET);
    if (!check.valid) return c.json({ error: "Invalid signature." }, 400);
    const event = check.event!;

    if (c.env.SESSIONS) {
      const processed = await c.env.SESSIONS.get(`stripe:${event.id}`);
      if (processed) return c.json({ message: "Webhook already processed", received: true });
      await c.env.SESSIONS.put(`stripe:${event.id}`, "processed", { expirationTtl: 86400 * 7 });
    }

    const obj = (event.data?.object ?? {}) as Record<string, unknown>;
    const metadata = (obj.metadata ?? {}) as Record<string, string>;
    const workspace_id = metadata.workspace_id ?? "ws-public";
    const customerEmail = String(obj.customer_email ?? metadata.lead_email ?? "").toLowerCase();
    const plan = metadata.plan ?? "pro";
    const amount = typeof obj.amount_total === "number" ? obj.amount_total : typeof obj.amount_paid === "number" ? obj.amount_paid : null;

    await recordAuditPayment(c.env.DB, {
      workspace_id,
      stripe_event_id: event.id,
      stripe_customer_id: obj.customer ? String(obj.customer) : undefined,
      stripe_subscription_id: obj.subscription ? String(obj.subscription) : undefined,
      customer_email: customerEmail || undefined,
      plan,
      amount: amount ?? undefined,
      currency: obj.currency ? String(obj.currency) : undefined,
      status: obj.status ? String(obj.status) : undefined,
      event_type: event.type,
      payload: rawBody.slice(0, 4000),
    });

    if (customerEmail) {
      await markAuditLeadCustomer(c.env.DB, workspace_id, customerEmail, plan);
    }

    return c.json({ success: true, received: true, type: event.type });
  }

  return c.json({ error: "Stripe webhook is not configured." }, 500);
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/api.audit.payments.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify build + commit**

Run: `npm run build`
Expected: clean.
```bash
git add src/api/audit.ts test/api.audit.payments.test.ts
git commit -m "feat(api): audit checkout + verified Stripe webhook"
```

---

### Task 8: Studio nav restructure — Workspaces front door, Engine Room behind

**Files:**
- Modify: `src/components/studio/studio-shell.tsx`
- Modify: `src/pages/studio-page.tsx`

**Interfaces:**
- Consumes: `StudioShell` props (`nav: NavItem[]`, `activePath`, `onNavigate`, `widgetFeedAction`, `children`).
- Produces: `NavItem` gains optional `group?: string`; shell renders group headers. `StudioPage` NAV splits into `Front Door` (Workspaces) + `Engine Room` (Command Center, Approval Queue, Telemetry, Tool Registry, Models, Sandbox, API Vault, CLI). Route changes: `/studio` = workspaces; `/studio/command` = command center.

- [ ] **Step 1: Add group support to `studio-shell.tsx`**

In `src/components/studio/studio-shell.tsx`, extend the interface and render group headers:
```ts
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: string;
  group?: string;
}
```
In the `<nav>` map, insert a group label when `item.group` differs from the previous item's group:
```tsx
{nav.map((item, i) => {
  const prev = nav[i - 1];
  const showGroup = item.group && item.group !== prev?.group;
  return (
    <React.Fragment key={item.path}>
      {showGroup && !collapsed && (
        <div className="px-3 pt-4 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {item.group}
        </div>
      )}
      <button
        onClick={() => onNavigate(item.path)}
        title={item.label}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition cursor-pointer",
          activePath === item.path
            ? "bg-rust font-medium text-porcelain"
            : "text-muted-foreground hover:bg-muted/40 hover:text-porcelain"
        )}
      >
        <span className="flex size-4 shrink-0 items-center justify-center font-mono text-xs">{item.icon}</span>
        {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-ember">{item.badge}</span>
        )}
      </button>
    </React.Fragment>
  );
})}
```

- [ ] **Step 2: Rework `studio-page.tsx`**

```tsx
import { WorkspacesPage } from "@/pages/studio/workspaces-page";
import { WorkspaceDetailPage } from "@/pages/studio/workspace-detail-page";

type Section = "workspaces" | "command" | "queue" | "telemetry" | "tools" | "models" | "sandbox" | "vault" | "cli";

const NAV: Array<{ path: Section; label: string; icon: string; badge?: string; group?: string }> = [
  { path: "workspaces", label: "Workspaces", icon: "⌂", group: "Front Door" },
  { path: "command", label: "Command Center", icon: "◈", group: "Engine Room" },
  { path: "queue", label: "Approval Queue", icon: "⚑", badge: "HITL", group: "Engine Room" },
  { path: "telemetry", label: "Telemetry", icon: "⇄", group: "Engine Room" },
  { path: "tools", label: "Tool Registry", icon: "⚒", group: "Engine Room" },
  { path: "models", label: "Models", icon: "✦", group: "Engine Room" },
  { path: "sandbox", label: "Sandbox", icon: "◪", group: "Engine Room" },
  { path: "vault", label: "API Vault", icon: "🔑", group: "Engine Room" },
  { path: "cli", label: "CLI", icon: "›_", group: "Engine Room" },
];

const REAL_PATH: Record<Section, string> = {
  workspaces: "/studio",
  command: "/studio/command",
  queue: "/studio/queue",
  telemetry: "/studio/telemetry",
  tools: "/studio/tools",
  models: "/studio/models",
  sandbox: "/studio/sandbox",
  vault: "/studio/vault",
  cli: "/studio/cli",
};

function fromSearchPath(pathname: string): { section: Section; workspaceId: string | null } {
  const ws = /^\/studio\/workspaces\/([^/]+)/.exec(pathname);
  if (ws) return { section: "workspaces", workspaceId: ws[1] };
  if (pathname.startsWith("/studio/command")) return { section: "command", workspaceId: null };
  if (pathname.startsWith("/studio/queue")) return { section: "queue", workspaceId: null };
  if (pathname.startsWith("/studio/telemetry")) return { section: "telemetry", workspaceId: null };
  if (pathname.startsWith("/studio/tools")) return { section: "tools", workspaceId: null };
  if (pathname.startsWith("/studio/models")) return { section: "models", workspaceId: null };
  if (pathname.startsWith("/studio/sandbox")) return { section: "sandbox", workspaceId: null };
  if (pathname.startsWith("/studio/vault")) return { section: "vault", workspaceId: null };
  if (pathname.startsWith("/studio/cli")) return { section: "cli", workspaceId: null };
  return { section: "workspaces", workspaceId: null };
}
```
In the component, replace the state/effect with:
```tsx
const [route, setRoute] = React.useState(() => fromSearchPath(window.location.pathname));
const section = route.section;
const mode = "operator"; // keep existing viewParam handling

React.useEffect(() => {
  const sync = () => setRoute(fromSearchPath(window.location.pathname));
  window.addEventListener("popstate", sync);
  return () => window.removeEventListener("popstate", sync);
}, []);
```
Render:
```tsx
{section === "workspaces" && (route.workspaceId ? (
  <WorkspaceDetailPage workspaceId={route.workspaceId} onNavigate={goto} />
) : (
  <WorkspacesPage onNavigate={goto} />
))}
{section === "queue" && <ApprovalQueue mode={mode} onMode={setMode} />}
{/* ... unchanged for the other seven sections */}
```
Keep the existing `mode` state + `viewParam` and pass `mode` to the seven engine-room pages exactly as today.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/studio-shell.tsx src/pages/studio-page.tsx
git commit -m "feat(studio): workspaces front door, engine room group behind"
```
Note: `workspaces-page`/`workspace-detail-page` imports do not exist yet — they are created in Tasks 9–10. If the build fails at this commit on those imports, commit the shell change without the two imports (leave `section === "workspaces"` rendering a placeholder `<div>Workspaces</div>`) and add the imports in Task 10. Prefer the placeholder approach to keep every commit green.

- [ ] **Step 5 (if placeholder used): revert placeholder in Task 10**

When `workspaces-page.tsx` + `workspace-detail-page.tsx` exist, swap the placeholder for the real imports.

---

### Task 9: Workspaces list page (front door)

**Files:**
- Create: `src/pages/studio/workspaces-page.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/workspaces`, `POST /api/v1/workspaces`.
- Produces: `<WorkspacesPage onNavigate: (path: string) => void />` — cards per workspace: name, client, playbook badge, status, leads/customers/revenue, Open + New buttons.

- [ ] **Step 1: Write the page**

Create `src/pages/studio/workspaces-page.tsx`:
```tsx
import * as React from "react";
import { SectionHeader } from "@/components/studio/section-header";

interface WorkspaceRow {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  playbook: string;
  status: string;
  lead_count: number;
  customer_count: number;
  revenue: number;
}

export function WorkspacesPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [rows, setRows] = React.useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/workspaces");
      if (!res.ok) throw new Error("Failed to load workspaces");
      const data = (await res.json()) as { workspaces: WorkspaceRow[] };
      setRows(data.workspaces);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const create = async () => {
    const name = window.prompt("Workspace name (e.g. Acme Audit)");
    if (!name) return;
    const client = window.prompt("Client name (optional)") ?? undefined;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, client_name: client || undefined, playbook: "ai_audit" }),
      });
      if (!res.ok) throw new Error("Create failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader
          eyebrow="Front Door"
          title="Workspaces"
          description="Client engagements. Each workspace runs a playbook and shows the actual results — leads, revenue, deliveries."
        />
        <button
          onClick={() => void create()}
          disabled={creating}
          className="rounded-md border border-ember/40 bg-rust px-3 py-2 text-sm font-semibold text-chrome transition hover:bg-ember disabled:opacity-50 cursor-pointer"
        >
          + New Workspace
        </button>
      </div>

      {error && <div className="rounded-md border border-ember/40 bg-rust/20 px-4 py-3 text-sm text-ember">{error}</div>}
      {loading && <p className="font-mono text-sm text-muted-foreground">loading workspaces…</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-md border border-silver/20 p-10 text-center">
          <p className="text-sm text-muted-foreground">No workspaces yet — create your first client engagement.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((w) => (
          <button
            key={w.id}
            onClick={() => onNavigate(`/studio/workspaces/${w.id}`)}
            className="rounded-lg border border-silver/20 bg-obsidian/60 p-5 text-left transition hover:border-silver/40 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-semibold text-porcelain">{w.name}</h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{w.playbook}</span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {w.client_name ?? "No client"} {w.client_email ? `• ${w.client_email}` : ""}
            </p>
            <div className="mt-4 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
              <span className="text-porcelain">⚑ {w.lead_count} leads</span>
              <span className="text-porcelain">◉ {w.customer_count} customers</span>
              <span className="text-ember">${(w.revenue / 100).toFixed(2)}</span>
              <span className="ml-auto rounded-full border border-silver/20 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                {w.status}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```
(If `SectionHeader`'s prop names differ, match the existing usage in `src/pages/studio/command-center.tsx`.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean (with the placeholders from Task 8 swapped for the real imports).

- [ ] **Step 3: Commit**

```bash
git add src/pages/studio/workspaces-page.tsx
git commit -m "feat(studio): workspaces list page (front door)"
```

---

### Task 10: Workspace detail page (engagement view)

**Files:**
- Create: `src/pages/studio/workspace-detail-page.tsx`
- Modify: `src/pages/studio-page.tsx` (swap placeholder for real detail import, if used)

**Interfaces:**
- Consumes: `GET /api/v1/workspaces/:id` → `{ workspace, leads, payments, reports }`, `PATCH /api/v1/workspaces/:id` `{ status }`.
- Produces: `<WorkspaceDetailPage workspaceId: string, onNavigate: (path: string) => void />` — stat tiles, leads table, payments table, reports list, status actions, "Open audit funnel" link to `/audit?workspace=<id>`.

- [ ] **Step 1: Write the page**

Create `src/pages/studio/workspace-detail-page.tsx`:
```tsx
import * as React from "react";
import { SectionHeader } from "@/components/studio/section-header";

interface Lead { id: number; name: string | null; email: string; company: string | null; readiness_score: number | null; is_customer: number; plan: string | null; created_at: number }
interface Payment { id: number; plan: string | null; amount: number | null; currency: string | null; status: string | null; created_at: number }
interface Report { id: number; client_name: string | null; readiness_score: number | null; created_at: number }

export function WorkspaceDetailPage({ workspaceId, onNavigate }: { workspaceId: string; onNavigate: (path: string) => void }) {
  const [data, setData] = React.useState<{ workspace: { name: string; client_name: string | null; status: string; playbook: string }; leads: Lead[]; payments: Payment[]; reports: Report[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}`);
      if (!res.ok) throw new Error("Failed to load workspace");
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [workspaceId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const setStatus = async (status: "active" | "paused" | "closed") => {
    await fetch(`/api/v1/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void refresh();
  };

  if (error) return <div className="rounded-md border border-ember/40 bg-rust/20 px-4 py-3 text-sm text-ember">{error}</div>;
  if (!data) return <p className="font-mono text-sm text-muted-foreground">loading workspace…</p>;

  const revenue = data.payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          eyebrow="Client Engagement"
          title={data.workspace.name}
          description={`${data.workspace.client_name ?? "No client"} • ${data.workspace.playbook} • ${data.workspace.status}`}
        />
        <div className="flex items-center gap-2">
          <button onClick={() => onNavigate(`/audit?workspace=${workspaceId}`)} className="rounded-md border border-ember/40 bg-rust px-3 py-2 text-sm font-semibold text-chrome transition hover:bg-ember cursor-pointer">
            Open audit funnel
          </button>
          {(["active", "paused", "closed"] as const).map((s) => (
            <button key={s} onClick={() => void setStatus(s)} className="rounded-md border border-silver/20 px-2 py-1.5 text-xs capitalize text-muted-foreground transition hover:text-porcelain cursor-pointer">
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Leads", value: data.leads.length },
          { label: "Customers", value: data.leads.filter((l) => l.is_customer === 1).length },
          { label: "Revenue", value: `$${(revenue / 100).toFixed(2)}` },
          { label: "Reports", value: data.reports.length },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-silver/20 bg-obsidian/60 p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className="mt-2 text-2xl font-semibold text-porcelain">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-silver/20 p-5">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Leads</h3>
          {data.leads.length === 0 && <p className="text-sm text-muted-foreground">No leads yet.</p>}
          <div className="space-y-2">
            {data.leads.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-porcelain">{l.name ?? l.email}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{l.email}{l.readiness_score != null ? ` • score ${l.readiness_score}` : ""}</p>
                </div>
                <span className={`font-mono text-[10px] uppercase tracking-wider ${l.is_customer === 1 ? "text-ember" : "text-muted-foreground"}`}>
                  {l.is_customer === 1 ? `customer${l.plan ? ` • ${l.plan}` : ""}` : "lead"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-silver/20 p-5">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Payments</h3>
          {data.payments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-3 py-2">
                <span className="font-mono text-xs capitalize text-muted-foreground">{p.plan ?? "plan"}</span>
                <span className="font-mono text-sm text-porcelain">{(p.amount ?? 0) / 100} {p.currency?.toUpperCase() ?? "USD"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-silver/20 p-5">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Reports</h3>
        {data.reports.length === 0 && <p className="text-sm text-muted-foreground">No reports yet.</p>}
        <div className="space-y-2">
          {data.reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-3 py-2">
              <span className="truncate text-sm text-porcelain">{r.client_name ?? "Anonymous"}</span>
              <span className="font-mono text-[10px] text-muted-foreground">score {r.readiness_score ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/pages/studio/workspace-detail-page.tsx src/pages/studio-page.tsx
git commit -m "feat(studio): workspace detail page with engagement stats"
```

---

### Task 11: Audit funnel front-end (port from AI-Auditing-template.Clawdy)

**Files:**
- Create: `src/pages/audit-funnel-page.tsx`
- Create: `src/components/audit/types.ts`, `src/components/audit/assessment-form.tsx`, `src/components/audit/assessment-report.tsx`, `src/components/audit/email-gate.tsx`, `src/components/audit/auditor-chat.tsx`, `src/components/audit/pricing-page.tsx`, `src/components/audit/landing-page.tsx`, `src/components/audit/tools-explorer.tsx`, `src/components/audit/curated-tools.ts`
- Modify: `src/App.tsx` (route `/audit`)

**Interfaces:**
- Consumes: `/api/v1/audit/assess`, `/api/v1/audit/leads`, `/api/v1/audit/chat`, `/api/v1/audit/checkout`.
- Produces: `<AuditFunnelPage />` mounted at `/audit`; reads `?workspace=` for workspace_id; `workspace_id` defaults to `ws-public`.
- Source: copy components from `/home/book/AI-Auditing-template.Clawdy/src/components/*` and `/home/book/AI-Auditing-template.Clawdy/src/types.ts` + `src/data/curatedTools.ts`, adapting:
  - Imports `motion/react` → `framer-motion`
  - API calls `/api/assess` → `/api/v1/audit/assess`, `/api/leads` → `/api/v1/audit/leads`, `/api/chat` → `/api/v1/audit/chat`, `/api/checkout` → `/api/v1/audit/checkout`
  - Every request body gains `workspace_id` (from `?workspace=` or `"ws-public"`)
  - `localStorage` keys stay `ai_audit_*` (harmless, isolated to /audit)

- [ ] **Step 1: Port types + static data**

Copy `/home/book/AI-Auditing-template.Clawdy/src/types.ts` → `src/components/audit/types.ts` (unchanged content).
Copy `/home/book/AI-Auditing-template.Clawdy/src/data/curatedTools.ts` → `src/components/audit/curated-tools.ts` (unchanged content).

- [ ] **Step 2: Port the components**

Copy each component file from `/home/book/AI-Auditing-template.Clawdy/src/components/` to `src/components/audit/` with these mechanical rewrites (apply to ALL copied components):
1. `import { motion, AnimatePresence } from "motion/react"` → `import { motion, AnimatePresence } from "framer-motion"`
2. Relative imports `./types` → `./types`, `./curatedTools` → `./curated-tools`, `./components/X` → nothing needed (flat directory).
3. No other behavioral changes to the components themselves.

- [ ] **Step 3: Port the page shell (App.tsx → audit-funnel-page.tsx)**

Copy `/home/book/AI-Auditing-template.Clawdy/src/App.tsx` → `src/pages/audit-funnel-page.tsx` and:
1. Change `motion/react` → `framer-motion` imports.
2. Component imports point to `@/components/audit/*`.
3. Replace `getInitialView` hostname check with `const params = new URLSearchParams(window.location.search); return params.get("status") ? "app" : "landing";` (no logiclemon host).
4. Add near the top of the component: `const workspaceId = new URLSearchParams(window.location.search).get("workspace") ?? "ws-public";`
5. In `handleAssessmentSubmit`: body becomes `JSON.stringify({ ...formAnswers, workspace_id: workspaceId })`.
6. In `handleEmailGateSubmit`: body becomes `JSON.stringify({ ...lead, workspace_id: workspaceId, source: "email_gate", readinessScore })`.
7. In `handleCheckout` (inside `PricingPage` usage — see below): pass `workspace_id` through. If the ported `PricingPage` exposes its own checkout fetch, wrap the funnel page's pricing render to inject `workspace_id` into the checkout body via a prop or a module-level constant exported from the page.
   Simplest compliant approach: in `audit-funnel-page.tsx`, export a const: `export const AUDIT_WORKSPACE = ...` is NOT used — instead, when rendering `<PricingPage>` pass `workspaceId` if the ported PricingPage accepts it; otherwise patch PricingPage's fetch call to include `workspace_id` from `window.localStorage.getItem("ai_audit_workspace")` — so also add: `useEffect(() => localStorage.setItem("ai_audit_workspace", workspaceId), [workspaceId])`.
8. Keep the email gate, chat, tabs, footer, and localStorage session restore exactly as in the original.

- [ ] **Step 4: Update `src/App.tsx` route**

Add import + route branch:
```tsx
import AuditFunnelPage from "@/pages/audit-funnel-page";
// in App():
const isAudit = path.startsWith("/audit");
if (isAudit) return <AuditFunnelPage />;
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/pages/audit-funnel-page.tsx src/components/audit/ src/App.tsx
git commit -m "feat(funnel): port AI-audit funnel to /audit with workspace scoping"
```

---

### Task 12: HackerNoon voice widget

**Files:**
- Create: `src/components/widgets/hackernoon-voice-widget.tsx`
- Modify: `src/pages/studio/workspaces-page.tsx` (optional right-rail mount)

**Interfaces:**
- Produces: `<HackerNoonVoiceWidget />` — voice-reader card (Dr. One / Ms. Hacker / Madam Beckham / Ali Mohat), story list, progress/play state; per `hackernoon.txt` design.
- Anchored to: `hackernoon.txt` (repo root) — the widget "connects HackerNoon's reader" as a studio surface; synthetic audio fetch documented in `HACKERNOON_VOICE_INTEGRATION`.

- [ ] **Step 1: Write the widget**

Create `src/components/widgets/hackernoon-voice-widget.tsx` from the sketch in `hackernoon.txt` (the STORIES + VOICES arrays and JSX in the txt are the spec; convert `bg-[#121214]`/white-on-dark to the studio's obsidian/porcelain tokens and use `cn`):
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

type HackerNoonStory = { id: string; title: string; author: string; timeAgo: string; audioUrl?: string; text?: string };

const STORIES: HackerNoonStory[] = [
  { id: "1", title: "The End of Prompt-and-Hope AI Development", author: "Maksym Strizhov", timeAgo: "10h ago" },
  { id: "2", title: "Why Speech Recognition Misses Human Context", author: "Nica Furs", timeAgo: "10h ago" },
  { id: "3", title: "React Activity: When A Render No Longer Guarantees an Effect", author: "Social Discovery Group", timeAgo: "10h ago" },
  { id: "4", title: "From CV to Proof of Contributions", author: "Verlaine j muhungu", timeAgo: "11h ago" },
  { id: "5", title: "5 Principles to Make Your Tech Product Hard to Ignore", author: "Daria Volkova", timeAgo: "11h ago" },
  { id: "6", title: "Congratulations on Your Flawless AI Agent", author: "Muin Can Kisi", timeAgo: "11h ago" },
];

const VOICES = [
  { id: "dr-one", name: "Dr. One", color: "#60A5FA" },
  { id: "ms-hacker", name: "Ms. Hacker", color: "#34D399" },
  { id: "madam-beckham", name: "Madam Beckham", color: "#F472B6" },
  { id: "ali-mohat", name: "Ali Mohat", color: "#FBBF24" },
];

export function HackerNoonVoiceWidget() {
  const [currentStory, setCurrentStory] = React.useState(STORIES[0]);
  const [currentVoice, setCurrentVoice] = React.useState(VOICES[0]);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (!isPlaying) return;
    const t = window.setInterval(() => setProgress((p) => (p + 0.5) % 100), 200);
    return () => window.clearInterval(t);
  }, [isPlaying]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-silver/20 bg-obsidian/60">
      <div className="flex items-center justify-between border-b border-silver/20 bg-obsidian/95 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded bg-ember/20 font-mono text-xs font-bold text-ember">H</span>
          <span className="text-xs font-semibold text-porcelain">HackerNoon Voice</span>
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400">● LIVE</span>
        </div>
        <div className="flex items-center gap-1">
          {VOICES.map((v) => (
            <button
              key={v.id}
              onClick={() => setCurrentVoice(v)}
              title={v.name}
              className={cn(
                "h-6 rounded-full px-2 text-[9px] font-medium transition-all cursor-pointer",
                currentVoice.id === v.id ? "bg-porcelain text-obsidian" : "bg-white/[0.06] text-muted-foreground hover:bg-white/[0.12]"
              )}
              style={{ borderColor: v.color }}
            >
              {v.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-silver/20 p-3">
        <p className="line-clamp-2 text-xs font-medium leading-tight text-porcelain">{currentStory.title}</p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{currentStory.author} • {currentStory.timeAgo} • {currentVoice.name}</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setIsPlaying((v) => !v)}
            className="flex size-6 items-center justify-center rounded-full bg-porcelain text-[10px] text-obsidian hover:bg-porcelain/90 cursor-pointer"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.1]">
            <div className="h-full bg-ember transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          <span className="font-mono text-[9px] text-muted-foreground">{Math.floor(progress)}%</span>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {STORIES.map((s) => (
          <button
            key={s.id}
            onClick={() => { setCurrentStory(s); setIsPlaying(true); setProgress(0); }}
            className={cn(
              "flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors cursor-pointer",
              currentStory.id === s.id ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
            )}
          >
            <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", currentStory.id === s.id ? "bg-ember" : "bg-muted-foreground")} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[11px] leading-tight text-porcelain/80">{s.title}</span>
              <span className="mt-1 block font-mono text-[9px] text-muted-foreground/70">{s.author} • {s.timeAgo}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="border-t border-silver/20 bg-obsidian/95 px-3 py-1.5">
        <p className="font-mono text-[9px] text-muted-foreground">tag:ai • synthetic audio • 70k+ stories • listen while you work</p>
      </div>
    </div>
  );
}

export const HACKERNOON_VOICE_INTEGRATION = {
  api: "HackerNoon synthetic audio is available for 70k+ stories",
  how: "Each story has an /audio endpoint — fetch audioUrl and play in the widget. Fallback: Cloudflare Workers AI TTS (@cf/myshell-ai/melotts).",
  widget_mount: "Workspaces front door → HackerNoon voice widget",
};
```

- [ ] **Step 2: Mount on the Workspaces page**

In `src/pages/studio/workspaces-page.tsx`, add the import and a right-rail block below the grid:
```tsx
import { HackerNoonVoiceWidget } from "@/components/widgets/hackernoon-voice-widget";
// after the grid div:
<div className="mt-6 h-64">
  <HackerNoonVoiceWidget />
</div>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/widgets/hackernoon-voice-widget.tsx src/pages/studio/workspaces-page.tsx
git commit -m "feat(widget): HackerNoon voice reader on workspaces front door"
```

---

### Task 13: wrangler cleanup + deploy runbook

**Files:**
- Modify: `wrangler.jsonc`

**Interfaces:**
- Produces: a clean worker config (dead `facebook.clawdyclaw.com` / `fb.clawdyclaw.com` routes removed) and a documented deploy sequence.

- [ ] **Step 1: Remove dead subdomain routes**

In `wrangler.jsonc`, delete the two route entries:
```jsonc
{ "pattern": "facebook.clawdyclaw.com", "custom_domain": true },
{ "pattern": "fb.clawdyclaw.com", "custom_domain": true },
```
Keep `agents.clawdyclaw.com` and `landing.clawdyclaw.com`.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add wrangler.jsonc
git commit -m "chore: drop dead facebook subdomain routes from wrangler config"
```

- [ ] **Step 4: Document the deploy runbook (no code)**

Add to `README.md` (or `docs/deploy.md` if README is absent) a Deploy section:
```markdown
## Deploy (workspaces + audit funnel)

1. Migrate: `npx wrangler d1 execute clawdyclaw-db --remote --file=migrations/0005_workspaces_audit.sql`
2. Secrets: `npx wrangler secret put GEMINI_API_KEY` (value from your Gemini project key)
3. Secrets: `npx wrangler secret put STRIPE_SECRET_KEY` (live key from the Stripe dashboard)
4. Secrets: `npx wrangler secret put STRIPE_WEBHOOK_SECRET`
5. Vars: set `STRIPE_PRICE_PRO` / `STRIPE_PRICE_ENTERPRISE` (Stripe Price IDs) — `npx wrangler secret put` or `vars`
6. Deploy: `npm run deploy`
7. Verify: `curl https://clawdyclaw.com/api/health` and `curl https://clawdyclaw.com/api/v1/workspaces`
```

- [ ] **Step 5: Commit**

```bash
git add README.md docs/deploy.md
git commit -m "docs: deploy runbook for workspaces + audit funnel"
```

---

### Task 14: Designer pass (visual identity + color scheme)

**Files:**
- Scope: `src/pages/studio/workspaces-page.tsx`, `src/pages/studio/workspace-detail-page.tsx`, `src/pages/audit-funnel-page.tsx`, `src/components/audit/*`, `src/components/widgets/hackernoon-voice-widget.tsx`, and the studio theme tokens if needed.

**Lane:** Dispatch to @designer (visual/UX authority) with the instruction that the functional structure from Tasks 1–13 is frozen — design may refactor layout, spacing, hierarchy, motion, and the color scheme, but must not change routes, API calls, or component props. Copy review afterward (orchestrator) without altering visual intent.

- [ ] **Step 1: Dispatch designer lane**

Prompt: "Polish the visual identity of the new Clawdy studio front: workspaces list/detail pages, audit funnel, HackerNoon voice widget. The color scheme is missing its design — establish a coherent palette on top of the existing obsidian/porcelain/ember tokens, unify card/stat treatments, spacing rhythm, and empty states. Do not change routes, API calls, props, or the HITL behavior. Verify with npm run build."

- [ ] **Step 2: Verify build + review copy**

Run: `npm run build` (clean), review user-facing copy for clarity without changing visual intent.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "design: polish workspaces front door, funnel, and voice widget"
```

---

## Self-Review

**1. Spec coverage:**
- Workspace = client engagement → Tasks 2, 3, 5, 8, 9, 10 ✓
- Playbook B funnel (assess → report → email gate → chat → Stripe → customer) → Tasks 2, 4, 6, 7, 11 ✓
- Settlement adapter with Stripe now, wallet slots later → Task 4 (+ interface reused in 7) ✓
- Plumbing behind-the-curtain (Engine Room) → Task 8 ✓
- OAuth already done → untouched (constraint) ✓
- HackerNoon voice widget file → Task 12 ✓
- MCP-Storybook = puppyclaw → untouched (constraint) ✓
- Dead facebook routes → Task 13 ✓

**2. Placeholder scan:** Every task has concrete file paths, code, and commands. Task 8's Step 1/4 explicitly resolves the temporary placeholder import ordering. No TBD/TODO steps.

**3. Type consistency:** `settlementProvider(env)` returns `SettlementProvider | null` (Task 4) and is consumed as `provider` in Task 7 ✓. `upsertAuditLead`/`createAuditReport`/`recordAuditPayment`/`markAuditLeadCustomer` signatures from Task 3 match Task 6/7 usage ✓. `fromSearchPath` returns `{ section, workspaceId }` and Task 8's render uses `route.workspaceId` consistently ✓. `WorkspaceStatus` union used in Task 3 + Task 5 PATCH validation ✓. `SectionHeader` usage flagged for prop-name verification against command-center.tsx usage ✓.