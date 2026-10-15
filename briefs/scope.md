# scope — clawdyclaw.com monetization

---
project: clawdyclaw
version: "1.0"
status: active
goal: "Every MCP tool call priced and payable via x402; humans pay by seat."
---

## goal

Make clawdyclaw.com earn on every agent transaction: priced MCP tools
settled via x402 on the agentic side, Stripe seats (+ crypto option) for
the HITL workspace. Reference: clawdyclaw-monetization.md (four revenue
lines).

## revenue lines (recap)

1. Tool-call fees (x402) — 33 tools in TOOL_DEFS today
2. Inference margin (feeBps — already metered, untouched by this scope)
3. HITL workspace seats (Stripe + crypto option)
4. Managed workflows (outreach chain first)

## slices

| # | Brief | Goal | Depends on | Status |
|---|-------|------|-----------|--------|
| 001 | briefs/brief-001.md | Add x402 price to every TOOL_DEFS entry; propose prices per policy | — | ready |
| 002 | briefs/brief-002.md | Enforce prices on /mcp/v1 tools/call (402 + paidTool) | 001 | queued |
| 003 | briefs/brief-003.md | Monetization Gateway seller integration; validate PAYMENT-CONTEXT JWT | 002 | queued |
| 004 | briefs/brief-004.md | HITL workspace: Stripe seats + crypto option | — | queued |
| 005 | briefs/brief-005.md | Ship one paid workflow end-to-end (outreach chain) | 002, 004 | queued |

Briefs 002–005 get written slice-at-a-time, as each predecessor lands.
Never write ahead — the next brief depends on what the last one taught us.

## out of scope (whole project)

- Changing inference pricing (feeBps stays as-is)
- Fiat on the agentic side (x402/crypto only)
- Adding new tools to the registry (price what exists)

## done criteria

- [ ] Every TOOL_DEFS entry has an owner-approved x402 price
- [ ] tools/call returns 402 with payment instructions when unpaid
- [ ] One real x402-settled tool call completes end-to-end
- [ ] HITL workspace has working Stripe checkout + crypto option
- [ ] One managed workflow sold to one paying user

## next action

Hand `briefs/brief-001.md` to opencode (run from the repo root).
Review the price table it returns. Lock the prices. Then write brief-002.
