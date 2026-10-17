BRIEF: Pricing fix + PayAI facilitator + go live

ORDER: pricing first, facilitator second, deploy third. Do not skip steps.

PART 1: PRICING — nothing sells below cost

Set these four prices. Not suggestions — set them.

1. transcribe_audio: $0.01/min, 60-min cap ($0.60 max). Was $0.05 flat
   with no cap. Whisper costs ~$0.006/min, so $0.01/min holds margin at
   every duration. Update price-table.ts, the 402 payment requirements,
   and the tool description ("$0.01 per minute, up to 60 minutes").

2. generate_video: $0.10/sec, 30-sec cap ($3.00 max). Was $1.00 flat with
   no cap. Video generation is the most expensive call we sell; a flat
   rate is a blank check. Update price-table.ts, 402 requirements, and
   description ("$0.10 per second, up to 30 seconds").

3. cloudflare_ai: $0.005. Was $0.02 vs ~$0.0004 cost (50x markup with no
   justification). $0.005 is ~12x cost — still trivially cheap for the
   buyer, defensible as wrapper margin, and stops the embarrassment.
   Update price-table.ts and description.

4. flux_image: check the model slug in the code, then apply this rule:
   - If FLUX.1-schnell (cost ~$0.0004-$0.003): set $0.005.
   - If FLUX 1.1-pro or equivalent (cost ~$0.025-$0.05): keep $0.05
     and rewrite the description to name the pro model.
   No other outcome. The slug decides, not a judgment call.

Then trace the remaining 31 tools. Template: tool-cost-basis.md. For each:
find the exact provider/model slug in the code, look up the per-call cost,
compute margin. Any negative margin: apply the same treatment as above
(reprice to hold margin, or rewrite description to justify wrapper pricing).
Done when zero tools price below cost.

The 19 wrapper-margin tools ($0.10-$0.50 on $0.00-$0.015 vendor costs):
rewrite each description to say the price buys the agentic wrapper
(orchestration, scheduling, guardrails, receipting). If a description
cannot honestly justify the markup, reprice it to 3x vendor cost.

PART 2: FACILITATOR — swap to PayAI

Current: public x402.org facilitator, fails ~1-in-3 calls.
Target: https://facilitator.payai.network
Verified: supports base-sepolia (v1) and eip155:84532 (v2 exact), has the
bazaar extension, no API key required, testnet free.

1. Set X402_FACILITATOR_URL=https://facilitator.payai.network
   (Worker secret in dashboard, or env for local tests).

2. Re-run the Track A transaction proof against PayAI:
   - Unpaid call returns 402 with correct price, network, asset.
   - Sign, verify, settle, 200 with result.
   - Measure 402-to-200 wall time. Target under 10s.
   - Run it 5 times. Zero failures required. The old facilitator failed
     1-in-3; if PayAI fails even once, report it, do not hand-wave.

3. Re-run the replay proof: same idempotency key returns byte-identical
   result without re-settling. Confirm PayAI honors idempotency.

PART 3: GO LIVE

1. npx wrangler deploy. Confirm green, no trigger errors.

2. Hit one tool endpoint unpaid. Confirm the 402 payment requirements
   carry the correct X402_PAY_TO_ADDRESS (the mainnet wallet set in
   dashboard secrets).

3. If a mainnet proof is wanted: run one $0.001 tool call end-to-end on
   Base mainnet (eip155:8453, also supported by PayAI). Confirm USDC lands
   in the pay-to wallet. This is the first real revenue event.

DO NOT
- Change any tool's functionality. Pricing and facilitator only.
- Touch the 003 gate order (401 -> 402/verify -> HITL -> execute -> settle).
- Touch the idempotency logic. It works.
- Add new tools or new features. This is a hardening + launch task.
