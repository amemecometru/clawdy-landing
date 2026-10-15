# brief-003 — Monetization Gateway seller integration + real settlement

---
slice: "003"
project: clawdyclaw
status: ready
depends_on: ["002"]
est_tokens: 12000
---

## implementation reference (canonical)

The official x402.org seller quickstart is the primary reference —
not Alchemy's skill, not training data. Key packages:

- `@x402/hono` — `paymentMiddleware` for HTTP routes (Hono-native;
  clawdyclaw runs Hono)
- `@x402/mcp` — `createPaymentWrapper(resourceServer, { accepts,
  resource, extensions })` — **purpose-built for MCP tools + x402;
  evaluate this first for the tools/call gate**
- `@x402/core` — `x402ResourceServer`, `HTTPFacilitatorClient`
  (facilitator: `https://x402.org/facilitator` on testnet)
- `@x402/evm` — `ExactEvmScheme` (server-side)
- `@x402/extensions/bazaar` — `declareDiscoveryExtension` (official
  discoverability mechanism — supersedes the "move the JSON file"
  approach below)

Payment scheme: `exact` for all 35 tools (fixed prices from the locked
table). `upto`/`batch-settlement` are out of scope for this slice.
Network IDs are CAIP-2: `eip155:84532` (Base Sepolia test),
`eip155:8453` (Base mainnet).

Testnet addresses (Base Sepolia):
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (verified on-chain)
- Test buyer wallet: `0x7f4dcad0802ed4fa1fc0dc95f24d87c3bfe682fc`
  (funded: 9 USDC + 0.0006 ETH)
- Private key for the test wallet comes via env var only — never in
  a file, never in chat.

SDK hooks of note (TypeScript column, from the x402 feature matrix):
- MCP Server Hooks on the payment wrapper: `onBeforeExecution`,
  `onAfterExecution`, `onAfterSettlement` — use `onAfterSettlement`
  as the idempotency-record point (keyed on idempotency key + params)
  and `onBeforeExecution` to preserve the 401-session → 402-payment →
  HITL gate ordering around the wrapper.
- Client Safety: `spendControls` (asset allowlist + USD cap) on the
  buyer-side wrapper — this is the SDK-native answer to spending caps;
  configure it rather than relying solely on the HITL queue.
- Server Hooks `onVerifyFailure` / `onSettleFailure` must fail closed
  (402, never execute) — same posture as the stub had.

## goal

Paid tool calls settle real money: replace the `verifyX402Payment()` stub
with real facilitator verification, integrate the seller side with the
Monetization Gateway, validate the PAYMENT-CONTEXT JWT, and prove one
real x402-settled tool call end-to-end on testnet. Idempotency lands now,
before real money moves — a retry after payment must never double-charge
or double-execute.

## why

Brief-002 built the gate; right now it fails closed on every paid call,
so the gate earns nothing. This slice turns the gate into revenue: real
verification, real settlement, and the buyer-side wrapper our agents use
to pay others. Idempotency is a load-bearing part of this slice, not a
later optimization — the first real payment is the worst time to discover
that retries double-charge.

## acceptance_criteria

- [ ] `verifyX402Payment()` performs REAL verification via the
      facilitator (no stub): confirms the payment signature, amount,
      asset (USDC), network, and recipient match the 402's
      payment-required instructions; fails closed on any mismatch
- [ ] PAYMENT-CONTEXT JWT validated per the Monetization Gateway spec
      (issuer, expiry, audience/scope) before the call executes
- [ ] One real x402-settled tool call completes end-to-end on
      base-sepolia: unpaid call → 402 → pay testnet USDC → verified →
      200 with the tool's real result
- [ ] Idempotency: a paid tool handler accepts an idempotency key and
      dedupes repeat executions — same key + same params returns the
      original result without re-executing or re-charging; covered by
      a test that replays a paid call
- [ ] `withX402Client` buyer-side wrapper exists for our agents' outbound
      paid calls: takes a confirmation callback that sees the payment
      requirements before money moves; passing null auto-pays (document
      the risk in a comment)
- [ ] Network selection via env: base-sepolia for test/dev, base for
      mainnet; mainnet requires an explicit env flag, never the default
- [ ] `X402_DEV_BYPASS=true` still works for local testing; absent/false
      → fail closed (unchanged from 002)
- [ ] `toAtomicUnits()` keeps the decimal-string math from 002 (the
      brief-002 agent proved `Math.ceil(usd * 1e6)` overcharges by one
      atomic unit on ~1.15% of 6-decimal prices); the agreement test
      still passes
- [ ] `npm run lint` clean, no new typecheck errors (44 pre-existing
      errors in tasks.ts/require-auth.ts/webhook.ts are out of slice —
      do not fix them here)
- [ ] Discoverability: Bazaar `declareDiscoveryExtension` wired into the
      MCP payment wrapper config (official mechanism — supersedes the
      earlier "move the JSON file" plan)

```json
{
  "read_first": [
    "src/lib/x402.ts",
    "src/api/mcp.ts",
    "workspace/goals/software-projects-build-out/files/clawdyclaw-scope/brief-003-parked-findings.md"
  ],
  "tasks": [
    "Use the official x402.org SDK packages (@x402/hono, @x402/mcp, @x402/core, @x402/evm) — do NOT hand-roll EIP-3009 signature verification or the 402/verify flow; evaluate @x402/mcp createPaymentWrapper first for the tools/call gate and use it if it fits the 401-session → 402-payment → HITL ordering, otherwise use @x402/core verification primitives directly",
    "Use the cloudflare-docs MCP to cross-check the Monetization Gateway seller docs against the x402.org quickstart; on conflict, the x402.org SDK is the primary rail and the Gateway docs are the secondary reference",
    "Replace verifyX402Payment() stub with the SDK-backed verification (signature, amount, asset, network, recipient via facilitator); keep the fail-closed behavior on any mismatch",
    "Add PAYMENT-CONTEXT JWT validation to the verification path per the gateway spec (for traffic fronted by CF's gateway)",
    "Add idempotency-key support to paid tool handlers: accept the key from the payment context, dedupe on (key + params), return the original result on replay — the SDK does not dedupe, this stays hand-rolled",
    "Create the withX402Client buyer-side wrapper for outbound paid calls, with confirmation-callback and null-auto-pay modes (Alchemy's agentic-gateway skill rules/x402/ is a usable reference for the buyer flow only)",
    "Add Bazaar discovery via declareDiscoveryExtension from @x402/extensions/bazaar (both the MCP tool wrapper config and any HTTP endpoints) — this supersedes moving /.well-known/mcp.json",
    "Prove the end-to-end testnet flow: script or test that drives unpaid → 402 → pay (Circle faucet USDC on base-sepolia) → verified → 200",
    "Add tests: real verification accept/reject paths, JWT valid/expired/wrong-issuer, idempotent replay, buyer wrapper confirm/auto-pay, testnet-vs-mainnet env gating",
    "Run lint + typecheck; fix only what this slice broke"
  ],
  "constraints": [
    "Everything x402 stays in ONE module (src/lib/x402.ts) — the rail must remain swappable without touching callers",
    "USDC on Base: 6 decimals; atomic units via the existing decimal-string math, never float ceil",
    "Pay-to address ONLY from env X402_PAY_TO_ADDRESS — never hardcoded",
    "Facilitator URL and network from env (X402_FACILITATOR_URL, X402_NETWORK); mainnet (base) requires explicit X402_MAINNET=true, default is base-sepolia",
    "Testnet USDC comes from the Circle faucet — document the faucet URL in a comment, do not commit any faucet-derived key",
    "verifyX402Payment() must fail closed: any verification error, timeout, or malformed proof → 402, never execute",
    "Idempotency keys: collision-safe storage (D1 or in-memory with TTL for this slice — note the choice in a comment); a replayed key returns the ORIGINAL result byte-for-byte",
    "Code comments describe what the code does — no editorializing, ever",
    "Do not touch prices, feeBps, infer.ts, or the 44 pre-existing typecheck errors"
  ],
  "out_of_scope": [
    "Mainnet real-money transactions (testnet proof only; mainnet is a deploy-time decision)",
    "Virtual Wallets / spending caps (not live on the CF side; HITL approval queue remains the spending control)",
    "Stripe (brief-004)",
    "New tools or price changes"
  ]
}
```

## parked findings (folded in above)

From `brief-003-parked-findings.md` (background x402 research, Oct 13):

1. **Idempotency is a design constraint.** x402 failure mode: a request
   can fail AFTER payment is accepted; a blind buyer retry then pays
   twice. Seller-side fix is idempotency keys on paid handlers —
   specified as acceptance criteria above, not deferred.
2. **Discoverability.** The emerging pattern is `.well-known/mcp` (+
   pricing metadata) and an x402 Bazaar listing manifest; the registry's
   `/.well-known/mcp.json` (item A3) moves to the bare path in this
   slice.

## notes from brief-002 (what it taught)

- The 402 body already conforms to the x402 payment-required shape
  (`x402Version`, `accepts[]`); this slice fills in real verification
  behind it, it does not reshape the body.
- Gate order is load-bearing and unchanged: 401 session → 402 payment
  → HITL interception.
- `toAtomicUnits()` decimal-string math is proven correct against all
  35 locked prices — keep it.
- The stub's "correctly-paid call gets 402" behavior was specified;
  this slice is what flips it to 200-on-verified-payment.
