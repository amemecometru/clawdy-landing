# Price audit — the 35-tool table (brief-004 Track A)

Audit date: 14 Oct 2026. Source of truth: `src/api/tools.ts` → `x402_price_usd`,
exported as data in `src/lib/price-table.ts` (`PRICE_TABLE`, `priceTableByCategory`,
`priceTableRows`). No price was changed by this audit — every finding below is a
flag for the owner, per brief-004: *"Any price that cannot be justified against a
comp is flagged, not silently kept."*

## How to read the verdicts

Each tool is compared against two floors:

- **Comp floor** — the cheapest public price for the same raw capability
  (an email send, an LLM call, a vector query, a web search). Researched live.
- **Work floor** — what the tool actually costs us to run, i.e. the provider call
  inside it plus our orchestration. The comp floor alone understates an agentic
  tool, because nobody sells "run this agent step" at the bare token rate.

| Verdict | Meaning |
| --- | --- |
| **TICK** | Priced below the credible comp. Leave it. |
| **MATCH** | At or under the work floor. Fine as is. |
| **FLAG** | Cannot be justified — the price is several times the work floor, or is structurally wrong (flat fee against a per-unit comp with no cap). Needs an owner decision. |

## The table

| # | Tool | Category | Surface | Price | Atomic | Comp floor | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `list_tasks` | orchestration | live | $0.001 | 1000 | $0.0009 (Make credit) | **TICK** |
| 2 | `classify_intent` | orchestration | live | $0.005 | 5000 | $0.0015 (AWS Comprehend) | **FLAG** |
| 3 | `send_email` | communication | live | $0.25 | 250000 | $0.0001 (Amazon SES) | **FLAG** |
| 4 | `draft_reply` | communication | live | $0.05 | 50000 | $0.10 (Instantly, productized) | **TICK** |
| 5 | `draft_personalized_outreach` | communication | live | $0.25 | 250000 | $0.03 (Instantly) / $0.50 (Lavender Ora) | **MATCH** |
| 6 | `draft_follow_up` | communication | live | $0.25 | 250000 | $0.10 (Instantly) | **MATCH** |
| 7 | `schedule_follow_up` | communication | live | $0.25 | 250000 | $0.027 (Zapier task) | **FLAG** |
| 8 | `search_threads` | communication | stub | $0.01 | 10000 | $0.00 (Gmail API) | **MATCH** |
| 9 | `send_sms` | communication | planned | $0.25 | 250000 | $0.0083 (Twilio/segment) | **FLAG** |
| 10 | `post_social` | communication | planned | $0.10 | 100000 | $0.00 (Meta/LinkedIn) | **FLAG** |
| 11 | `schedule_post` | communication | planned | $0.10 | 100000 | $0.001 (Buffer) | **FLAG** |
| 12 | `run_scraper` | research | live | $0.50 | 500000 | $0.0002/request (ScrapingBee) | **MATCH** (large runs) |
| 13 | `web_search` | research | planned | $0.006 | 6000 | $0.005 (Brave) | **MATCH** |
| 14 | `fetch_url` | research | planned | $0.01 | 10000 | $0.00075 (Firecrawl Scale) | **MATCH** |
| 15 | `monitor_keywords` | research | planned | $0.25 | 250000 | $0.015/run (Exa Monitors) | **FLAG** |
| 16 | `model_infer` | inference | live | $0.05 | 50000 | $0.00075 (gpt-4o-mini) | **FLAG** |
| 17 | `hf_infer` | inference | live | $0.02 | 20000 | $0.00007 (HF passthrough) | **FLAG** |
| 18 | `cloudflare_ai` | inference | live | $0.02 | 20000 | $0.0004 (Workers AI) + free tier | **FLAG** |
| 19 | `tts_speak` | inference | planned | $0.10 | 100000 | $0.015/1k chars (Aura) | **TICK** |
| 20 | `transcribe_audio` | inference | planned | $0.05 | 50000 | $0.0043/min (Deepgram) | **FLAG** |
| 21 | `summarize_document` | inference | planned | $0.05 | 50000 | $0.0055 (Flash-Lite) | **FLAG** |
| 22 | `flux_image` | creative | live | $0.05 | 50000 | $0.0004 (CF schnell) / $0.003 (Replicate) | **FLAG** |
| 23 | `generate_video` | creative | planned | $1.00 | 1000000 | $0.25 / 5s (Runway Gen-4 Turbo) | **FLAG** |
| 24 | `edit_image` | creative | planned | $0.08 | 80000 | $0.04 (BFL Kontext pro) | **TICK** |
| 25 | `http_request` | automation | planned | $0.05 | 50000 | $0.0000003 (CF Workers) | **FLAG** |
| 26 | `schedule_cron` | automation | planned | $0.25 | 250000 | $0.00 (CF Cron / Vercel) | **FLAG** |
| 27 | `run_code` | automation | planned | $0.10 | 100000 | $0.083 / 30 min (E2B 2 vCPU) | **MATCH** |
| 28 | `file_write` | automation | planned | $0.02 | 20000 | *no comp researched* | **FLAG** |
| 29 | `create_payment_link` | commerce | planned | $0.25 | 250000 | $0.00 (Stripe Payment Links) | **FLAG** |
| 30 | `check_payment` | commerce | planned | $0.01 | 10000 | $0.00 (percentage-only fees) | **MATCH** |
| 31 | `create_invoice` | commerce | planned | $0.50 | 500000 | $0.00 to draft (Stripe) | **FLAG** |
| 32 | `vector_search` | memory | planned | $0.01 | 10000 | $0.000004 (Pinecone RU) | **FLAG** |
| 33 | `save_memory` | memory | planned | $0.02 | 20000 | $0.0004 (Mem0) | **FLAG** |
| 34 | `query_sheet` | memory | planned | $0.01 | 10000 | $0.00 (Sheets API quota) | **FLAG** |
| 35 | `update_crm` | memory | planned | $0.10 | 100000 | $0.01 (HubSpot credit) | **MATCH** |

Tally: **4 TICK · 9 MATCH · 22 FLAG** (one flag, `file_write`, has no researched comp).

## The three that matter most

1. **`cloudflare_ai` ($0.02) is undercut by its own vendor's free tier.**
   Workers AI gives 10,000 neurons/day free; a 1K-in/1K-out call is ~39 neurons
   (~$0.0004). At $0.02 we sell ~50 calls for the price of one paid call, and a
   buyer running 250 calls/day pays us for a tier they get free at the vendor.
2. **`flux_image` ($0.05) is priced 17–125× the model the tool names.** We
   advertise FLUX.1-schnell: $0.0004/image on Cloudflare, $0.003 on Replicate.
   $0.05 matches FLUX 1.1 *pro* or Ideogram v3 — different, ~15× costlier models.
   Either reprice to ~$0.005 or name the model the price pays for.
3. **Two tools are structurally unprofitable, not merely high.**
   `transcribe_audio` ($0.05 flat vs $0.0043/min) and `generate_video` ($1.00
   flat vs $0.25 per 5 s) charge a flat fee against a per-unit comp with **no
   duration cap**, so a 60-minute transcription or a 60-second video sells far
   below cost. These need per-unit pricing or a hard cap, not a price tweak.

## The pattern behind the other flags

Every flag in the communication, commerce and automation categories has the same
shape: we charge a flat $0.10–$0.50 for what the vendor sells per unit at
$0.00–$0.015. Stripe explicitly charges nothing to create a payment link or draft
an invoice; Google charges nothing to read a sheet; Meta and LinkedIn charge
nothing to post; Cloudflare charges nothing to schedule a cron. The agentic
wrappers (approval queue, classification, enrichment, multi-channel fan-out) are
the actual product — and they are not free either.

**Recommendation to the owner:** for the flagged tools, either (a) reprice to the
work floor plus a thin margin, or (b) state the bundle explicitly in the tool
description so the price reads as "handled by an agent with a human in the loop"
rather than "a raw provider call". Tools 3, 9, 29 and 31 (`send_email`,
`send_sms`, `create_payment_link`, `create_invoice`) are the most exposed: they
are on the execution surface or one approval click away, and each is 10–2500× a
published price for the same primitive.

No comps were found for `file_write`; sandbox object storage is priced per
GiB-hour inside the `run_code` sandbox rather than per write, so its floor is
effectively $0. Treat $0.02 as unjustified until the sandbox cost is known.
