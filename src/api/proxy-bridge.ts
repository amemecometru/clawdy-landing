/**
 * Proxy Bridge — Intent Classifier.
 *
 * Receives normalized webhook payloads and classifies them into actionable
 * task types. Routes based on source, content heuristics, and priority signals.
 *
 * Autonomy levels:
 *   auto   — execute without human review (low-risk actions)
 *   review — queue for HITL approval (medium-risk: outreach, CRM writes)
 *   block  — never execute automatically (high-risk: payments, data deletion)
 */

export type AutonomyLevel = "auto" | "review" | "block";

export interface Classification {
  intent: string;
  action: string;
  priority: "low" | "normal" | "high" | "critical";
  autonomy: AutonomyLevel;
  confidence: number;
}

function intentOf(p: Record<string, unknown>): string {
  const top = p.intent;
  const nested = (p.payload as Record<string, unknown> | undefined)?.intent;
  return [top, nested].find((v): v is string => typeof v === "string") ?? "";
}

const INTENT_PATTERNS: Array<{
  match: (payload: Record<string, unknown>) => boolean;
  result: Classification;
}> = [
  // ── Facebook Lead Ads ──────────────────────────────────────────────
  {
    match: (p) => p.source === "facebook_ads" && /inquiry|interest|quote|contract/i.test(intentOf(p)),
    result: {
      intent: "lead_inquiry",
      action: "draft_personalized_outreach",
      priority: "high",
      autonomy: "review",
      confidence: 0.92,
    },
  },
  {
    match: (p) => p.source === "facebook_ads",
    result: {
      intent: "lead_capture",
      action: "qualify_and_enqueue",
      priority: "normal",
      autonomy: "review",
      confidence: 0.85,
    },
  },

  // ── Gmail Webhooks ─────────────────────────────────────────────────
  {
    match: (p) => p.source === "gmail" && /urgent|asap|immediately/i.test(JSON.stringify(p.payload)),
    result: {
      intent: "urgent_email",
      action: "draft_priority_reply",
      priority: "critical",
      autonomy: "review",
      confidence: 0.88,
    },
  },
  {
    match: (p) => p.source === "gmail",
    result: {
      intent: "email_received",
      action: "analyze_and_categorize",
      priority: "normal",
      autonomy: "auto",
      confidence: 0.80,
    },
  },

  // ── Scrapers (stress test tier) ────────────────────────────────────
  {
    match: (p) => {
      const payload = (p.payload ?? {}) as Record<string, unknown>;
      const value = (payload.price as number) ?? (payload.estimated_value as number);
      return p.source === "scraper" && typeof value === "number" && value > 500;
    },
    result: {
      intent: "high_value_listing",
      action: "evaluate_and_enqueue",
      priority: "high",
      autonomy: "review",
      confidence: 0.75,
    },
  },
  {
    match: (p) => p.source === "scraper",
    result: {
      intent: "listing_scrape",
      action: "parse_and_log",
      priority: "low",
      autonomy: "auto",
      confidence: 0.70,
    },
  },

  // ── Fallback ───────────────────────────────────────────────────────
  {
    match: () => true,
    result: {
      intent: "unknown",
      action: "queue_for_review",
      priority: "normal",
      autonomy: "review",
      confidence: 0.50,
    },
  },
];

/**
 * Classify an inbound payload. Walks the pattern table top-to-bottom
 * and returns the first match.
 */
export function classify(payload: Record<string, unknown>): Classification {
  for (const rule of INTENT_PATTERNS) {
    if (rule.match(payload)) return { ...rule.result };
  }
  // unreachable — fallback always matches
  return INTENT_PATTERNS[INTENT_PATTERNS.length - 1].result;
}

/**
 * Generate a deterministic task ID from source + timestamp.
 * Format: TX-<source-prefix>-<timestamp36>
 */
export function generateTaskId(source: string): string {
  const prefix = source.slice(0, 4).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `TX-${prefix}-${ts}`;
}
