# Brief AGENTS-004: Run History and Human Approval Integration

## Goal

Make agent runs understandable and operable by their owner, and connect approval-required actions to the established HITL queue without allowing the agent to approve itself or leaking data across accounts.

## Read first

- Approved runtime ADR; AGENTS-001 data/API, AGENTS-003 run contract and state machine.
- Existing task and approval APIs/database functions, Studio queue, telemetry/execution records, and owner scoping.

## Scope

1. Add owner-scoped, bounded run-history and run-detail APIs. Return sanitized summaries, status, timestamps, model/tool usage, safe outputs, and actionable errors. Do not return credentials, raw provider payloads, or unredacted sensitive arguments.
2. Add Studio history/detail UI with filtering/pagination, status indicators, empty states, retry guidance, and refresh behavior.
3. If the ADR and current queue model support it, connect a sensitive tool proposal to the existing HITL queue. The approving human must be the authenticated operator; agent identity is never approval authority.
4. Bind approval/task records to the correct owner and run/action context. Verify the existing shared task queue’s ownership semantics before reusing it. If it cannot safely represent per-user agent approvals, stop and propose a separate owner-scoped design rather than weakening authorization.
5. Ensure task execution rechecks the owner, current policy, credential owner, and action status before side effects. Prevent duplicate execution with an explicit atomic/idempotent transition where consistent with existing patterns.
6. Surface approval status and final execution outcome back in the relevant run details without making arbitrary task payloads public.

## Security constraints

- An agent cannot approve or execute its own intercepted action.
- A guessed run/task ID cannot reveal another user’s data or trigger a side effect.
- Users may approve only actions they are authorized to approve under the existing account model.
- Never auto-execute on approval unless the established queue’s explicit approve/execute contract says so; preserve its semantics.
- Do not log full sensitive prompts, contact data, raw provider errors, or secrets.

## Tests

Cover history owner isolation, pagination, redaction, task/run association, unauthorized approval, cross-owner task/run access, non-pending transitions, duplicate execution/retry behavior, and visible UI states for pending/approved/rejected/executed/failed outcomes.

## Out of scope

- Schedules, autonomous loops, delegated agents, marketplace/public agent discovery, new billing/payment behavior, code execution, dependency changes, deployment.

## Acceptance criteria

- Users can inspect only their own runs and receive useful sanitized outcomes.
- Sensitive actions remain behind the existing human approval model and authenticated identity.
- Existing queue semantics are preserved; any ownership gap is escalated rather than bypassed.
- Duplicate/retry behavior cannot silently execute a side effect twice.
- Tests demonstrate the security boundaries and lifecycle behavior end to end.
