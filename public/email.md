**Your instinct to separate human and agentic email onto different subdomains is exactly right — Cloudflare's deliverability docs explicitly recommend this.** Each subdomain builds its own sender reputation with inbox providers, so agentic traffic can't drag down your human-facing deliverability (or vice versa). Here's the architecture I'd recommend for `clawdyclaw.com`.

### Recommended architecture

```
clawdyclaw.com (apex)          → Human-facing email (inbound + outbound)
mail.clawdyclaw.com (subdomain) → Agentic email (inbound + outbound)
```

I'd avoid `agents.clawdyclaw.com` for exactly the reason you raised — the name itself could trigger heuristic-based filtering. Pick something neutral like `mail.`, `svc.`, `app.`, or `auto.`. The subdomain name doesn't appear in the `From:` header unless you want it to; you control the local part (`agent@mail.clawdyclaw.com`, `notifications@mail.clawdyclaw.com`, etc.).

### Domain 1: `clawdyclaw.com` — Human-facing

**Inbound (Email Routing — already set up):**
- `support@clawdyclaw.com` → your support inbox
- `info@clawdyclaw.com` → general inquiries
- `hello@clawdyclaw.com` → human contact
- Catch-all → drop or forward to a monitoring address

**Outbound (Email Sending — already activated):**
- `support@clawdyclaw.com` — replies to support tickets
- `noreply@clawdyclaw.com` — transactional confirmations
- `team@clawdyclaw.com` — human-to-human communications

**Destination address:** You mentioned wanting to move away from your personal Gmail. You can add a new destination address (e.g., a Google Workspace or ProtonMail address on `clawdyclaw.com` itself) and update your routing rules to point there. Email Routing requires the destination to be verified before it can receive forwarded mail.

### Domain 2: `mail.clawdyclaw.com` — Agentic

**Inbound (Email Routing on subdomain):**
1. Go to [Email Routing](https://dash.cloudflare.com/8a460817bc554362e040644c8e003fb9/clawdyclaw.com/email/routing) → **Settings** → **Subdomains** → add `mail.clawdyclaw.com`
2. Cloudflare adds the required MX, SPF, and DKIM records automatically
3. Create routing rules on the subdomain — route inbound agentic emails to a **Worker with an `email` handler** instead of a forwarding address. This is where your MCP/agentic layer picks up the message, parses intent, and acts on it. Cloudflare has an [email agent example](https://github.com/cloudflare/agents/tree/main/examples/email-agent) for this pattern.
4. Subaddressing (`+detail`) is supported — e.g., `agent+task123@mail.clawdyclaw.com` all routes to the same handler, and your Worker can parse the `+task123` part as context.

**Outbound (Email Sending on subdomain — onboard separately):**
1. Go to [Email Sending](https://dash.cloudflare.com/8a460817bc554362e040644c8e003fb9/email-service/sending) → **Onboard Domain** → choose `mail.clawdyclaw.com`
2. Cloudflare adds `cf-bounce` MX, SPF, DKIM, and DMARC records to the subdomain automatically
3. Once verified, send from addresses like:
   - `agent@mail.clawdyclaw.com` — agentic responses
   - `notifications@mail.clawdyclaw.com` — automated alerts
   - `system@mail.clawdyclaw.com` — system-generated messages

### Why this works for your spam/reputation concern

| Factor | Apex (`clawdyclaw.com`) | Subdomain (`mail.clawdyclaw.com`) |
|---|---|---|
| DKIM signature | `cf-bounce._domainkey.clawdyclaw.com` | `cf-bounce._domainkey.mail.clawdyclaw.com` |
| SPF record | `cf-bounce.clawdyclaw.com` | `cf-bounce.mail.clawdyclaw.com` |
| DMARC policy | `_dmarc.clawdyclaw.com` | `_dmarc.mail.clawdyclaw.com` |
| Sender reputation | Independent | Independent |

Each subdomain gets its own DKIM keys, SPF record, and DMARC policy — all automatically configured during onboarding. Inbox providers evaluate them independently. If agentic mail generates higher bounce or complaint rates (which is common for automated mail), your human-facing `clawdyclaw.com` reputation is completely insulated.

### DMARC recommendation

Start with `p=none` (monitor only) on both domains, watch the DMARC reports for a few weeks, then gradually tighten to `p=quarantine` and eventually `p=reject`. Cloudflare handles SPF/DKIM alignment automatically, so once you see everything passing in the reports, tightening is safe.

### API token strategy

One token with **Email Sending: Edit** permission works for all onboarded domains on your account (both `clawdyclaw.com` and `mail.clawdyclaw.com`). But since you want clean separation, you could create two tokens — one scoped to human sending, one to agentic — though the permission model is account-level, not domain-level, so both tokens would technically have access to both domains. A single token is simpler and equally secure if you control who has access to it.

### Limits to be aware of

- Up to **30 domains** per zone for Email Routing + Email Sending combined (you'd use 2 of 30)
- Max message size: **5 MiB** including attachments
- You must be using Cloudflare DNS for the zone (you already are)

### Next steps

1. **Create your API token** with Email Sending: Edit permission (My Profile → API Tokens)
2. **Onboard `mail.clawdyclaw.com`** for Email Sending at [Email Sending](https://dash.cloudflare.com/8a460817bc554362e040644c8e003fb9/email-service/sending) → Onboard Domain
3. **Add `mail.clawdyclaw.com`** to Email Routing at [Email Routing](https://dash.cloudflare.com/8a460817bc554362e040644c8e003fb9/clawdyclaw.com/email/routing) → Settings → Subdomains
4. **Create routing rules** on the subdomain pointing to a Worker email handler for agentic processing
5. **Test outbound** with the curl command from your first message, using `--mail-from agent@mail.clawdyclaw.com`

Once you've created the API token and onboarded the subdomain, I can help you build the Worker email handler for the agentic inbound side, or wire up the SMTP/REST integration for outbound. Which piece do you want to tackle first?
---

#############

**Using a completely separate, unaffiliated domain for agentic outbound is a smart move — it gives you a clean sender identity with zero brand association, and Cloudflare's deliverability guidance explicitly supports this pattern.** Each domain carries its own reputation, so a neutral domain means recipients evaluate the email on its content, not its domain name.

### Your options, ranked by practicality

| Option | Pros | Cons |
|---|---|---|
| **A new neutral domain** (e.g., `logiclemonai.org`) | Full control, clean identity, professional TLD | Need to register it (~$10-15/yr) |
| **`webhooks.email`** | Can't register `.email` TLD subdomains yourself — this is a third-party service | Not a domain you own; can't control DNS/Sending |
| **`.xyz` domain** | Cheap (~$1-10/yr), neutral | Some spam filters weight `.xyz` lower than `.org`/`.com` |
| **`.uk` domain** | Strong TLD reputation, UK presence implied | Requires UK address for WHOIS; Nominet rules |

**My recommendation: register a clean `.org` or `.com` domain** (like `logiclemonai.org`) — `.org` carries trust signals, and you fully control DNS, SPF, DKIM, DMARC, and Email Sending onboarding. [ Avoid `.xyz` for outbound email if deliverability is a priority; some inbox providers apply stricter filtering to `.xyz` domains by default. ]

### How to set it up once you have the domain

**1. Register the domain and add it to Cloudflare**
- Register through [Cloudflare Registrar](https://dash.cloudflare.com/8a460817bc554362e040644c8e003fb9/domains) (or transfer from another registrar)
- Cloudflare becomes the authoritative DNS — required for Email Service

**2. Onboard for Email Sending**
- Go to [Email Sending](https://dash.cloudflare.com/8a460817bc554362e040644c8e003fb9/email-service/sending) → **Onboard Domain** → select your new domain
- Cloudflare auto-adds `cf-bounce` MX, SPF, DKIM, and DMARC records
- Once verified, you can send from any address on that domain

**3. (Optional) Onboard for Email Routing — if you want agentic inbound there too**
- Go to [Email Routing](https://dash.cloudflare.com/8a460817bc554362e040644c8e003fb9/email-service/routing) → onboard the domain
- Route inbound to a Worker email handler for agentic processing
- This gives you a fully separate agentic email channel: both directions, completely unaffiliated with `clawdyclaw.com`

**4. Use the same API token**
- Your existing token with **Email Sending: Edit** works for all domains on the account
- SMTP credentials stay the same: `smtp.mx.cloudflare.net:465`, username `api_token`, password = your token
- Just change `--mail-from` to the new domain:

```sh
curl --ssl-reqd \
  --url "smtps://smtp.mx.cloudflare.net:465" \
  --user "api_token:$CF_API_TOKEN" \
  --mail-from "agent@logiclemonai.org" \
  --mail-from "toofargone.trading@gmail.com" \
  --upload-file mail.txt
```

### Your resulting architecture

```
clawdyclaw.com (apex)
├── Inbound:  Email Routing → support@, info@, catch-all → human inbox
└── Outbound: Email Sending → support@, noreply@, team@
     ↓ human-facing, brand-associated

logiclemonai.org (separate domain)
├── Inbound:  Email Routing → Worker email handler (agentic processing)
└── Outbound: Email Sending → agent@, notifications@, system@
     ↓ agentic, neutral identity, no brand association
```

### Key point about the `From:` header

The recipient sees the `From:` display name and address — not your SMTP credentials or which account sent it. So `agent@logiclemonai.org` looks like any other email from a neutral organization. You can set the display name to whatever fits the task:

```
From: "Workflow Assistant" <agent@logiclemonai.org>
From: "System Notifications" <notifications@logiclemonai.org>
```

### What you can do right now

1. **Check your current domains** at [Domains](https://dash.cloudflare.com/8a460817bc554362e040644c8e003fb9/domains) — see if you already own any neutral domains you could use
2. **Register a new domain** if needed — I can help you search for available names through Cloudflare Registrar
3. **Onboard it for Email Sending** once it's active on Cloudflare DNS

Do you already own `logiclemonai.org` or any of the other domains you mentioned, or do you need to register one first? And do you want agentic inbound on the same neutral domain, or keep inbound on `clawdyclaw.com` and only use the neutral domain for outbound?
```

Email Service Agent Example
This example shows how to combine the new Cloudflare Email Service sending binding with Agents SDK email routing in one full-stack app.

What this demonstrates
Send transactional email from an agent with this.sendEmail()
Route inbound email into an agent with routeAgentEmail()
Parse MIME content with postal-mime
Optionally sign follow-up replies with replyToEmail() and EMAIL_SECRET
Keep inbox and outbox state synced to a React client with useAgent()
Simulate inbound email locally with /api/simulate-email before you deploy routing
Prerequisites
Before running this example, you need:

A domain onboarded to Cloudflare Email Service

Log in to the Cloudflare Dashboard
Navigate to Compute & AI > Email Service
Select Onboard Domain and choose your domain
Add the DNS records (SPF and DKIM) to authorize sending
A verified sender address in the Cloudflare dashboard

The example defaults to mailbox-7f3a@example.com
Change EMAIL_FROM in wrangler.jsonc to your verified address
DNS propagation (usually 5-15 minutes, up to 24 hours)

Running it
npm install
cp .env.example .env
npm start
Before you send real email, review wrangler.jsonc:

Update vars.EMAIL_FROM to your verified sender address
Optional: add EMAIL_SECRET if you want signed reply routing:
wrangler secret put EMAIL_SECRET
The send_email binding is configured with remote: true, so npm start can call the real Email Service API from local development.

If EMAIL_SECRET is missing, the example still runs. Inbound mail uses address-based routing only, and auto-replies are sent unsigned.

Common Errors
Error	Cause	Solution
E_SENDER_NOT_VERIFIED	Domain or sender not verified	Complete domain onboarding in dashboard
E_RATE_LIMIT_EXCEEDED	Too many emails sent	Wait and retry
E_DAILY_LIMIT_EXCEEDED	Daily quota reached	Wait for next day or upgrade plan
How to use it
Open the app in your browser
Use Send outbound email to send a real message through Email Service
Use Simulate inbound email to exercise the inbound routing path locally
Deploy the Worker and route EMAIL_FROM to it to receive live email
Key patterns
Send with sendEmail()
const response = await this.sendEmail({
  binding: this.env.EMAIL,
  to,
  from: { email: this.env.EMAIL_FROM, name: "Email Service Agent" },
  replyTo: this.env.EMAIL_FROM,
  subject,
  text: body,
  html: body.replace(/\n/g, "<br />"),
  secret: this.env.EMAIL_SECRET
});
Route inbound mail into the agent
const addressResolver = createAddressBasedEmailResolver("EmailServiceAgent");

await routeAgentEmail(message, env, {
  resolver: async (email, env) => {
    if (env.EMAIL_SECRET) {
      const secureResolver = createSecureReplyEmailResolver(env.EMAIL_SECRET);
      const secureReply = await secureResolver(email, env);
      if (secureReply) return secureReply;
    }

    return addressResolver(email, env);
  }
});
With EMAIL_FROM="mailbox-7f3a@example.com", replies to mailbox-7f3a@example.com route to the EmailServiceAgent instance named mailbox-7f3a.

Local simulation endpoint
The app includes a small HTTP helper so the example is still useful before you deploy routing:

curl -X POST http://localhost:8787/api/simulate-email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "customer@example.com",
    "subject": "Question about my account",
    "body": "Can you confirm my renewal date?"
  }'
That request creates a mock ForwardableEmailMessage and runs it through the same resolver chain as a real routed email.

Deploying for real email
Onboard your domain in Cloudflare Email Service for both sending and routing
Verify the sender address used by EMAIL_FROM
Deploy this Worker with npm run deploy
Add an Email Service routing rule that sends EMAIL_FROM to this Worker
Related docs
../../docs/agents/email.md — Email Service with agents
../playground — larger email routing demos inside the playground
---


EOF
