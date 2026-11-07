# Brief AGENTS-001: Persistence and Owner-Scoped Definition API

## Goal

Implement the server-side persistence and authenticated CRUD API for user-owned agent definitions, based on the architecture decision approved in AGENTS-000. This slice does not run agents.

## Read first

- `briefs/brief-agents-index.md` and the approved `docs/adr/agents-runtime.md`.
- Current session middleware, Worker API route mounts, D1 schema/migration conventions, and database test patterns.
- Existing account-scoped APIs such as tools, integrations, campaigns, or professionals as relevant.

Re-check the working tree and do not overwrite unrelated changes.

## Data contract

Implement the schema agreed in the ADR. At minimum, an agent definition needs:

- Stable ID, authenticated owner subject, validated name/description/instructions.
- Selected model/provider identifier and explicit tool allowlist (not credentials).
- Lifecycle status such as `draft`, `enabled`, `paused`, `archived` with documented transitions.
- Created/updated timestamps and a version/revision mechanism suitable for immutable run snapshots.

Use constraints/indexes for owner-scoped listing and uniqueness only where the product contract requires it. Do not persist secrets, raw provider credentials, or arbitrary executable code.

## API contract

Add an owner-authenticated API under the established `/api/v1` conventions for:

- List the current owner’s definitions with bounded pagination.
- Create a draft definition.
- Fetch one owned definition.
- Update an owned definition with validation and version increment semantics.
- Enable/pause/archive according to explicit lifecycle rules.

Use session identity from the established middleware. Ignore/reject client-supplied owner IDs. Every query must include the authenticated owner, including mutation lookups. Return 404 for another owner’s resource rather than disclosing existence. Avoid exposing raw D1 records.

## Tasks

1. Confirm the ADR and schema proposal against current code; write a migration using established conventions and add it to the local migration/schema path required by the repo.
2. Add focused DB functions for CRUD and validation boundaries.
3. Add Hono routes and mount them in the Worker. Enforce session auth at every management route.
4. Validate field types, lengths, status transitions, allowed model IDs, and tool identifiers on the server. Do not trust UI-provided tool status or permission.
5. Resolve tool authorization using the source of truth identified in AGENTS-000. Store only selection; re-check current policy at run time in a later slice.
6. Add tests for CRUD, malformed input, missing session, cross-owner reads and writes, invalid status transitions, pagination bounds, and no secret fields stored/returned.
7. Document migration application steps without applying a remote migration.

## Out of scope

- UI, inference, test runs, tool execution, approval flow, schedules, billing, dependency changes, deployment.

## Acceptance criteria

- All endpoints require a valid session and derive owner exclusively from it.
- Cross-account IDOR tests prove users cannot list, read, modify, enable, pause, or archive another user’s definitions.
- Persisted definition schema is bounded, validated, and contains no credentials or user-executable code.
- Lifecycle and version behavior is explicit and tested.
- Migration is reviewable and locally/test covered; it has not been applied remotely.
- Existing APIs and migrations remain intact; focused tests and typecheck/build results are reported.
