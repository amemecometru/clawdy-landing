# Brief AGENTS-003: Bounded Supervised Manual Runs

## Goal

Add manual test/invocation for enabled user-owned agents using the runtime contract approved in AGENTS-000. Enforce owner scope, tool allowlists, model/provider checks, and hard execution limits. Do not introduce autonomous or scheduled behavior.

## Read first

- Approved runtime ADR and AGENTS-001 data/API contract.
- Existing inference, tool registry/executor, vault, payment and HITL gates, Worker bindings/limits, and test fixtures.

## Runtime rules

- Accept an owned agent ID and bounded user input. Derive the owner from the authenticated session.
- Load a server-side snapshot of the definition; reject archived/paused agents as specified by lifecycle policy.
- Revalidate model/provider availability and each selected tool against the current registry, connection, status, and platform policy on every run.
- Intersect configured tools with the platform-authorized allowlist. Reject unknown, planned, stub, or unauthorized tools; never accept arbitrary function names or executable code from model output.
- Enforce limits from the ADR: time, turns, tool calls, input/output bytes, and per-owner concurrency. Set safe defaults and fail closed if limits cannot be enforced.
- Resolve credentials only through the existing server-side vault for the authenticated owner. Never pass secrets into prompts or log them.
- Preserve the existing payment and human-approval enforcement. No payment auto-approval, HITL bypass, or agent self-approval. If the approved runtime cannot safely pause and resume an approval-required action, return a clear policy outcome without executing that action.
- Persist run start/end/status and an immutable config snapshot or version reference. Redact sensitive data from stored output and diagnostics according to ADR.

## UX/API behavior

Add a bounded run/test endpoint and a Studio action that:

- Clearly distinguishes test from live run and describes any external effect before confirmation.
- Supports safe dry-run behavior only if it is enforced by server logic, not a client flag alone.
- Shows progress/results/errors without exposing internal stack traces, tokens, or provider secrets.
- Prevents invocation for non-owned, disabled, or invalid agent configurations.

If provider-native tool calling or durable execution is unsupported, follow the ADR’s MVP decision. Do not build an improvised model-output parser that directly dispatches arbitrary tools.

## Tasks

1. Implement run API and runtime integration following the ADR; keep orchestration isolated and testable.
2. Add run persistence and a clear status state machine appropriate to the selected execution model.
3. Add a Studio test/run interaction with bounded input and a confirmation step for any permitted live effects.
4. Add tests for owner isolation, status restrictions, invalid model/tool selections, disconnected provider, budgets/timeouts, concurrency, secret redaction, payment/HITL preservation, and failure/partial failure behavior.
5. Verify the run cannot call an unselected tool even if the model/provider response requests it.

## Out of scope

- Recurrence/schedules, background autonomous loops, public/MCP agent exposure, marketplaces, user code, new providers, auto-payment, bypassing approval, dependency changes, deployment.

## Acceptance criteria

- Only authenticated owners can start runs for their own eligible agents.
- Run uses a validated snapshot and only currently allowed selected tools.
- All hard limits are enforced server-side and covered by tests.
- No unauthorized side effect occurs on test, timeout, malformed tool call, provider failure, or policy denial.
- Existing authentication, vault, HITL, and payment behavior remains in force.
- Run status/result is persisted with safe redaction; users receive actionable errors.
