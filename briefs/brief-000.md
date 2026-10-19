BRIEF 000: PROJECT INVENTORY

GOAL
A complete map of the clawdyclaw project as it stands right now.
No code changes. No builds. Read-only. This inventory is what the
workspace build briefs get written against — it needs to be accurate,
not approximate.

DO
1. Full file tree of src/ (every file, every directory). Note which
   directories exist and which don't (especially src/agents/).
2. For each of these, report: exists, line count, one-line purpose:
   - src/lib/x402.ts (facilitator URL? pay-to address source?)
   - src/lib/price-table.ts (tool count, price format)
   - src/index.ts (routes, middleware order, gate sequence)
   - wrangler.jsonc (every binding, every migration, format version)
   - Any test files (count, what they cover, last run result)
3. x402 flow as it stands TODAY: facilitator URL in use, gate order
   in code (not in docs — read the code), idempotency mechanism,
   settlement path.
4. Git status: branch, uncommitted changes, last 5 commits with dates.
   Flag anything committed in the last 48h you did not author.
5. Dependencies: package.json — list agents, @cloudflare/codemode,
   ai, zod if present (any version). Note what's missing for the
   Agents SDK work.
6. Open questions: anything you expected to find but didn't, or
   found but can't explain. List them plainly.

7. Known unimplemented work (do not implement — just confirm status):
   - The Durable Objects brief from cf-ai-assistant (brief-durable-
     objects-plain.md): confirm none of its DO classes exist in code.
   - The clawdyclaw REST API artifact build: confirm its endpoints
     are not in src/index.ts.
   Report each as "confirmed absent" or "partially present" with
   file/line references if partially present.

8. Dependency forensics:
   - git log -p --follow package.json | grep for when
     @cloudflare/codemode, agents, @modelcontextprotocol/sdk, zod
     were added and when they were removed.
   - Report: who removed them (commit author + date), and whether
     any brief or instruction authorized the removal.
   - No dependency may be added or removed going forward without
     his explicit instruction. This is now a standing rule.

OUTPUT
Write it to docs/inventory-001.md in the repo. Plain markdown,
no fluff. Sections matching the six items above. Done when the
file exists and every section has an answer or an explicit "not
found."

DO NOT
- Change any code, config, or dependency.
- Deploy anything.
- Fill gaps by guessing. "Not found" is a valid answer.
