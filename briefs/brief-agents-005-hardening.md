# Brief AGENTS-005: Security, Reliability, and Release Readiness

## Goal

Perform a focused end-to-end hardening pass on the Build Your Own Agents slices. Fix only in-scope defects required for safe operation; record unrelated findings separately. Produce a release checklist but do not deploy or apply remote migrations.

## Read first

- All AGENTS briefs and the approved runtime ADR.
- All implementation diffs, migration files, relevant test reports, current Worker limits/configuration, and existing security practices.

## Review checklist

### Authorization and privacy
- Every definition/run/history/task route derives owner from the authenticated session and scopes database operations by that owner.
- Test cross-account access across list, detail, update, lifecycle, invocation, cancellation (if present), history, and approval paths.
- No caller-controlled name/header/body field is treated as identity or authorization.
- UI and APIs do not expose secrets, raw vault tokens, stack traces, or unredacted provider responses.

### Agent policy and side effects
- Server independently validates model, tool, integration, status, and account eligibility at invocation time.
- A model cannot invoke tools outside the saved allowlist or bypass current platform policy.
- Existing HITL and payment gates are preserved, and an agent cannot self-approve.
- Dry-run/test mode has server-enforced no-side-effect semantics where promised.
- No arbitrary code execution, hidden network egress, schedule, or unapproved background loop has slipped into scope.

### Resource safety and reliability
- Request, prompt, output, turn, tool-call, runtime, concurrency, and history pagination bounds are finite and tested.
- Timeouts, partial failures, retries, duplicate invocations, and worker termination lead to consistent run states.
- Stored snapshots/version references correspond to the exact configuration used.
- Database migration is safe, repeatable according to repository conventions, and does not require destructive changes.

### Product quality
- Empty, loading, validation, unauthorized, unavailable provider, pending approval, partial failure, and success states are understandable.
- Keyboard and screen-reader behavior is checked for main flows.
- Documentation accurately describes manual/supervised capability and all limitations.

## Tasks

1. Run targeted test suites, full tests, typecheck/lint, and build using repository scripts.
2. Add missing security/reliability tests; fix only defects in this feature’s scope.
3. Review logs/errors for sensitive data and redact as needed.
4. Check migration diff and document safe rollout/rollback considerations. Do not run remote migrations.
5. Add or update a user/operator guide describing create, configure, test, run, approvals, limits, and deletion/retention.
6. Report test commands/results, known failures, migration and binding changes, open risks, and a deployment checklist requiring human approval.

## Out of scope

- Deployment, live migration, secrets/configuration edits, dependency changes without approval, unrelated cleanup, product scope expansion.

## Acceptance criteria

- Authorization, tool-policy, side-effect, redaction, limits, and retry cases are covered by automated tests.
- Relevant tests/typecheck/build have been run and reported truthfully.
- No unresolved critical/high-risk gap is represented as production-ready; blockers are explicit.
- Migration/deployment instructions are documented and remain unexecuted.
- Feature documentation matches implemented behavior and does not claim unsupported autonomy or safety guarantees.
