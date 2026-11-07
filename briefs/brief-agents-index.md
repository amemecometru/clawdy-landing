# Build Your Own Agents — Slice Plan

This index breaks the product overview into implementation-sized briefs for the coding agent. Implement in order; each brief is intended to be independently reviewable and testable.

## Product goal

Let an authenticated ClawdyClaw user define and manage account-scoped agents, test them safely, invoke them manually, and inspect run history. The first release is supervised and manual: no schedules, autonomous loops, publishing, or user-supplied code execution.

## Repository baseline and non-negotiable constraints

- Treat the repository as the source of truth. Re-read relevant files on the branch before coding; the briefs describe the architecture observed during planning, not a substitute for checking current code.
- Existing Studio is a React SPA; the Worker uses Hono, D1, KV, and Cloudflare Agents/Durable Objects. The existing `StudioRoom` is a collaboration room, not a user-defined agent runtime.
- Reuse the current session auth, model registry/inference, vault, tool registry/executor, human-approval queue, and telemetry where they fit. Do not fork a second catalog or bypass existing policy gates.
- Every definition and run is scoped to the authenticated user. Display names, agent names, room labels, and request-body owner fields are not authentication.
- Never execute user-supplied code. Never allow an agent to approve its own actions. Keep platform-level payment, auth, and HITL policy authoritative.
- No dependency additions, removals, or upgrades without explicit owner approval. Do not deploy, apply remote migrations, or modify live secrets.
- Before coding any slice, inspect package/config/bindings, existing tests, and current git changes. Report relevant pre-existing failures separately.

## Ordered slices

| Order | Brief | Outcome | Depends on |
|---|---|---|---|
| 0 | [Architecture and runtime spike](brief-agents-000-architecture.md) | Confirm a safe, supported runtime and lock the API/data/policy contract before feature implementation. | None |
| 1 | [Persistence and owner-scoped API](brief-agents-001-data-api.md) | Authenticated users can create, view, update, pause, and archive their own agent definitions. | 0 |
| 2 | [Studio agent builder UI](brief-agents-002-studio-ui.md) | Users can manage agent definitions in Studio through a guided interface. | 1 |
| 3 | [Supervised manual runs](brief-agents-003-manual-runs.md) | Users can test and manually invoke an agent through bounded, policy-enforced execution. | 0, 1, 2 |
| 4 | [Run history and approvals](brief-agents-004-history-approvals.md) | Users can inspect runs and route sensitive actions through existing human approval. | 3 |
| 5 | [Security, reliability, and release readiness](brief-agents-005-hardening.md) | Close cross-slice security and reliability gaps and document a safe release procedure. | 1–4 |

## Definition of done across slices

- Acceptance criteria and tests in the relevant brief pass.
- Typecheck/build and focused tests run; results are reported accurately.
- No feature is deployed and no remote migration is applied by the coding agent.
- Changes remain within the slice; unresolved architecture or product decisions are raised rather than guessed.
- Any schema change includes a reviewed migration and local/test coverage. Include deployment/migration instructions, but do not execute them remotely.
