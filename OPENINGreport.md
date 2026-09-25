We are working only in ~/clawdy-landing.

Do not inspect, modify, initialize, or connect ~/agentic.clawdy.
Do not modify amemecometru/clawdyclaw-landing.
Do not add OmniRoute as a ClawdyClaw production provider yet.
OmniRoute and 21st.dev are development tools for this task only.

Objective:
Identify and implement the smallest production-ready revenue-generating HITL workflow already implied by this application.

Start with read-only inspection. Do not edit files yet.

Inspect these files and their direct dependencies:

Backend:
- src/index.ts
- src/api/mcp.ts
- src/api/tasks.ts
- src/api/webhook.ts
- src/api/executor.ts
- src/api/proxy-bridge.ts
- src/api/integrations.ts
- src/api/telemetry.ts
- src/db/tasks.ts
- src/db/vault.ts
- src/db/schema.ts

Frontend:
- src/App.tsx
- src/pages/
- src/components/
- existing Studio routes and task/approval components

Configuration:
- package.json
- wrangler configuration
- migrations/
- existing test files

Trace these flows with concrete files, functions, routes, database tables, and missing bindings:

1. Authentication and user identity
2. Inbound webhook or MCP request
3. Intent classification
4. HITL task creation
5. Task display in the Studio
6. Approval/rejection
7. Task execution
8. Email or other external action
9. Telemetry/audit result

Report:

A. What currently works end-to-end.
B. What is only mocked, placeholder, anonymous, or disconnected.
C. The smallest revenue-generating workflow that can be completed without building new major infrastructure.
D. Exact files and symbols that must change.
E. Required Cloudflare bindings, secrets, OAuth credentials, and migrations.
F. Security blockers before exposing MCP or user actions publicly.
G. Which Studio routes/features are useful for this workflow and which are currently distracting/demo-only.

Pay special attention to src/api/mcp.ts:
- verify whether anonymous model_infer execution is safe;
- verify whether user vault credentials can actually be resolved;
- verify the HITL interception behavior;
- verify whether force/approved execution can ever reach the executor;
- identify whether review_endpoint URLs are complete or only relative.

Do not edit anything until this report is complete.
