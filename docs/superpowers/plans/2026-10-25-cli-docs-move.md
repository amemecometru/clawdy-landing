# CLI Truth Fix + Public Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill the phantom `npm i -g clawdyclaw-cli` install at the base (docs stop advertising an unpublished package; the real CLI delivery path is documented), point the CLI at `https://mcp.clawdyclaw.com`, and move the CLI reference out of the studio into a new production-quality public `/docs` section with an inbound-link-preserving redirect.

**Architecture:** Pure pathname routing in `src/App.tsx` (no new router deps), with routing decisions extracted into a pure module `src/pages/docs/docs-nav.ts` so vitest can pin them. New docs UI (shell + landing + CLI reference) uses the existing obsidian/rust/ember/porcelain Tailwind tokens; 21st.dev component pulls are optional garnish sourced from the key in `.env`. Studio loses its CLI page and nav item; the public header gains Docs entries.

**Tech Stack:** React 19 + Vite 6 + Tailwind 4, Vitest (node pool; `smoke.test.ts` and live-net tests excluded by default), TypeScript strict (`npm run lint` = `tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-10-25-cli-docs-move-design.md` (approved)

## Global Constraints

- **No commit, push, deploy, npm publish, or package install without explicit user approval.** User rule is absolute ("NO COMMITS made w/o APPROVAL FIRST"). Where a template would say "Commit", this plan says "Report and await approval".
- **Credentials in `.env` are never echoed to output, logs, or files.** Setup steps source `.env` silently (e.g. run the 21st CLI with the key in a shell variable).
- **workers.dev policy:** only `clawdyclaw.mllm.workers.dev` may appear, only in its CF-preview/OAuth-callback role. The strings `logiclemonai` and any other `*.workers.dev` must not be introduced anywhere.
- **Production endpoint truth (Dashboard 5 routes):** `clawdyclaw.com`, `agents.clawdyclaw.com`, `mcp.clawdyclaw.com` (PUBLIC_ORIGIN, CLI default base), `landing.clawdyclaw.com`, `api.clawdyclaw.com`.
- **No phantom claims:** the docs must not show `npm i -g clawdyclaw-cli` (or any npm install snippet) until the package is actually published. The delivery path is: run from repo clone, or fetch the zero-dep script raw from GitHub.
- **Design tokens only:** obsidian/rust/ember/porcelain/silver/beacon palette, font-mono uppercase tracking-widest labels, framer-motion for motion. No new CSS frameworks.
- **Anti-goal guard:** never test or claim 'HITL = Human-Checkpoint'; studio wording is HITL collaboration (agents + humans), but Phase I docs copy only covers installs and the CLI command set.

## Review Focus

1. **`/studio/cli` inbound deep links** (outreach links already exist) must not 404 or render a blank shell after the studio page is deleted → pinned by `test/docs-routes.test.ts` (Task 2: redirect kind) and wired in Task 5.
2. **Phantom npm claim regresses into src/ or dist/** (install copy drifts back from other hands) → pinned by `test/cli-truth.test.ts` grep-gate (Task 1) re-run over `src/` and `dist/` in Task 7.
3. **Doc command drops out of sync with `cli/clawdy.mjs`** (reference lists a command the CLI doesn't accept) → pinned by `test/docs-routes.test.ts` cross-check that every command listed in the docs data exists in `cli/clawdy.mjs`'s switch (Task 4).
4. **Wrangler route drift** (`api.clawdyclaw.com` absent locally while the dashboard has 5) → verified by JSONC-parse script + `npm run build` smoke in Task 7.
5. **Secret leakage through 21st CLI setup** (key printed into terminal logs) → Task 4's sourcing step runs the key through a variable with no echo; review step asserts no `21st_sk_` string was ever written to any repo file.

---

### Task 1: CLI truth fixes — base URL + publishable package skeleton

**Files:**
- Modify: `cli/clawdy.mjs:7,23`
- Create: `cli/package.json`
- Test: `test/cli-truth.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `cli/clawdy.mjs` defaulting to `https://mcp.clawdyclaw.com`; `cli/package.json` make the repo publish-ready for `clawdyclaw-cli` (package is **not** published in Phase I; root `package.json` "bin" stays as is).

- [ ] **Step 1: Write the failing test**

```ts
// test/cli-truth.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("cli truth", () => {
  it("defaults to the production endpoint and has no phantom hosts", () => {
    const src = readFileSync("cli/clawdy.mjs", "utf8");
    expect(src).toContain('const BASE_URL = process.env.CLAWDYCLAW_BASE_URL || "https://mcp.clawdyclaw.com"');
    expect(src).not.toContain("logiclemonai");
    expect(src).not.toMatch(/workers\.dev/);
  });

  it("ships a publish-ready package manifest without marking it private", () => {
    const pkg = JSON.parse(readFileSync("cli/package.json", "utf8"));
    expect(pkg.name).toBe("clawdyclaw-cli");
    expect(pkg.version).toBe("0.1.0");
    expect(pkg.bin?.clawdy).toBe("./clawdy.mjs");
    expect(pkg.files).toContain("clawdy.mjs");
    expect(pkg.engines?.node).toContain(">=18");
    expect(pkg.private).toBeUndefined();
  });

  it("does not advertise an unpublished package in src or cli", () => {
    const grep = (p) => readFileSync(p, "utf8").includes("npm i -g clawdyclaw-cli");
    expect(grep("cli/clawdy.mjs")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cli-truth.test.ts`
Expected: FAIL — no `cli/package.json`; `cli/clawdy.mjs` still has `logiclemonai` and `workers.dev` defaults.

- [ ] **Step 3: Implement**

Edit `cli/clawdy.mjs`: header comment line 7 and line 23 change the default base to `https://mcp.clawdyclaw.com` (env override stays). Update doc-comment references to the same URL. Create `cli/package.json`: `{ name: "clawdyclaw-cli", version: "0.1.0", description: "ClawdyClaw edge CLI — zero-dependency terminal client for the clawdyclaw worker", bin: { clawdy: "./clawdy.mjs" }, files: ["clawdy.mjs"], keywords: ["clawdyclaw","x402","mcp","cli"], engines: { node: ">=18" }, license: "MIT" }` — omit `"private"` deliberately (publish-ready), do not bump versions or touch root `package.json`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/cli-truth.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Smoke the CLI against the live endpoint**

Run: `node cli/clawdy.mjs status && node cli/clawdy.mjs help`
Expected: `● worker ok · mcp.clawdyclaw.com · …` if the endpoint is open (TOKEN-less). If auth 401/402, record it — health is expected open (`/api/health` verified open on preview); do not "fix" auth scope in this task.

- [ ] **Step 6: Report and await approval to commit** (proposed message: `cli: default to mcp.clawdyclaw.com; ship publish-ready clawdyclaw-cli manifest`)

---

### Task 2: Docs routing module (pure, testable)

**Files:**
- Create: `src/pages/docs/docs-nav.ts`
- Test: `test/docs-routes.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, no React/window/node:fs imports).
- Produces (used by Tasks 3–5):
  - `type DocsRoute = { kind: "landing" } | { kind: "page"; slug: string } | { kind: "redirect"; to: string }`
  - `resolveDocsRoute(pathname: string): DocsRoute` — `"/docs"` or `"/docs/"` → landing; `"/docs/<slug>"` → page (supported slugs `""`: none beyond data; `cli-reference`); `"/studio/cli"` or `"/studio/cli/…"` → `{ kind: "redirect", to: "/docs/cli-reference" }`; any other unknown `/docs/…` → `{ kind: "redirect", to: "/docs" }`.
  - `DOCS_PAGES: Array<{ slug: string; title: string; description: string; icon: string }>` with entries `cli-reference` (title "CLI Reference", icon "›_").
  - `DOC_COMMANDS: Array<{ label: string; code: string; comment?: string; method?: string; path?: string }>` — the CLI reference content: install block (`node cli/clawdy.mjs` + one-line raw fetch of `https://raw.githubusercontent.com/amemecometru/clawdy-landing/main/cli/clawdy.mjs` piped to `node`), env block pointing `CLAWDYCLAW_BASE_URL` at `https://mcp.clawdyclaw.com` (and note the CF preview `clawdyclaw.mllm.workers.dev` as alternate), then one entry per switch case in `cli/clawdy.mjs` (status · models · tasks · telemetry · integrations · widgets · feed · webhook · simulate · auth) with their real `method`/`path` values from the CLI.
  - `BASE = "https://mcp.clawdyclaw.com"` and `PREVIEW = "https://clawdyclaw.mllm.workers.dev"` exported constants.

- [ ] **Step 1: Write the failing tests** for `resolveDocsRoute` (each mapping above, incl. trailing-slash and case: `"/DOCS"` is unknown → redirect), plus a sync-check: every entry in `DOC_COMMANDS` that carries a `path` must exist in `readFileSync("cli/clawdy.mjs","utf8")` (prevents docs/CLI drift), and the collected `src/` must not contain `"npm i -g"` for clawdyclaw-cli.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/docs-routes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/pages/docs/docs-nav.ts`**

Pure functions and data per the Interfaces block. Types exported. No JSX. Handle `pathname` window-independently (take argument, no `window` use).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/docs-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Report and await approval to commit** (proposed message: `docs: extract pure docs routing + CLI reference content module`)

---

### Task 3: Docs UI — shell, landing bento, CLI reference page

**Files:**
- Create: `src/pages/docs/docs-shell.tsx`, `src/pages/docs/docs-page.tsx` (landing + cli-reference renderer; both consume Task 2 module)
- Modify: `src/App.tsx` (route wiring per Task 4 interfaces)

**Interfaces:**
- Consumes: `resolveDocsRoute`, `DOCS_PAGES`, `DOC_COMMANDS`, `BASE`, `PREVIEW` from `@/pages/docs/docs-nav`; `SiteHeader` from `@/components/site-header`; existing Tailwind tokens; `framer-motion` (already a dependency).
- Produces: `export function DocsPage({ route }: { route: DocsRoute })` — Task 4 renders it.

Build notes (kind of content the spec fixes, not exact markup):
- `docs-shell.tsx`: left sidebar (desktop) with `DOCS_PAGES` driven nav + site header on top; mobile: collapsible accordion mirroring `site-header.tsx`'s `MobileDrop` pattern. Sidebar links use `window.location.href` navigation like the rest of the existing pages do (repo pattern; use `safeHref`-style plain anchors as elsewhere).
- `docs-landing` section inside `docs-page.tsx`: bento grid — hero cell ("Docs", eyebrow "clawdyclaw.com/docs"), CLI reference cell, X402/mcp cell ("Coming soon" is forbidden for things that exist: link the live MCP manifest `/mcp/v1/manifest.json`), preview-cells for studio surfaces linking to real routes (`/studio`, `/studio/vault`), email/outreach cell only if it can link to something real, else omit entirely.
- `docs-cli-reference`: ported command blocks with copy-button (pattern exists at `src/pages/studio/cli-page.tsx:12-16`), grouped, plus a "Where does this live?" card quoting base/preview URLs and npm-package status truthfully ("publish pending approval").

- [ ] **Step 1: Sourcing check (no build)** — inspect `.env` for the `21st` credential *variable name only* (`grep -oE` of names); the value never prints. Decide pull-vs-handwrite: install 21st CLI (pending approval to install), else handwrite. If the 21st CLI is fetched, run it with the key sourced in a shell var, never echoed, and never write the key into any repo file. This is an optional-review step: either path is acceptable output.
- [ ] **Step 2: Implement the three files** per build notes, tokens only.
- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: Both pass (bundle includes /docs route files).

- [ ] **Step 4: Grep guard**

Run: `grep -rn "npm i -g clawdyclaw-cli\|logiclemonai" src dist/docs/client`
Expected: no matches.

- [ ] **Step 5: Report and await approval to commit** (proposed message: `docs: add public docs shell, landing, and CLI reference`)

---

### Task 4: Wire `/docs` routing + `/studio/cli` redirect into App

**Files:**
- Modify: `src/App.tsx`
- Test: no new test file; unit tests pin semantics, `npm run build` pins wiring types.

**Interfaces:**
- Consumes: `resolveDocsRoute`, `DocsPage` (Task 2/3), existing `useRoute`.
- Produces: public `/docs`, `/docs/cli-reference` pages and URL replacement redirect from `/studio/cli…`.

Implementation shape (deterministic wiring to copy):
- In `App.tsx`, before `isStudio` check: compute `docsRoute = resolveDocsRoute(path)`; if `docsRoute.kind === "redirect"` return a `<Redirect to={docsRoute.to}/>` component (`useEffect(() => window.location.replace(to))`, render `null`, plus a no-JS meta-refresh mirror in the fallback? No — SPA-only is sufficient; add a visible "Redirecting…" line is fine).
- Else if `docsRoute.kind === "landing" || docsRoute.kind === "page"` return `<DocsPage route={docsRoute}/>` — but ONLY when `path === "/docs" || path.startsWith("/docs/")` (unknown `/docs/*` kinds are already redirected by Task 2, so this branch is total for the docs prefix).
- Keep `isStudio` for `path.startsWith("/studio")` as-is (the `/studio/cli` catch already redirected away, so `StudioPage` never sees it; `fromSearchPath`'s `"/studio/cli"` branch becomes dead code and is removed in Task 5).

- [ ] **Step 1: Implement the wiring above.**
- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build`
Expected: PASS. Unknown `docsRoute.kind` exhaustiveness is enforced by tsc's discriminated-union narrowing — if the switch is non-total, `tsc` errors.

- [ ] **Step 3: Manual smoke with the dev server if practical** (`npm run dev`; fetch `http://localhost:5173/docs` and `http://localhost:5173/docs/cli-reference` — both render the docs shell; `/studio/cli` — document becomes the CLI reference).
- [ ] **Step 4: Report and await approval to commit** (proposed message: `app: route /docs and redirect legacy /studio/cli links`)

---

### Task 5: Remove studio CLI surface + rewire public header

**Files:**
- Delete: `src/pages/studio/cli-page.tsx` (user pre-approved per design doc)
- Modify: `src/pages/studio-page.tsx:10,22,33,45,56,103`
- Modify: `src/components/site-header.tsx:61` + `SIMPLE` list

**Interfaces:**
- Consumes: nothing new; pure deletions + href edits.
- Produces: `Section` type without `"cli"`; studio nav without CLI; header hrefs pointing at docs.

Implementation shape:
- `studio-page.tsx`: drop the `CliPage` import, `"cli"` union member, `NAV` entry, `REAL_PATH.cli`, `fromSearchPath`'s `/studio/cli` branch, and the `section === "cli"` render line.
- `site-header.tsx`: `DROPDOWNS` — replace "Surface → CLI" item's href with `/docs/cli-reference` (same label/desc); amend `SIMPLE`: `{ label: "Docs", href: "/docs" }` replaces the `{ label: "Resources", href: "/login?tab=docs" }` link (keep "Studio", "Sandbox", "Pricing").

- [ ] **Step 1: Implement the edits above.**
- [ ] **Step 2: Delete `src/pages/studio/cli-page.tsx`.**
- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npx vitest run test/docs-routes.test.ts test/cli-truth.test.ts`
Expected: all PASS; if any stale `cli` reference survived, `tsc` fails on the deleted import — that is the designed detection net.

- [ ] **Step 4: Grep final route truth**

Run: `grep -rn '"/studio/cli"' src` — expected: zero matches (redirect lives in `docs-nav.ts` as `"/studio/cli"` *input* mapping, not an output href); `grep -rn "studio cli-page" src` expected: zero.
- [ ] **Step 5: Report and await approval to commit** (proposed message: `studio: remove cli page; header nav now targets /docs`)

---

### Task 6: Wrangler route alignment + final gate

**Files:**
- Modify: `wrangler.jsonc` (routes array, after `landing.clawdyclaw.com` line; add `{ "pattern": "api.clawdyclaw.com", "custom_domain": true }` — Dashboard shows 5 routes, local config lists 4)
- Test: none new; final verification command set.

- [ ] **Step 1: Edit `wrangler.jsonc` routes.** Do **not** deploy.
- [ ] **Step 2: Parse-check the config**

Run: `node -e 'const s=require("fs").readFileSync("wrangler.jsonc","utf8").replace(/\/\/.*$/gm,"");JSON.parse(s).routes.length===5?console.log("5 routes ok"):process.exit(1)'`
Expected: `5 routes ok`.

- [ ] **Step 3: Full local gate**

Run: `npm run lint && npm run build && npx vitest run` (default excludes: `smoke.test.ts` + live-net files are the repo default; if run-time exceeds reason, stop and report rather than skipping silently).
Expected: everything green.

- [ ] **Step 4: Final phantom-purge grep across src, cli, dist, public**

Run: `grep -rn "logiclemonai" src cli dist/client public | grep -v email.md; grep -rn "npm i -g clawdyclaw-cli" src cli dist/client`
Expected: only the historical `public/email.md` `logiclemonai.org` mentions (a marketing-domain discussion doc — leave untouched); zero `npm i -g` matches.

- [ ] **Step 5: Report and await approval to commit** (proposed message: `wrangler: align routes with dashboard (api.clawdyclaw.com)`) — plus one approval for the whole batch of Task-6 proposed commits.

---

## Self-review notes

- Spec coverage: base-URL fix (T1), package skeleton w/o publish (T1), /studio/cli deletion (T5) + redirect (T2/T4), docs landing + CLI reference w/ truth-corrected install and production styling (T2/T3), header rewiring (T5), wrangler route alignment (T6), tests + lint/build gates (T1/T2/T3/T6). Grep-gates for both repo-held phantom strings (T4/T6).
- Docs copy is pinned as data (`DOC_COMMANDS`) with a CI-checkable drift sync against `cli/clawdy.mjs`; free-text prose is confined to cards whose URLs/copy the spec fixes.
- No commit steps exist; Task final steps report and await approval — the user's rule is enforced per-task.
- Review-focus items are pinned: redirect (T2 unit + T3 manual), phantom-claim grep (T1/T3/T6), docs/CLI drift sync test (T2), route-count parse (T6), silent-sourcing review (T3).
