# brief-001 — price the tool registry

---
slice: "001"
project: clawdyclaw
status: ready
depends_on: []
est_tokens: 5000
---

## goal

Add an x402 price field to the ToolDef interface and every TOOL_DEFS
entry in src/api/tools.ts, with a proposed price per tool following the
policy below. Pricing data only — no enforcement (that's brief-002).

## why

Prices are data; enforcement is logic. Landing the data first lets the
owner review and lock every price in one table before any behavior
changes. A wrong price in a table is a one-line fix; a wrong price in
enforcement logic is a bug.

## acceptance_criteria

- [ ] `ToolDef` interface gains `x402_price_usd: number` (USD, up to 6 decimals)
- [ ] Every entry in TOOL_DEFS has the field set (zero only for genuinely free tools, with justification)
- [ ] The file typechecks (`tsc --noEmit` or equivalent for the project)
- [ ] Output includes a markdown table: tool name | price | one-line justification
- [ ] No other files changed; no enforcement logic added

```json
{
  "read_first": ["src/api/tools.ts"],
  "tasks": [
    "Add x402_price_usd to the ToolDef interface",
    "Set a price on all 33 TOOL_DEFS entries per the pricing policy below",
    "Verify the file typechecks",
    "Present the price table for owner review"
  ],
  "constraints": [
    "Prices in USD, up to 6 decimal places (Monetization Gateway floor is $0.001)",
    "Code comments describe what the code does — no editorializing, ever",
    "Do not touch mcp.ts, infer.ts, or any other file",
    "Do not implement 402 responses or payment logic — that's brief-002"
  ],
  "out_of_scope": [
    "paidTool / withX402Client wiring",
    "Changing existing fields (useCase, costTier, status, providerBinding)",
    "Adding new tools to the registry"
  ]
}
```

## pricing_policy

- Read-only / informational tools (list_tasks, classify_intent,
  search_threads): $0.001–$0.01
- Standard execution tools: $0.02–$0.10, scaled by upstream cost + value
- High-value executors (outreach chain, scrapers, anything that spends
  the operator's money or time): $0.25–$1.00+
- Genuinely free tools: $0.000000 — but justify why in the table
- When in doubt, price slightly high: lowering a price later is easy,
  raising one after agents depend on it is not
---

EOF
