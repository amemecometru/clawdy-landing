# Brief AGENTS-002: Studio Agent Builder UI

## Goal

Add a guided, account-scoped agent definition experience to Central Station Studio using the AGENTS-001 API. This slice manages configuration only; it does not execute or test an agent.

## Read first

- `briefs/brief-agents-index.md`, approved runtime ADR, and AGENTS-001 API contract.
- `src/pages/studio-page.tsx`, Studio shell, existing Studio sections, auth/session UX, model registry, tool registry, and vault/integration UI.
- Current UI test conventions and design tokens/components.

## User journey

Add a **My Agents** section with:

1. Empty state explaining what an agent is and a clear create action.
2. List of the signed-in user’s agents with name, description, selected model, status, last-updated time, and actions allowed by lifecycle.
3. Create/edit form with name, description, bounded instructions, model selection, tool selection, and a policy summary.
4. Review step that clearly summarizes model, enabled tools, provider requirements, and approval/payment behavior before save.
5. Detail/configuration view with save, enable/pause, and archive actions calling the owner-scoped API.

Only show models and tools that the current registry says are available/eligible. Explain disconnected providers and unavailable tools. Never imply that a `planned` or `stub` tool is runnable. Tool policy shown in the UI is informational; the server remains authoritative.

## UX and accessibility

- Follow the existing Studio visual system and reusable components.
- Provide loading, empty, save-success, validation, network-error, unauthorized, disconnected-provider, and stale-data states.
- Use labels, keyboard-operable controls, visible focus, semantic headings, and accessible error messaging.
- Avoid discarding edits silently. Confirm destructive archive actions.
- Do not display secrets; never request provider keys in this form. Link users to the existing vault flow when needed.

## Tasks

1. Add the Studio route/navigation and agent list view.
2. Add create/edit form with client-side hints while treating server validation as authoritative.
3. Wire list/detail/create/update/lifecycle requests to AGENTS-001.
4. Re-fetch or reconcile server state after mutation; handle stale versions according to the API contract.
5. Add component tests for the core journey, empty/error states, keyboard labels, and API error handling.

## Out of scope

- Agent inference, simulation, runs, history, approval changes, MCP publication, arbitrary code, schedules, billing, dependency changes, deployment.

## Acceptance criteria

- A signed-in user can create, inspect, edit, enable/pause, and archive only their own agent definitions in Studio.
- UI options correspond to the current model/tool catalog; unavailable choices are not presented as runnable.
- Server errors and stale state are clear; edits are not silently lost.
- UI contains no credential entry or unsafe claims that configuration alone grants authority.
- Tests cover primary journey, empty/loading/failure states, and accessibility basics.
