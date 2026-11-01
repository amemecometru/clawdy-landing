# Design — Phase I: CLI truth fix + public Docs section

Date: 2026-10-25 · Status: **pending approval**

## Intent

The studio's CLI page advertises `npm i -g clawdyclaw-cli`, but that package has
never been published (verified: registry E404). The install line was a
placeholder. Additionally the CLI defaults to `clawdyclaw.logiclemonai.workers.dev`,
which does not resolve. Phase I replaces the placeholder with truth: a public,
production-quality Docs section owning the CLI reference, and the studio loses
its CLI page.

## Root cause (verified)

- `clawdyclaw-cli` was never published; repo package.json is `private: true`
  (app manifest). No CI publish workflow. → 404 is a missing package, not a typo.
- Real worker domains (wrangler routes + Google OAuth origins file):
  `clawdyclaw.com`, `agents.clawdyclaw.com`, `mcp.clawdyclaw.com` (PUBLIC_ORIGIN),
  `landing.clawdyclaw.com`, `api.clawdyclaw.com` (dashboard has 5; wrangler.jsonc
  lists 4), plus CF preview `clawdyclaw.mllm.workers.dev` (works, preview-only role).
- The only `logiclemonai.workers.dev` references live in the CLI surface being
  deleted/rewritten: `cli/clawdy.mjs:23`, `src/pages/studio/cli-page.tsx:10,155`.

## Goals

- `npm i -g clawdyclaw-cli` 404 is fixed at the base: docs stop advertising a
  phantom install; the real delivery path is documented (run from repo, or fetch
  the zero-dep script raw from GitHub).
- CLI default base URL = `https://mcp.clawdyclaw.com` (worker route,
  PUBLIC_ORIGIN), overridable via `CLAWDYCLAW_BASE_URL`.
- New public `/docs` section: docs landing (bento intro + index) + CLI reference
  page, styled with the existing obsidian/rust/ember/porcelain tokens.
- `/studio/cli` deep links (already sent in outreach) keep working via redirect
  to `/docs/cli-reference`.
- Studio shell loses the CLI nav item/page; public header dropdown "Surface →
  CLI" targets `/docs/cli-reference`; "Resources" link targets `/docs` instead
  of `/login?tab=docs`.
- `wrangler.jsonc` routes aligned with dashboard truth (add
  `api.clawdyclaw.com` custom domain entry — local config currently lists 4 of 5).

## Non-goals / anti-goals

- No npm publish — requires credentials + explicit approval; Phase I only adds
  `cli/package.json` so publishing is one approved command later. The npm
  install snippet does NOT return to docs until the package is live.
- No Phase II studio work (X402 tool building, professionals workflows, email
  campaign UI) — separate design.
- No commit, deploy, or npm publish without explicit approval.
- Do not add placeholder/phantom claims of any kind.

## Approach (chosen over alternatives)

**A — public docs route (chosen)**: SPA route `/docs` with docs-landing +
sidebar pages, starting with Get started + CLI reference. Rejected: studio-hosted
docs (a CLI reference in the studio navbar was the reported complaint) and a
thin redirect page (not "production quality").

Build mix: hand-written bento-grid matching the repo design system, plus
components pulled via the 21st.dev CLI where they genuinely fit (credential from
`.env`). Framer-motion already a repo dependency.

## Parts decided

- Docs pages are plain components rendered by `App.tsx` pathname switch
  (`/docs`, `/docs/cli-reference`), mirroring how `/studio`, `/room`, `/login`
  already route. No new router deps.
- CLI reference content ported from the deleted studio page with corrections:
  install truth (repo/raw fetch), correct base URL, live command set from
  `cli/clawdy.mjs`.
- Deletion touchpoints: `src/pages/studio/cli-page.tsx` (delete file);
  `src/pages/studio-page.tsx` (import, union, nav array, deep-link map, section
  render, pathname parse `/studio/cli`); `src/components/site-header.tsx`
  ("Surface → CLI" href + "Resources" href).
- Tests: extend existing pages/auth test patterns to cover `/docs` routes and
  the `/studio/cli` redirect; `npm run lint` (tsc) must stay clean.

## Left to the builder

Which specific 21st.dev components to pull vs. hand-write; exact bento content;
fallback to pure hand-written if the 21st CLI key fails.
