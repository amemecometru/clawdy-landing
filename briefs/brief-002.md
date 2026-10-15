# brief-002 — enforce x402 prices on tools/call

---
slice: "002"
project: clawdyclaw
status: ready
depends_on: ["001"]
est_tokens: 8000
---

## goal

Priced tools now refuse unpaid calls: `/mcp/v1 tools/call` returns HTTP
402 with an x402 payment-instructions body when a priced tool is called
without valid payment authorization. Pricing data (brief-001, locked
below) becomes enforced behavior.

## why

A price list nobody enforces is a menu, not monetization. This slice
turns the locked table into a gate — while keeping real settlement
verification cleanly separated for brief-003 (Monetization Gateway).

## acceptance_criteria

- [ ] All 35 `x402_price_usd` values match the locked table below exactly
- [ ] Unpaid `tools/call` on a priced tool → HTTP 402; body follows the
      x402 payment-required shape (`x402Version`, `accepts[]` with
      scheme/network/maxAmountRequired/asset/payTo)
- [ ] `maxAmountRequired` is correct per tool (USD × 10⁶, USDC atomic units, string)
- [ ] Gate order: 401 session check runs BEFORE 402 payment check
- [ ] $0 tools (none currently, but the path) skip the payment gate entirely
- [ ] Dev bypass works only when `X402_DEV_BYPASS=true` is explicitly set;
      absent/false → fail closed
- [ ] Tests cover: unpaid priced call → 402 + correct amount; $0 tool →
      normal path; no session → 401 (not 402); bypass on/off
- [ ] `npm run lint` clean, no new typecheck errors

```json
{
  "read_first": ["src/api/tools.ts", "src/api/mcp.ts"],
  "tasks": [
    "Set all 35 x402_price_usd values per the locked table below",
    "Create src/lib/x402.ts: price lookup, paymentRequired() builder for the 402 body, verifyX402Payment() stub",
    "Wire the gate into mcp.ts tools/call AFTER the existing session gate",
    "Add tests for the four gate paths",
    "Run lint + typecheck; fix only what this slice broke"
  ],
  "constraints": [
    "x402 shape conforms to the x402 spec — keep it in ONE module (src/lib/x402.ts) so brief-003 can swap the rail",
    "USDC on Base: 6 decimals; maxAmountRequired = ceil(usd * 1e6), as a string",
    "Pay-to address comes ONLY from env X402_PAY_TO_ADDRESS — never hardcoded",
    "verifyX402Payment() is a STUB: checks the x402 payment headers are present and well-formed, then fails closed. Real facilitator/onchain verification is brief-003. Say so in a comment.",
    "X402_DEV_BYPASS exists for local testing ONLY — default off, comment says never enable in production",
    "Gate order is load-bearing: 401 (who are you) before 402 (pay me)",
    "Code comments describe what the code does — no editorializing, ever",
    "Do not touch infer.ts, feeBps, or any pricing outside the locked table"
  ],
  "out_of_scope": [
    "Real payment verification / facilitator / onchain settlement (brief-003)",
    "Buyer-side withX402Client wrapper for our agents paying others (brief-003)",
    "Stripe (brief-004)",
    "New tools or price changes beyond the locked table"
  ]
}
```

## locked_price_table

Owner-locked Oct 13. Rule applied: a tick below comps where comps
exist, match where already extremely low; proprietary tools keep
brief-001 prices. Single adjustment from brief-001: `web_search`
0.020000 → 0.006000 (tick below Tavily $0.008/search).

```json
{
  "list_tasks": 0.001, "classify_intent": 0.005, "search_threads": 0.01,
  "fetch_url": 0.01, "check_payment": 0.01, "vector_search": 0.01,
  "query_sheet": 0.01, "web_search": 0.006, "hf_infer": 0.02,
  "cloudflare_ai": 0.02, "file_write": 0.02, "save_memory": 0.02,
  "draft_reply": 0.05, "model_infer": 0.05, "transcribe_audio": 0.05,
  "summarize_document": 0.05, "flux_image": 0.05, "http_request": 0.05,
  "edit_image": 0.08, "post_social": 0.1, "schedule_post": 0.1,
  "tts_speak": 0.1, "run_code": 0.1, "update_crm": 0.1,
  "send_email": 0.25, "draft_personalized_outreach": 0.25,
  "draft_follow_up": 0.25, "schedule_follow_up": 0.25,
  "send_sms": 0.25, "monitor_keywords": 0.25, "schedule_cron": 0.25,
  "create_payment_link": 0.25, "run_scraper": 0.5,
  "create_invoice": 0.5, "generate_video": 1.0
}
```
(Keyed by registry `name`. 6-decimal precision in code; shortened here
for readability.)
