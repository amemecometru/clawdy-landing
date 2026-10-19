# 21st.dev agentic design SKUs — market comps + draft price sheet

Prepared 2026-10-15 (Thu evening ET), from his Oct 15 00:54Z ask: "write these up so the
payments are ready to go when we catch up building the service." He framed five sellable units:
rapid react components, landing pages, oauth, studios, pricing pages — sold to agents building
React web applications, paid per call via x402. This is a parallel product track (post-004),
not one of the 5 slices. 004 has landed; this is the price-first write-up that worked for 001.

## What the market charges today (all human-seat products — no per-call agentic comp exists)

| Product | Model | Key numbers (verified Oct 15, 2026) |
|---|---|---|
| 21st.dev | Subscription | Builder $6/mo (yearly); Builder+AI $15/mo yearly ($20 quarterly) for 500–2,000 AI credits; extra credits $5/100. Most components free/MIT; free tier = limited copies + 2 installs/day |
| v0 (Vercel) | Token-metered credits | Free $5/mo; Premium $20/mo (being sunset for new users); Team $30/user/mo current entry; Business $100. Rates: Mini $1/$5, Pro $3/$15, Max $5/$25 per 1M in/out tokens. A complex component gen (~2K in + 4K out tokens) ≈ $0.006 Mini / $0.066 Pro. Heavy agentic session $2–5 |
| Lovable | Credit-metered | Pro $25/mo (100 credits); top-ups $0.30/credit. Published build costs: small tweak 0.50 cr, auth 1.20 cr, landing page w/ images 1.70–2.00 cr. Subscription-cost allocation at Pro: ≈ $0.13 / $0.23 / $0.30 / $0.43–0.50 per task |
| Subframe | Seat | Free / Pro $29/user/mo. Visual editor + MCP server export (the agentic-relevant path) |

Sources: 21st.dev pricing via techpilot.ai (crawled Oct 15) and 21st-dev/magic-mcp SKILL.md (GitHub);
v0 via aiwiki.ai, dev.to review (verified May 23 2026), therundown.ai (pricing checked Aug 30 2026);
Lovable via emergent.sh, omidsaffari.com, totalum.app (all Oct 2026); Subframe via subframe.com.
All sit inside Cloudflare's $0.001–$100 per-request band.

## The whitespace

Nobody sells generated UI per-call to agents. Every comp above is a seat or credit pool for
humans. The design SKUs are clawdyclaw's first product where the BUYER IS AN AGENT and the
purchase is one tool call — so prices should be anchored on vendor cost x margin, then checked
against what a human burns per generation inside those subscriptions ("tick below comps, match
if extremely low" — his locked rule).

## Draft SKU sheet — HIS CALL, not locked

| SKU | Sells | Vendor cost est. (pay-as-you-go inference) | Suggested per-call range | Rationale |
|---|---|---|---|---|
| generate_component | One React/Tailwind component from a prompt | $0.01–0.07 | $0.10–0.25 | Lovable allocates ~$0.13–0.23/task; v0 gen costs $0.006–0.07. $0.15 sits below the Lovable burn with 2–10x vendor margin |
| generate_pricing_page | Full pricing section/page from a prompt | $0.08–0.30 | $0.30–0.60 | Multi-section output; heavier token load than a single component |
| generate_landing_page | Full landing page from a prompt | $0.10–0.50 | $0.50–1.00 | Lovable allocates ~$0.43–0.50 for landing w/ images; $0.50 matches the low end of the comp |
| scaffold_oauth | Working OAuth login flow (provider + routes + UI) | $0.10–0.30 | $0.50–1.00 | Lovable allocates ~$0.30 for auth; the value is correct wiring, not tokens — priced as a convenience premium |
| generate_design_pack | Design system / studio pack (tokens + component set) | $0.50–2.00 | $1.50–3.00 | Multi-artifact output; within CF's $100 cap with headroom |

## Structural note (same problem as the 004 price flags)

Generation cost varies with iteration count, not with the SKU name — the exact structural issue
flagged on transcribe_audio $0.05 and generate_video $1.00 in 004. Do NOT price "unlimited
revisions in one call." Price per delivered artifact; every revision/iteration is a new paid call.
That also matches how the agentic loop actually works (agent iterates until satisfied) and keeps
the margin math honest. State this in the tool description.

## What the bunny must do before he locks (cost-basis rule)

Same as tool-cost-basis.md: trace the exact provider/model slug per SKU from code and measure
real per-call cost. Two cost realities to pin down first:
1. Which inference serves each SKU — his DAHL tokens (gifted, finite) vs OpenRouter free models
   (expiry-dated, 429-prone) vs paid. Prices must survive the free tiers ending.
2. Whether iteration calls re-run full context (cheap at flash-class, expensive at pro-class).

## Open questions for him (not blockers to drafting the brief)

- Is the buyer his own agents, outside agents via Bazaar, or both? (discoverability proof
  needed either way — same acceptance pattern as 004's Track A)
- Component source: net-new generation, 21st.dev marketplace retrieval + adaptation, or both?
  (retrieval is near-zero vendor cost — different margin structure, maybe a cheaper tier)
- Free-tier seeding: 21st.dev gives limited free copies; does he want a free discovery call
  (search/browse) with only generation paid? That pattern matches 004's discovery-near-free band.

Next step when he locks prices: these become a brief slice (or a parallel track brief) — tools +
x402 gating + price registry entries, same pattern as 001/002.
