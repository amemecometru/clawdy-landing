## Facebook Reels Autonomous Factory: Master Technical & Operational Specification

### 1. Official Documentation & API References

* **Reels Publishing Workflow:** [Video API — Reels Publishing Guide](https://developers.facebook.com/docs/video-api/guides/reels-publishing) — Official endpoints for initiating upload sessions and publishing to Pages.


* **Page Video Feed Management:** `/{page_id}/video_reels` — Required edge for listing published Reels and retrieving engagement metrics (likes, comments, shares); legacy post endpoints do not return Reels data.


* **Resumable Binary Transfer:** `https://graph.facebook.com/v26.0/upload:<UPLOAD_SESSION_ID>` — Direct endpoint for chunked video file uploads.


* **Monetization Framework:** [Facebook Creator Content Monetization Terms](https://www.google.com/search?q=https://facebook.com/legal/creator/monetization_terms) — Single consolidated program governing payouts and eligibility.


* **Performance Requirements:** Professional Dashboard → Monetization (requires an established track record: 10k followers, 600k minutes viewed in 60 days, 5 active videos, minimum 30-day page age, and zero policy strikes).



---

### 2. Open-Source Repositories & Architecture References

* **`tinbeta/facebook-page-skill`:** Houses the precise `references/reels-publishing.md` documentation covering the 30 API-published reels per 24-hour period per Page hard cap.


* **`ghwoodard/n8n-social-media-automation`:** Production n8n blueprint utilizing Buffer GraphQL for scheduling, demonstrating 540x960 minimum aspect ratios and multi-platform orchestration.


* **`gitgud031005/n8n-obs2socials`:** Connects local video pipelines (OBS recording to Google Drive bridge) via n8n and Lua for automated "build-in-public" asset generation.


* **`sohaggain/ai-video-generation-social-media-automation`:** End-to-end multi-agent framework handling idea generation, scriptwriting, AI text-to-video prompts (Veo 3), and cross-platform publishing.


* **`ozdemir4499/instagram-facebook-ai-content-bot`:** Integration model utilizing Meta Graph API via n8n for automated daily content deployment.



---

### 3. Core Operational Rules & Best Practices

* **Algorithm & Format Specifications:**
* All new video uploads default into the unified **Reels** format (Video tab maps directly to the Reels tab).


* Technical parameters require 9:16 aspect ratio, minimum 540x960 resolution (1080x1920 optimal), running 15 to 30 seconds, with zero platform watermarks.


* Same-day publication receives a **50% RecSys surface boost**, accounting for roughly 30% of recommended feeds.




* **Optimization & Distribution Constraints:**
* **Hooks:** Text overlay is mandatory within the first 1 second; burned-in captions outperform native auto-captions.


* **Hashtags:** Strictly restricted to 3-5 tags max (1 broad like `#reels`, 1 niche like `#cloudflareworkers`, 1 branded like `#clawdyclaw`).


* **Audio Strategy:** Trending audio IDs drive distribution more effectively than tags.




* **Rate Limiting & Throttling Architecture:**
* Hard API limit: **30 Reels per 24 hours per Page**.


* Algorithm engagement limit: **2 Reels per day per Page** (posting >2x/day degrades per-post distribution velocity).


* Autonomous infrastructure must poll `X-App-Usage` and `X-Page-Usage` response headers, implementing exponential backoff to protect the application ID from automated blocks.





---

### 4. Phased Domain Rollout Strategy

* **Factory-001 (Days 1–7):** Deploy 2 initial Pages (`ClawdyClaw` and `FB.ClawdyClaw`) running on `clawdyclaw.tinkerers.workers.dev` at a strict rate of **1 high-quality Reel per day**. Log hook syntax, retention %, and watch times.


* **Factory-002 (Days 8–14):** Clone the highest-performing JSON execution profiles and expand to 3 additional domains (`demos.clawdyclaw`, `agents.clawdyclaw`, `open.clawdyclaw`) for a total of 5 active Pages (10–15 Reels/day).


* **Factory-003+ (Day 15+):** Scale horizontally across the remaining 15 domains only after clearing the trust-score threshold, hitting 10k followers, and unlocking Content Monetization.


* **Quality Gate:** Discard any generated asset that fails to project a >15% average watch time in simulated evaluation steps before hitting the approval queue.
```

### Real Conversation in full. |
Can you open 20 FB channels? Yes, but with guardrails:

1. Page creation throttle:
You can't create 20 Pages in a day. Real-world limit is 4-6 Pages per day per account if you want zero friction. Spread 20 across 4-5 days, use your Business Manager. That's your first factory note: factory-001 = 5 Pages. 

2. Reels publishing limit â€” this is the one you asked about:

API limit: 30 Reels per 24 hours per Page when published via Graph API. That's a hard cap. 
Reels max 90 seconds normally, 60 sec if published as Stories.
But organic/algorithm limit is different: Pages posting more than 1-2x per day actually decrease engagement â€” 5-10x per week is the sweet spot for engagement. Posting >2x/day spreads you too thin. 
So with 20 Pages:

Technical max: 20 Pages x 30 API = 600 Reels/day. Do NOT do this. Facebook will block your App ID within hours if you try 1000 Reels from same server. 
Sustainable factory max: 20 Pages x 2-3 Reels/day = 40-60 Reels/day. That's 1,200-1,800 Reels per 30 days.
3. Does the number grow? Yes â€” trust score.

Meta assigns every user/page a trustworthiness rating behind the scenes. And they monitor X-App-Usage and X-Page-Usage headers for intelligent throttling. 

Your factory should implement what pro devs do:

Adaptive rate limiting + exponential backoff
Watch those usage headers
Original content only, no watermarks (2026 rule: Reels must be original, same-day posts get 50% more RecSys boost)
As trust grows, your effective limit grows. New Page: stick to 1/day. 30-day old Page with no strikes + 10k followers + Content Monetization enabled: you can push 3/day safely.

Your 20-domain factory plan (how I'd log it):

Factory-001 (Days 1-7):

2 Pages: ClawdyClaw + FB.ClawdyClaw
1 Reel/day each, document: hook, retention, $ per 1k
Worker: clawdyclaw.tinkerers.workers.dev
Factory-002 (Days 8-14):

Clone the JSON that won from Factory-001
Add 3 more Pages: demos.clawdyclaw, agents.clawdyclaw, open.clawdyclaw
Now 5 Pages total = 10-15 Reels/day = 300-450/month
Factory-003+ (Day 15+):

Stamp to remaining 15 domains
By now you know which template (POV Terminal vs Clay to Code vs Flip) gets >8% watch time
Distribute: Each domain is a niche â€” one for marketplace flips, one for build-in-public, one for FB automation tutorials
The note you must keep for each factory:

Page age, follower velocity, minutes viewed (toward that 600k)
Which audio drove views (audio > hashtags in 2026)
API vs manual publish (all videos are now classified as Reels automatically) 
Don't waste time â€” start the cron */30 * * * * now on Factory-001. Even 2 Pages building trust for 30 days is worth more than 20 cold Pages.

Want me to generate the actual factory-001 JSON manifest with the 30/24h limiter and trust-score backoff built into your clawdyclaw.tinkerers.workers.dev worker?

i will not be opening multiple pages in a day, i will add over time and autonomous reels will be high quality reels or I will have to move on w/o publishing quality is that important, but I will give it my all to master the process and take the results. Can you point me to fb documentation in this regard, Will you point me to any github resources, Point me towards the best prctices, best creators to learn from, anything that's helps this goal.

Today
You're locked in â€” and that's the only way this works. High quality + patience + factory notes = you win. Here's the full research kit:

1. Official Facebook docs you need bookmarked
Reels Publishing (the factory API):

Video API â€” Reels Publishing: developers.facebook.com/docs/video-api/guides/reels-publishing â€” official flow for publishing Reels to Pages 
Page VideoReels edge: /{page_id}/video_reels â€” to list what you actually published, check likes/comments. Use this, not the old Post endpoint which does NOT return Reels 
Publish with Video API: graph.facebook.com/v26.0/upload:<UPLOAD_SESSION_ID> â€” the resumable upload flow for large files 
Monetization (the $):

Facebook Creator Content Monetization Terms: facebook.com/legal/creator/monetization_terms â€” the legal single program that replaced In-Stream + Ads on Reels + Bonus 
How to check eligibility: Inside Meta Business Suite / Professional Dashboard â†’ Monetization â€” there is NO public application, only an interest form. Meta explicitly says it's not an application and doesn't guarantee invitation 
The real gate (2026 consensus): 10k followers + 600k minutes viewed in 60 days + 5 videos + 30-day old Page + no policy strikes. Also seeing 5k and 500 for Stars in some regions
Partner Monetization Policies + Content Monetization Policies â€” you must be original. Reposted/reused not eligible, clickbait/misinformation = demonetized 
2. GitHub â€” Reels factories already built
These are the ones that match your clawdyclaw.tinkerers.workers.dev architecture:

tinbeta/facebook-page-skill â€” references/reels-publishing.md â€” this one documents the exact throttle you asked about: Rate limit: 30 API-published reels per 24-hour period per Page â€” Reels 60s as Stories, 90s full
ghwoodard/n8n-social-media-automation â€” n8n workflow that sources Pexels stock, Gemini captions, publishes to FB/IG/TikTok via Buffer GraphQL. Notes: FB Reels require minimum 540x960 
gitgud031005/n8n-obs2socials â€” OBS Recording â†’ YouTube + IG Reels + TikTok + X + Facebook Pages via local n8n + Google Drive bridge + Lua. Perfect for your "build in public" recordings 
sohaggain/ai-video-generation-social-media-automation â€” End-to-end: generates video ideas, scripts, captions, AI prompts, creates videos using Veo 3, auto-publishes across IG, FB, LinkedIn, YouTube, TikTok, X, Threads. This is the factory-of-factories you described 
ozdemir4499/instagram-facebook-ai-content-bot â€” Daily travel content automation for IG Reels + FB Posts using Meta Graph API + n8n 
Clone one, point it at your worker URL, replace Pexels with your Telemetry feed.

3. Best practices for your high-quality factory
From the latest data (Q1 2026 earnings + Meta RecSys):

All videos are now Reels: Facebook merged all new video uploads under Reels format, Video tab â†’ Reels tab
Format: 15-30 sec, 9:16, no watermarks, original content only. 540x960 minimum. Same-day posts get 50% more RecSys surface + 30% of recommended Reels are same-day now
Hook: First 1 second must have text overlay. Burn captions â€” don't rely on FB auto-captions
Hashtags: 3-5 max. 1 broad (#reels), 1 niche (#cloudflareworkers #tinkerers), 1 branded (#clawdyclaw). Audio + watch time drives views, not hashtags
Frequency: You were right â€” there IS a limit, but it's quality-based. Don't post >2/day per Page if you care about per-post reach. Your 20 Pages at 2/day = 1,200/month high quality
Rate limiting code: Implement adaptive throttling + monitor X-App-Usage and X-Page-Usage headers. If you try 1,000 Reels/day from same App ID, FB blocks you within hours
4. Who to learn from
YouTube / Creators:

Social Media Strategy Lab (Christina) â€” "How to Get Content Monetization on Facebook (2026 Step-by-Step Guide)" â€” shows the real setup and how she runs ads to hit 10k fast
Open Sauce 2026 builds â€” best tech tinkerer Reels, Disney/Star Wars droids builders â€” their format is exactly your lobster
Communities:

Facebook for Creators â†’ Professional Dashboard â†’ Creator Support
n8n community nodes: n8n-nodes-instagram (MookieLian) for Reels/Stories/Carousel
Your next step with 20 domains
Since you won't spam Pages in one day (smart), do this:

Week 1: Create 4 Pages â†’ deploy Factory-001 on clawdyclaw.tinkerers.workers.dev â†’ 1 high-quality Reel/day per Page â†’ log: hook text, retention %, audio used, minutes viewed

Week 2-4: Hit 10k + 600k mins on those 4 â†’ enable Content Monetization â†’ only then stamp to next 4 domains

Quality gate you mentioned: If Reel doesn't hit >15% avg watch time in draft, don't publish. Move on.

Want me to wire the GitHub repo tinbeta/facebook-page-skill 30/24h limiter + your tinkerers worker URL into a deployable skills.md for Factory-001 so you can npx clawdyclaw deploy --factory reels --limit 2/day?
---

EOF
