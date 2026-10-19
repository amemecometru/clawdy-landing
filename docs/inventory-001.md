# inventory-001 — clawdyclaw project inventory

Read-only inventory per brief-000. No code, config, or dependency was changed.
Repo: `/home/book/clawdy-landing`. Branch `main` @ `d647a4d`.

---

## 1. Full file tree of `src/`

```
src/.test-file.txt                      (gitignored; see §6)
src/App.tsx
src/index.ts
src/main.tsx
src/api/(audio)hackernoon.txt           (untracked; see §6)
src/api/campaigns.ts
src/api/executor.ts
src/api/feeds.ts
src/api/infer.ts
src/api/integrations.ts
src/api/mcp.ts
src/api/models.ts
src/api/outreach.ts
src/api/professionals-payment.ts
src/api/professionals.ts
src/api/proxy-bridge.ts
src/api/qualify.ts
src/api/sandbox.ts
src/api/tasks.ts
src/api/telemetry.ts
src/api/tools.ts
src/api/webhook.ts
src/api/v1/                             (EMPTY directory)
src/api/v1/webhook/                     (EMPTY directory)
src/auth/auth.ts
src/components/auth/auth-card.tsx
src/components/site-header.tsx
src/components/sections/agent-playground.tsx
src/components/sections/agent-stack-grid.tsx
src/components/sections/hero-section.tsx
src/components/sections/knowledge-base.tsx
src/components/sections/live-metrics-feed.tsx
src/components/sections/pricing-matrix.tsx
src/components/sections/protocol-matrix.tsx
src/components/sections/safety-shields.tsx
src/components/sections/site-footer.tsx
src/components/sections/vault.tsx
src/components/sections/view-mode-toggle.tsx
src/components/studio/approval-card.tsx
src/components/studio/live-feed-widget.tsx
src/components/studio/mcp-json-view.tsx
src/components/studio/section-header.tsx
src/components/studio/studio-shell.tsx
src/components/studio/telemetry-stream.tsx
src/components/studio/view-mode-toggle.tsx
src/components/studio/widget-feed-drawer.tsx
src/components/ui/accordion.tsx
src/components/ui/badge.tsx
src/components/ui/button.tsx
src/components/ui/card.tsx
src/components/ui/field.tsx
src/components/ui/infinity-scroller-nav.tsx
src/components/ui/input.tsx
src/components/ui/number-ticker.tsx
src/components/ui/section-shell.tsx
src/db/campaigns.ts
src/db/professionals-payment.ts
src/db/professionals.ts
src/db/schema.ts
src/db/sessions.ts
src/db/tasks.ts
src/db/vault.ts
src/lib/api.ts
src/lib/brand.ts
src/lib/feed-platforms.ts
src/lib/price-table.ts
src/lib/professionals-payment.ts
src/lib/qualify.ts
src/lib/require-auth.ts
src/lib/session.ts
src/lib/utils.ts
src/lib/x402.ts
src/pages/login-page.tsx
src/pages/studio-page.tsx
src/pages/studio/approval-queue.tsx
src/pages/studio/cli-page.tsx
src/pages/studio/command-center.tsx
src/pages/studio/models-page.tsx
src/pages/studio/sandbox-page.tsx
src/pages/studio/telemetry-page.tsx
src/pages/studio/tool-registry.tsx
src/pages/studio/vault-page.tsx
src/styles/globals.css
```

Directories that exist: `src/api`, `src/api/v1`, `src/api/v1/webhook` (both empty),
`src/auth`, `src/components{,/auth,/sections,/studio,/ui}`, `src/db`, `src/lib`,
`src/pages`, `src/pages/studio`, `src/styles`.

**Directories that do NOT exist** (explicitly checked):
- `src/agents/` — **not found**.
- `src/durable-objects/` — not found (a repo-root `durable-objects/` exists, empty).

---

## 2. Key files

### `src/lib/x402.ts` — exists, 885 lines
Single module for the x402 payment rail (prices, 402 body, facilitator
verify/settle, PAYMENT-CONTEXT JWT, idempotency store, Bazaar discovery,
buyer client). USDC on Base, 6 decimals.
- **Facilitator URL source:** default is `https://facilitator.payai.network`
  (`X402_DEFAULT_FACILITATOR`, line 93); overridable by env
  `X402_FACILITATOR_URL` (resolved at line 234).
- **`payTo` address source:** env only — `X402_PAY_TO_ADDRESS` (lines 144-145,
  224-227). Validated against `/^0x[0-9a-fA-F]{40}$/`; never hardcoded.
- Network chosen from `X402_NETWORK` (default `base-sepolia`); mainnet `base`
  additionally requires `X402_MAINNET=true` (lines 198-211).

### `src/lib/price-table.ts` — exists, 78 lines
`PRICE_TABLE` mirrors `TOOL_DEFS` as frozen data for the audit.
- **Tool count:** 35 (`PRICE_TABLE` = one entry per `TOOL_DEFS` entry; both are 35).
- **Price format:** `price_usd` (number, 6-decimal USD, e.g. `0.250000`) and
  `price_atomic` (string, USDC atomic units at 6 decimals, via `toAtomicUnits()`).

### `src/index.ts` — exists, 287 lines
Hono worker entry. Note: **the x402 gate is NOT in this file** — it lives in
`src/api/mcp.ts`. Routes mounted here, in order:
`/api/*` CORS (87) → `/api/auth` (96) → `/api/v1/webhook` (100) →
`/api/v1/tasks` (104) → `/api/v1` integrations (108) → `/api/v1/telemetry` (112)
→ `/api/v1/sandbox` (116) → `/api/v1` feeds (120) → `/api/v1` models (124) →
`/api/v1` tools (128) → `/api/v1/professionals` (132) →
`/api/v1/professionals/payment` (138) → `/api/v1/campaigns` (142) →
`/api/v1/qualify` (146) → `POST /mcp/v1` and `POST /mcp/v1/` (159-160) →
`GET /mcp/v1/manifest.json` (163) → `GET /api/health` (193) →
`GET /.well-known/mcp.json` (251) → catch-all 404 (255).
`export default.fetch` runs `ensureDB()` (D1 migrate) before dispatch (270-274);
there is also a `scheduled` cron handler (281-286). No queue handler is exported.

### `wrangler.jsonc` — exists, 86 lines, JSONC
- **Format version:** no explicit format-version field; `"$schema"` points at
  `node_modules/wrangler/config-schema.json`. `compatibility_date` =
  `2026-09-01`, `compatibility_flags` = `["nodejs_compat"]`.
- **Bindings:** `DB` (D1 `clawdyclaw-db`, migrations_dir `migrations`),
  `SESSIONS` (KV), `AI` (AI), `EMAIL` (`send_email`), `BROWSER` (browser),
  `STORAGE` (R2 `clawdyclaw-storage`), `TASK_QUEUE` (queue **producer only**).
- **Migrations:** the only occurrence of "migrations" is the D1 `migrations_dir`.
  There is **no `durable_objects` block and no `migrations` DO block.**
- **`X402_*` vars:** none (`grep -c X402 wrangler.jsonc` → 0).
- **Not tracked by git:** `wrangler.jsonc` is listed in `.gitignore` line 25 and
  `git ls-files` returns nothing (see §6).

### Test files — 13 files, 3182 lines (`wc -l`)
`test/{api-auth, brand, campaign-messages, professionals-payment, qualify-api,
qualify, schema, smoke, track-a-proofs, x402-settlement, x402-testnet.live,
x402, zz-proof}.test.ts`. Coverage by describe block:
- api-auth — professional API auth gate.
- brand — domain + tier helpers; default sections.
- campaign-messages — default campaign message builder.
- professionals-payment — workflow tiers, `/tiers`, Stripe checkout,
  `verifyStripeSignature`, crypto checkout, checkout ownership (24 tests).
- qualify / qualify-api — `qualifyProfessional`, `POST /api/v1/qualify/professional`.
- schema — professional brand schema.
- track-a-proofs — third-party discovery + third-party transaction proofs.
- x402-settlement — requirements, network select, `verifyX402Payment`,
  PAYMENT-CONTEXT, idempotent replay, `withX402Client`, `_meta` payload,
  already-settled replay (35 tests).
- x402 — `toAtomicUnits`, `priceUsd`, `requiresPayment`, bypass, requirements,
  verify, MCP gate order + MCP x402 gate (44 tests).
- x402-testnet.live / zz-proof — live testnet settlement proofs
  (both `describe.skipIf(!X402_BUYER_PRIVATE_KEY)`).
- smoke — remote `/api/health` check; **excluded** from the default suite by
  `vitest.config.ts` (opt-in via `npm run test:smoke`).

**Last run (executed for this inventory, `npm test`):** 19.02s.
`Test Files 10 passed | 2 skipped (12)`; `Tests 139 passed | 2 skipped (141)`.
The 2 skipped files/tests are `x402-testnet.live.test.ts` and
`zz-proof.test.ts` (no `X402_BUYER_PRIVATE_KEY` in env). `smoke.test.ts` is
excluded by config, not run.

---

## 3. x402 flow as it stands TODAY (from code, not docs)

Gate order in `src/api/mcp.ts` `tools/call`:

1. **Session gate → 401** (mcp.ts:212-217). `tools/list` is public; invocation
   requires a signed-in operator. Unavailable `SESSIONS` binding → fail closed.
2. **x402 payment gate → 402** (mcp.ts:237-277). `priceUsd(name)` looked up;
   when `requiresPayment(usd)` and not `devBypassEnabled`, `resolveX402Config`
   runs (503 `-32003` if the rail is unconfigured), then `verifyX402Payment`.
   On failure: idempotency replay is checked first; otherwise the SDK-built 402
   body is returned with `paymentRequiredHeaders` (lines 267-274).
3. **Idempotency pre-check** (mcp.ts:283-292). Replay → stored result;
   conflict → 409 `-32001`.
4. **Interception Gate (HITL)** (mcp.ts:294-300). Non-read-only tools are
   enqueued as pending tasks and answered without settling.
5. **Execution** (mcp.ts:302-336).
6. **Settlement** (mcp.ts:340-349). Only after a result. Failed settlement →
   402 `-32002`, result withheld.
7. **Idempotency record** (mcp.ts:358-367). Written from the exact response
   bytes, keyed on idempotency key + `fingerprint`.

- **Facilitator URL in use:** default `https://facilitator.payai.network`
  (x402.ts:93); override `X402_FACILITATOR_URL`. Test files default to the same.
- **Idempotency mechanism:** key from `Idempotency-Key`/`X-Idempotency-Key`
  header or MCP `_meta` (x402.ts:539-556); fingerprint = tool + stable-stringified
  args (`paramsFingerprint`, x402.ts:746-757). Store = KV `X402_IDEMPOTENCY` when
  bound, else in-memory `Map` with 24h TTL (x402.ts:707-743). Records are written
  **on settlement only**. Replays return stored bytes verbatim with header
  `x402-idempotent-replay: true` (mcp.ts:112-121). A missing idempotency key is
  not an error — the caller simply opts out of replay protection.
- **Settlement path:** `settleVerifiedPayment` (x402.ts:661-672) →
  `x402ResourceServer.settlePayment(...)` via `HTTPFacilitatorClient`
  (`resourceServerFor`, x402.ts:332-345). Seller never signs; `payTo` is an
  address only.

---

## 4. Git status

- **Branch:** `main`, up to date with `origin/main`.
- **Uncommitted (modified):** `package.json`, `test/smoke.test.ts`,
  `test/track-a-proofs.test.ts`, `vitest.config.ts`.
  - `package.json` change adds only the `test:smoke` script.
  - `vitest.config.ts` adds `fileParallelism: false` + excludes `smoke.test.ts`.
- **Untracked:** `README-API-GATEWAY.md`, `brief-durable-objects (1).md`,
  `brief-durable-objects.md`, `briefs/brief-000.md`, `src/api/(audio)hackernoon.txt`,
  `workflow/note-slop-skill.md`.
- **Last 5 commits:**
  | Hash | Author | Date | Subject |
  |---|---|---|---|
  | d647a4d | amemecometru | 2026-10-16 22:20 -0400 | untrack phantom-base scratch file |
  | 5216d16 | amemecometru | 2026-10-16 22:09 -0400 | drop accidental src/api duplicate of (audio)hackernoon.txt |
  | b9c42fe | amemecometru | 2026-10-16 22:09 -0400 | docs: project memory, env template, revenue wallet |
  | 4240570 | amemecometru | 2026-10-16 22:08 -0400 | PayAI facilitator + price-audit remediation |
  | c65d543 | Malachi Lane | 2026-10-15 01:03 -0400 | Delete workflow/.ideas |
- **Last 48h (>= 2026-10-16 00:07):** 4 commits, **all authored by `amemecometru
  <amemecometru@users.noreply.github.com>`**. The owner's own identity is not
  recorded in this repo, so these are flagged for the owner to confirm authorship.
  No other identity committed in the window. (Nearest other: Space Bunny,
  2026-10-14 23:53 — outside 48h.)

---

## 5. Dependencies (`package.json`)

Runtime deps: `@number-flow/react`, `@radix-ui/react-accordion`,
`@radix-ui/react-slot`, `@x402/core@^2.28.0`, `@x402/evm@^2.28.0`,
`@x402/extensions@^2.28.0`, `class-variance-authority`, `clsx`, `framer-motion`,
`hono@^4.13.7`, `jose@^6.2.12`, `lucide-react`, `react`, `react-dom`,
`tailwind-merge`, `tw-animate-css`.

Requested-four check:
| Package | In package.json? |
|---|---|
| `agents` | **absent** |
| `@cloudflare/codemode` | **absent** |
| `ai` | **absent** |
| `zod` | **absent** |
| `@modelcontextprotocol/sdk` | **absent** |

`zod` exists in `node_modules/zod` and `package-lock.json` (line 6450) only as a
transitive dependency.

**Missing for Agents SDK work:** `agents` and `@cloudflare/codemode` (and the
`ai`/`zod` peer surface codemode typically expects). Cloudflare tooling already
present: `@cloudflare/vite-plugin`, `@cloudflare/vitest-pool-workers`,
`@cloudflare/workers-types`, `wrangler@^4.129.1`.

---

## 6. Open questions

- `wrangler.jsonc` is **gitignored (`.gitignore:25`) and untracked**, yet
  `MEMORY.md:15` states it is "committed here." Contradiction; the bindings
  config is not version-controlled.
- `brief-durable-objects.md:18` and `brief-durable-objects (1).md:71,442` claim
  the `StudioSandbox` migration "already exists in the config" / "is already the
  right shape." `wrangler.jsonc` contains **no `durable_objects` and no DO
  migrations block.** Claim not supported by the config on disk.
- `.gitignore` also ignores `package-lock.json` and `dist` — dependency versions
  are not locked in VCS, so transitive changes/removals are invisible to git.
- `src/api/v1/` and `src/api/v1/webhook/` are **empty directories**; the webhook
  router actually lives at `src/api/webhook.ts`.
- `src/.test-file.txt` (gitignored, not committed) exists on disk and contains
  what appear to be **live credentials** (a 21st.dev key, two Cloudflare API
  tokens, an OpenRouter key, a Google OAuth client secret, a GitHub PAT). Not
  reproduced here. Flagged for handling/rotation. Also present: repo-root `.env`,
  `.env.save`, `~/.env`.
- `src/api/(audio)hackernoon.txt` is untracked again at the `src/api` root, and a
  duplicate sits at the repo root; commit 5216d16 already "dropped an accidental
  src/api duplicate" — appears to have recurred.
- `phantom-base` is gitignored scratch; last commit untracked it (still on disk,
  contains the revenue `payTo` per `MEMORY.md`).
- `wrangler.jsonc` holds **zero** `X402_*` keys; per `MEMORY.md` the payment rail
  config lives only in the Cloudflare dashboard. There is no CF credential on
  this machine (`CF_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` unset), so live secrets
  cannot be audited locally.
- `README-API-GATEWAY.md` contains a `git clone` command with an embedded
  credential URL and the instruction "(Read and execute)." **Not executed.**
- No explicit wrangler config "format version" field exists (no `migrations`
  block to carry one).
- `package.json` and the two test files/config are dirty in the working tree
  (see §4); nothing staged.

---

## 7. Known unimplemented work (status only)

- **Durable Objects brief (`brief-durable-objects.md` / `brief-durable-objects
  (1).md`): CONFIRMED ABSENT.** No `DurableObject`, `StudioSandbox`,
  `AgentSession`, or `Orchestrator` class exists anywhere in `src/` or in any
  `.ts`/`.tsx`/`.jsonc` in the repo (case-insensitive search, excluding
  `node_modules`/`.git`). The root `durable-objects/` directory exists but is
  empty. `wrangler.jsonc` has no `durable_objects` binding and no `new_classes`
  migration.
- **clawdyclaw REST API artifact build: CONFIRMED ABSENT.** `README-API-GATEWAY.md`
  references an external artifact repo (`lee-clawdyclaw-api-gateway`), not cloned
  anywhere found under `/home/book`. `src/index.ts` contains no endpoints
  attributable to that artifact; its routes are only the `/api/*` and `/mcp/v1`
  mounts listed in §2. No artifact endpoint list or spec exists in the repo, so
  its specific endpoints cannot be enumerated — none are present.

---

## 8. Dependency forensics

Method: `git log -p --follow -- package.json`, plus `git show <rev>:package.json`
for every one of the 15 commits.

| Dependency | Ever in package.json history? | Added | Removed | By whom |
|---|---|---|---|---|
| `@cloudflare/codemode` | **No** | — | — | — |
| `agents` | **No** | — | — | — |
| `@modelcontextprotocol/sdk` | **No** | — | — | — |
| `zod` | **No** | — | — | — |

- None of the four was ever added to or removed from `package.json` in any
  commit. The only history-wide `-S'"agents"'` hit (commit `ac17aedb`,
  amemecometru, 2026-09-12) is the string literal `"agents"` inside a facebook
  landing-page TSX component — not a dependency.
- `zod` appears only as a transitive entry in the gitignored `package-lock.json`
  (line 6450).
- **Who removed them / authorization:** not applicable — no removal occurred in
  tracked history. No brief or instruction authorized any such removal because
  none happened.
- Standing rule acknowledged: no dependency may be added or removed without
  explicit instruction.
