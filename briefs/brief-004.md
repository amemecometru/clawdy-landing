# brief-004 — Agentic completion + Professionals workflow payment

---
slice: "004"
project: clawdyclaw
status: draft (needs owner lock on fields below before Space Bunny runs it)
depends_on: ["003"]
est_tokens: 14000
---

## owner-lock fields (fill these — do not assume)

```text
PRICE_TABLE:               TBD (dump of the 35 tools + prices from brief-001;
                           Space Bunny: export src/lib/prices.ts or equivalent)
PROFESSIONALS_PRICES_USD:  LOCKED Oct 14 — one-time, human buyer, 4 tiers:
                           T1 $320 = domain ($20 budget; overage raises price)
                                  + personal brand landing page ($300)
                           T2 $375 = T1 + professionals resume
                           T3 $525 = T2 + basic autobiography
                           T4 $900 = T3 + ultimate autobiography w/ video
                                  + imaging revisions
                           (his words: "custom template wins for personal brand")
CRYPTO_OPTION:             LOCKED Oct 14 — manual crypto.
                           $500 and under (T1 $320, T2 $375): buyer pays
                           crypto on the spot, we send a digital receipt.
                           No invoice.
                           Over $500 (T3 $525, T4 $900): we send a crypto
                           invoice; digital receipt on payment.
```

## implementation reference (canonical)

Brief-003 is the foundation — do not regress it:
- `src/lib/x402.ts` is the single x402 module (SDK-backed verify,
  jose/Ed25519 JWT, KV idempotency, Bazaar extension, buyer wrapper).
- Gate order is 401 → 402/verify → HITL → execute → settle →
  idempotency record. Never moves.
- Idempotency lookup runs BEFORE verification (the step-7 fix from
  003's proof). A retry with a spent nonce returns the original
  result, not a 402.
- `test/zz-proof.test.ts` hardcodes Hardhat test keys — fine for
  testnet, must never ship to production.

## goal

Two tracks, one slice:

**Track A — Agentic completion.** Prove the 35 priced tools are
production-ready for commercial agentic commerce: prices audited,
discoverable by outside agents, and transacting rapidly without
obstructing automation.

**Track B — Professionals workflow payment.** One-time payment
for the close-to-production Professionals workflow (domain +
personal-brand website + resume + auto-bio). Stripe primary
(human buyer), crypto option per owner lock.

## why

003 proved money moves. But "the gate earns money" is not the
same as "agents can find it, pay fast, and not get stuck." This
slice closes the gap between a working payment rail and a
commercial product. The Professionals workflow is the first
human-facing product — it needs a buy button, not a seat.

HITL billing is explicitly OUT (owner decision Oct 14): the HITL
workspace is not ready, there is nothing billable there yet, and
the market does not charge per seat. Revisit after the HITL side
is built.

## acceptance_criteria

### Track A — price audit
- [ ] All 35 tools from brief-001's price table listed with current
  prices (no missing tools, no unpriced tools).
- [ ] Each price checked against live comparables; owner's rule
  holds (tick below comps, match if extremely low).
- [ ] Any price that cannot be justified against a comp is flagged,
  not silently kept.

### Track A — discoverability proof
- [ ] An outside agent (not the test harness) discovers the tool
  list via the Bazaar `declareDiscoveryExtension` mechanism.
- [ ] Proof: a script acting as a third-party MCP client lists all
  35 tools with correct prices, without prior knowledge of the
  endpoint structure beyond the Bazaar discovery URL.

### Track A — transaction proof
- [ ] An outside agent completes a paid tool call end-to-end:
  discover → 402 → sign → verify → settle → 200 with result.
- [ ] Measured wall-clock time from 402 to 200 is recorded.
  Target: under 10 seconds on testnet. Anything slower gets a
  written explanation of where the time goes (facilitator?
  verify? settle?).
- [ ] A second call with the same idempotency key returns the
  original result without a second charge (replay protection
  proven, not just asserted).

### Track B — Professionals workflow payment
- [ ] One-time Stripe checkout (Payment Link or embedded) for the
  Professionals workflow at the owner-locked tier prices
  ($320 / $375 / $525 / $900).
- [ ] Buyer selects tier at checkout; successful payment entitles
  the buyer (receipt + access).
- [ ] Crypto option per owner lock: $500 and under (T1/T2),
  buyer pays crypto on the spot, digital receipt sent, no
  invoice. Over $500 (T3/T4), crypto invoice sent; digital
  receipt on payment.
- [ ] No seat model. No subscription. One price per tier, one
  payment, one delivery.

## tasks

1. Export the 35-tool price table; audit each price vs live comps.
2. Build the third-party discoverability proof script.
3. Build the end-to-end transaction proof script (with timing).
4. Verify replay protection with a live double-spend attempt.
5. Implement Professionals workflow one-time payment (Stripe).
6. Implement the crypto option per owner lock.
7. Tests for all new paths; 107 existing tests stay green.

## constraints

- Do not touch the 003 gate order or the idempotency fix.
- Do not use Hardhat test keys for anything except local testnet
  proofs. Production paths must never reference them.
- `test/zz-proof.test.ts` stays as-is (testnet only).
- Stripe keys via env only, never in code.
- The x402 module (`src/lib/x402.ts`) is extended, not forked.

## out of scope

- HITL workspace billing (deferred until HITL is built).
- Per-seat pricing (market rejected it; owner confirmed skip).
- New tools beyond the 35 (no scope creep on the registry).
- 21st.dev agentic design SKUs (separate product track, runs
  parallel after this slice).
- Mainnet deployment (testnet proof only for this slice).

## notes from brief-003 (what it taught)

- The 003 proof used Hardhat test keys because the buyer's private
  key was never in env. For any proof that claims "real buyer,"
  the key must be in env first — otherwise the proof proves the
  rail, not the wallet.
- The facilitator is the latency bottleneck. Measure it; don't
  assume it.
- `createPaymentWrapper` was evaluated and rejected (settles on
  handler return). If a future SDK version defers settlement,
  re-evaluate — don't assume the rejection is permanent.
- Truncated hashes prove nothing. Full hashes or it didn't happen.
