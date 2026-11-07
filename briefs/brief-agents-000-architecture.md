# Brief AGENTS-000: Architecture and Runtime Spike

## Goal

Establish the implementation contract for user-created agents before adding persistent feature code. Verify what the current repository actually supports, then produce a concise architecture decision record (ADR) and, only if needed, a small non-production proof of concept that can be discarded or retained by explicit review.

## Why this is a separate slice

The product depends on safe tool-calling/model orchestration, but the existing inference path may not provide tool calling, streaming, run durability, cancellation, or resumable execution. Do not assume the installed `agents` or `@cloudflare/codemode` packages solve those requirements. A mistaken runtime choice would create expensive migrations and security gaps.

## Read first

Inspect the current branch and working tree, then read the current versions of:

- `package.json`, Worker entry point, Cloudflare config/bindings, and migrations.
- `worker/api/models.ts`, inference implementation, `worker/api/tools.ts`, MCP route, executor, approval/task routes, and vault code.
- Studio route composition, shell, tool registry, model page, vault page, and test configuration.
- Existing agent/Durable Object implementation and associated tests.

Use actual paths discovered in the repo; paths in this brief are pointers, not guarantees.

## Tasks

1. Record the current execution path from model selection through inference and tool execution, including which components support tool calling and whether any execution can survive a Worker request ending.
2. Verify model/provider support, input/output limits, timeout behavior, and whether provider credentials are only resolved server-side from the user’s vault.
3. Verify current tool status, schema, executor coverage, provider binding, interception policy, and payment behavior. Identify tools that are safe for an initial agent allowlist.
4. Check Cloudflare Agent/Durable Object bindings and migration state. Determine whether an HTTP request/response run is sufficient for MVP or if a Durable Object is necessary. Do not add a binding in this spike.
5. Propose the minimal agent definition and run data model, API contract, tool-call policy, run state transitions, and error model. Include ownership checks and how config snapshots are bound to each run.
6. State the explicit initial behavior for tool calls that require HITL, tools that incur payment, unavailable integrations, model errors, timeouts, retries, and cancellation.
7. Write a short ADR at `docs/adr/agents-runtime.md` (or an existing ADR location if the repository has one). Include options considered, chosen approach, rejected alternatives, consequences, open owner decisions, and migration/deployment implications.
8. If an unknown package/API behavior blocks the decision, create only a local, isolated proof-of-concept/test. Do not commit credentials, deploy, modify live configuration, or make dependency changes without approval.

## Required decisions in ADR

- MVP run model: synchronous bounded HTTP request vs durable/background execution. Choose based on verified Worker limits and existing infrastructure; do not speculate.
- Model tool-calling contract: native provider tool calling, an existing supported orchestration layer, or a staged MVP that only uses model inference without invoking tools. Do not invent a prompt-parsing tool-call protocol and trust model output as executable instructions.
- How selected tools are represented and validated; how user-selected tools are intersected with platform authorization and status.
- How budgets, maximum turns/tool calls, timeouts, output size, and per-user concurrency are bounded.
- Whether approval-required tool calls can be enqueued during a run in MVP or are reported as requiring a human action outside the run.
- How payment-required tools are handled. Never auto-pay or bypass the existing payment gate.
- How definitions are versioned/snapshotted and how logs redact sensitive input/output.

## Out of scope

- Production CRUD/UI/runtime implementation.
- New dependencies or provider integrations.
- Schedules, autonomous loops, marketplace publication, agent-to-agent delegation, code execution, or billing.
- Remote migrations, secrets, or deployment.

## Acceptance criteria

- ADR is based on inspected code and names the exact supporting files and limitations.
- A concrete schema/API/runtime proposal exists and is small enough to implement incrementally.
- Tool safety, ownership, payment, HITL, secrets, limits, and failure handling are explicit.
- All unresolved decisions that need owner input are listed; do not silently decide product policy.
- No production behavior, dependency, live configuration, or remote environment changed.
