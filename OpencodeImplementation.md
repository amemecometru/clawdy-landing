OBJECTIVE
─────────
Build the complete backend, database, and API for the Professional Personal Brand Site campaign.
This is a 3-tier SaaS: lead intake → qualification → design generation → approval → deployment → recurring billing.

DO NOT implement yet:
- Payment processing or Stripe integration
- Actual domain registration
- Actual site deployment
- Email sending (use dry-run mock)
- User-facing frontend
- MCP integration for design generation (will be separate)

This task defines the data model, workflow, and API structure.

SCOPE
─────
Repository: ~/github.com/amemecometru/clawdy
Do not modify ~/agentic.clawdy
Do not modify ~/clawdy-landing or amemecometru/clawdyclaw-landing
Workspace is a single pilot: "professionals"

BUSINESS MODEL
──────────────
Tier | Setup | Monthly | Use case
─────┼───────┼─────────┼──────────────────
Basic | $99 | $9 | Job seekers
Prof | $299 | $29 | Consultants, mid-career
Soph | $599 | $79 | Executives, founders

Domains:
.com (included) | .dev/.xyz/.io/.me (+$5) | .ai (+$15) | Premium (+$20)

First customer: ER nurse (your brother)
Tier: Professional
Domain: firstname.com (example)
Email: hello@firstname.com
Resume: from LinkedIn or paste

DATA MODEL
──────────
Design this schema in a new migration (0002_professional_brand_sites.sql):

professionals
  id (string, PK, e.g., "prof_xxx")
  owner_sub (string, FK to sessions, required)
  first_name (string, required)
  last_name (string, required)
  email (string, required)
  current_role (string, e.g., "Emergency Room Nurse RN")
  current_company (string)
  years_experience (integer)
  target_role (string, e.g., "Full-Time ER RN, Permanent Position")
  target_industry (string, nullable)
  linkedin_url (string, nullable)
  resume_url (string, nullable)
  resume_content (text, nullable, stored after parsing)
  source (enum: "manual" | "linkedin" | "job_board" | "referral")
  status (enum: "lead" | "qualified" | "in_design" | "approved" | "live" | "cancelled")
  tier (enum: "basic" | "professional" | "sophisticated")
  domain_preference (string, e.g., "firstname.com")
  domain_tld (string, e.g., ".com")
  domain_custom_tld (string, nullable, for premium TLDs)
  professional_email (string, nullable, e.g., "hello@firstname.com")
  budget_range (enum: "flexible" | "under_200" | "200_500" | "500_plus")
  notes (text, nullable)
  qualification_score (float, 0-1)
  qualified_at (datetime, nullable)
  created_at (datetime)
  updated_at (datetime)
  archived_at (datetime, nullable)

professional_sites
  id (string, PK)
  professional_id (FK to professionals, required)
  tier (enum, copied from professional for audit)
  status (enum: "draft" | "awaiting_approval" | "approved" | "deployed" | "live" | "archived")
  
  Design/content
  hero_headline (string, e.g., "[Name], ER Nurse RN")
  hero_tagline (string, e.g., "Emergency care specialist seeking full-time permanent role")
  about_summary (text, AI-generated or manual)
  profile_image_url (string, nullable)
  
  Technical
  domain_name (string, e.g., "firstname.com")
  domain_tld (string, e.g., ".com")
  domain_status (enum: "checking" | "available" | "reserved" | "registered" | "failed")
  domain_registrar (string, e.g., "namecheap", nullable until registered)
  domain_nameservers (json, nullable)
  site_url (string, nullable, final deployment URL)
  
  Email setup
  professional_email (string, e.g., "hello@firstname.com")
  email_routing_status (enum: "pending" | "configured" | "failed")
  email_inbound_target (string, e.g., "operator@yourcompany.com")
  
  Portfolio
  portfolio_items (json, array of { title, description, url, image_url })
  
  SEO (Sophisticated tier only)
  meta_description (string, nullable)
  og_title (string, nullable)
  og_image (string, nullable)
  
  Approval
  submitted_for_review_at (datetime, nullable)
  approved_by (string, FK to sessions, nullable)
  approved_at (datetime, nullable)
  approval_notes (text, nullable)
  
  Deployment
  deployed_at (datetime, nullable)
  deployed_by (string, nullable)
  last_updated_at (datetime, nullable)
  
  created_at (datetime)
  updated_at (datetime)

professional_site_sections
  id (string, PK)
  professional_site_id (FK)
  section_type (enum: "hero" | "about" | "portfolio" | "services" | "testimonials" | "blog" | "cta")
  tier_minimum (enum: "basic" | "professional" | "sophisticated")
  content (json, section-specific schema)
  display_order (integer)
  enabled (boolean)
  created_at (datetime)

professional_campaigns
  id (string, PK)
  owner_sub (string, FK to sessions)
  name (string, e.g., "ER Nurses 2025")
  description (text)
  tier (enum: "basic" | "professional" | "sophisticated")
  status (enum: "draft" | "active" | "paused" | "completed")
  created_at (datetime)
  updated_at (datetime)

campaign_leads
  id (string, PK)
  campaign_id (FK)
  professional_id (FK)
  sequence_step (integer, 0 = discovery, 1 = warm reply, 2 = no-reply follow-up, 3 = end)
  sequence_status (enum: "pending" | "message_approved" | "sent" | "replied" | "positive" | "negative" | "no_reply" | "unsubscribe" | "stopped")
  next_action_at (datetime, nullable)
  stop_reason (string, nullable, e.g., "unsubscribe" | "manual" | "positive_reply")
  created_at (datetime)
  updated_at (datetime)

campaign_messages
  id (string, PK)
  campaign_lead_id (FK)
  step (integer, 0-2)
  message_type (enum: "discovery" | "warm_reply" | "no_reply_followup")
  subject (string, nullable)
  body (text)
  personalization (json, { first_name, target_role, offer, etc })
  status (enum: "draft" | "awaiting_approval" | "approved" | "sent" | "failed" | "bounced" | "replied")
  approved_by (string, FK to sessions, nullable)
  approved_at (datetime, nullable)
  sent_at (datetime, nullable)
  gmail_message_id (string, nullable)
  provider_response (json, nullable)
  created_at (datetime)
  updated_at (datetime)

professional_subscriptions
  id (string, PK)
  professional_id (FK)
  tier (enum, copied from purchase for billing audit)
  billing_period_start (datetime)
  billing_period_end (datetime)
  price_setup (decimal, $99/$299/$599)
  price_monthly (decimal, $9/$29/$79)
  domain_addon_price (decimal, 0 or +$5/+$15/+$20)
  total_setup (decimal)
  total_monthly (decimal)
  status (enum: "active" | "past_due" | "cancelled" | "failed")
  stripe_subscription_id (string, nullable, for future Stripe integration)
  cancel_reason (text, nullable)
  cancelled_at (datetime, nullable)
  created_at (datetime)
  updated_at (datetime)

API ROUTES
──────────
Workspace-level

GET /api/v1/professionals
  Query: status, tier, source, created_after
  Returns: paginated professional records
  Auth: session required

POST /api/v1/professionals
  Body: { first_name, last_name, email, current_role, target_role, tier, domain_preference, ... }
  Returns: professional record with qualification_score
  Auth: session required

GET /api/v1/professionals/:id
  Returns: full professional record + linked sites, campaigns, subscriptions
  Auth: session required, must own the record

PUT /api/v1/professionals/:id
  Updates: any field except archived_at, owner_sub
  Returns: updated professional
  Auth: session required, must own

POST /api/v1/professionals/:id/qualify
  Triggers qualification logic
  Returns: { qualified: bool, score: float, reasons: [...], next_steps: [...] }
  Auth: session required, must own

POST /api/v1/professionals/:id/archive
  Soft-deletes the professional and all linked records
  Returns: { archived: true, archived_at: timestamp }
  Auth: session required, must own

Site management

POST /api/v1/professionals/:id/sites
  Body: { tier, domain_preference, domain_tld }
  Creates a new professional_sites record in draft status
  Returns: site record
  Auth: session required, must own professional

GET /api/v1/professionals/:id/sites/:site_id
  Returns: full site record + sections, approval status
  Auth: session required

PUT /api/v1/professionals/:id/sites/:site_id
  Body: { hero_headline, hero_tagline, about_summary, portfolio_items, ... }
  Updates content fields
  Returns: updated site
  Auth: session required

POST /api/v1/professionals/:id/sites/:site_id/submit_for_approval
  Marks site as awaiting_approval
  Sends internal notification to operator
  Returns: { status: "awaiting_approval", submitted_at: timestamp }
  Auth: session required

POST /api/v1/professionals/:id/sites/:site_id/approve
  Admin/operator only
  Marks site as approved, sets approved_by and approved_at
  Returns: { status: "approved", approved_at: timestamp }
  Auth: session required, operator role (future: add role check)

POST /api/v1/professionals/:id/sites/:site_id/reject
  Body: { reason: string }
  Marks site as draft, logs reason
  Returns: { status: "draft", rejection_reason: string }
  Auth: session required, operator role

Domain and email simulation (dry-run for now)

POST /api/v1/professionals/:id/sites/:site_id/check_domain
  Query: { domain_name, tld }
  Simulates domain availability check (returns mock until real integration)
  Returns: { available: bool, price: decimal, registrar: string }
  Auth: session required

POST /api/v1/professionals/:id/sites/:site_id/reserve_domain
  Body: { domain_name, tld }
  Marks domain_status as reserved (does NOT call registrar yet)
  Returns: { domain_name, status: "reserved", expires_at: timestamp }
  Auth: session required

POST /api/v1/professionals/:id/sites/:site_id/configure_email
  Body: { professional_email, inbound_target }
  Simulates email routing config (dry-run)
  Returns: { email_routing_status: "pending", configured_at: timestamp }
  Auth: session required

Campaigns (simplified for first pilot)

POST /api/v1/campaigns
  Body: { name, tier, professional_ids: [...] }
  Creates campaign and links professionals
  Returns: campaign record
  Auth: session required

GET /api/v1/campaigns/:id
  Returns: campaign + linked professionals + message history
  Auth: session required

POST /api/v1/campaigns/:id/message/:step
  Body: { professional_id, subject, body, personalization }
  Creates campaign_messages record
  Returns: message record with generated personalization
  Auth: session required

POST /api/v1/campaigns/:id/message/:message_id/approve
  Marks message as approved
  Returns: { status: "approved", approved_at: timestamp }
  Auth: session required

POST /api/v1/campaigns/:id/message/:message_id/send_dry_run
  Simulates send (does NOT call Gmail)
  Returns: { status: "sent (mock)", simulated_provider_response: {...} }
  Auth: session required

Qualification logic

POST /api/v1/qualify/professional
  Body: { first_name, last_name, current_role, target_role, years_experience, budget_range, source }
  Returns: { qualified: bool, score: 0-1, reasons: [], tier_recommendation }
  Auth: not required (can be called from lead import)

Scoring algorithm (implement in src/lib/qualify.ts):

```typescript
interface QualificationInput {
  current_role: string;
  target_role: string;
  years_experience: number;
  source: string;
  budget_range: string;
}

interface QualificationResult {
  qualified: boolean;
  score: number; // 0-1
  tier_recommendation: "basic" | "professional" | "sophisticated";
  reasons: string[];
  risk_factors: string[];
}

function qualifyProfessional(input: QualificationInput): QualificationResult {
  let score = 0;
  const reasons = [];
  const risk_factors = [];

  // Role alignment (+0.3 if target_role is substantively different from current_role)
  if (target_role !== current_role) {
    score += 0.3;
    reasons.push("Career transition detected; personal brand valuable");
  }

  // Experience level
  if (years_experience >= 5 && years_experience <= 20) {
    score += 0.3; // Sweet spot for career consultants
    reasons.push("Mid-to-senior career stage, high brand value");
  } else if (years_experience < 5) {
    score += 0.15; // Junior seeking edge
    reasons.push("Early career; personal brand useful for differentiation");
  } else if (years_experience > 20) {
    score += 0.25; // Executive
    reasons.push("Extensive experience; executive presence website valuable");
  }

  // Source (inbound > job board > manual)
  if (source === "linkedin" || source === "referral") {
    score += 0.2;
    reasons.push("Strong signal: organic interest or referral");
  } else if (source === "job_board") {
    score += 0.1;
    reasons.push("Moderate signal: job board context");
  } else {
    risk_factors.push("Manual entry; verify interest");
  }

  // Budget range (proxy for seriousness)
  if (budget_range === "500_plus") {
    score += 0.15;
    reasons.push("High budget; likely committed");
  } else if (budget_range === "200_500") {
    score += 0.1;
    reasons.push("Moderate budget");
  } else if (budget_range === "under_200") {
    risk_factors.push("Low budget; may not complete");
  }

  // Tier recommendation
  let tier_recommendation: "basic" | "professional" | "sophisticated" = "basic";
  if (score >= 0.7 && years_experience >= 10) {
    tier_recommendation = "sophisticated";
  } else if (score >= 0.5 && years_experience >= 5) {
    tier_recommendation = "professional";
  }

  const qualified = score >= 0.4; // Threshold for outreach

  return {
    qualified,
    score: Math.min(score, 1),
    tier_recommendation,
    reasons,
    risk_factors,
  };
}
---

EOF
