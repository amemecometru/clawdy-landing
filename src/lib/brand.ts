export const PROFESSIONAL_TIERS = ["basic", "professional", "sophisticated"] as const;
export type ProfessionalTier = (typeof PROFESSIONAL_TIERS)[number];

export const PROFESSIONAL_SOURCES = ["manual", "linkedin", "job_board", "referral"] as const;
export type ProfessionalSource = (typeof PROFESSIONAL_SOURCES)[number];

export const BUDGET_RANGES = ["flexible", "under_200", "200_500", "500_plus"] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];

export const SITE_STATUSES = ["draft", "awaiting_approval", "approved", "deployed", "live", "archived"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const PROFESSIONAL_STATUSES = ["lead", "qualified", "in_design", "approved", "live", "cancelled"] as const;
export type ProfessionalStatus = (typeof PROFESSIONAL_STATUSES)[number];

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const SEQUENCE_STATUSES = [
  "pending",
  "message_approved",
  "sent",
  "replied",
  "positive",
  "negative",
  "no_reply",
  "unsubscribe",
  "stopped",
] as const;
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];

export const MESSAGE_STATUSES = ["draft", "awaiting_approval", "approved", "sent", "failed", "bounced", "replied"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_TYPES = ["discovery", "warm_reply", "no_reply_followup"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function isProfessionalTier(value: unknown): value is ProfessionalTier {
  return typeof value === "string" && (PROFESSIONAL_TIERS as readonly string[]).includes(value);
}

export function isProfessionalSource(value: unknown): value is ProfessionalSource {
  return typeof value === "string" && (PROFESSIONAL_SOURCES as readonly string[]).includes(value);
}

export function isBudgetRange(value: unknown): value is BudgetRange {
  return typeof value === "string" && (BUDGET_RANGES as readonly string[]).includes(value);
}

export function isProfessionalStatus(value: unknown): value is ProfessionalStatus {
  return typeof value === "string" && (PROFESSIONAL_STATUSES as readonly string[]).includes(value);
}

export function isSiteStatus(value: unknown): value is SiteStatus {
  return typeof value === "string" && (SITE_STATUSES as readonly string[]).includes(value);
}

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return typeof value === "string" && (CAMPAIGN_STATUSES as readonly string[]).includes(value);
}

export function isMessageType(value: unknown): value is MessageType {
  return typeof value === "string" && (MESSAGE_TYPES as readonly string[]).includes(value);
}

export function isMessageStatus(value: unknown): value is MessageStatus {
  return typeof value === "string" && (MESSAGE_STATUSES as readonly string[]).includes(value);
}

export function textValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function optionalText(value: unknown): string | null {
  return textValue(value) ?? null;
}

export function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function integerValue(value: unknown): number | undefined {
  const parsed = numberValue(value);
  return parsed === undefined ? undefined : Math.trunc(parsed);
}

export function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = integerValue(value);
  if (parsed === undefined) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function normalizeTld(value: unknown): string {
  const raw = textValue(typeof value === "string" ? value : undefined);
  if (!raw) return ".com";
  const lower = raw.toLowerCase();
  return lower.startsWith(".") ? lower : `.${lower}`;
}

export function normalizeDomainName(value: unknown): string {
  const raw = textValue(typeof value === "string" ? value : undefined);
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidDomainName(value: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function domainAddonPrice(tld: string): number {
  switch (normalizeTld(tld)) {
    case ".dev":
    case ".xyz":
    case ".io":
    case ".me":
      return 5;
    case ".ai":
      return 15;
    default:
      return 0;
  }
}

export function mockDomainAvailable(domainName: string, tld: string): boolean {
  const value = `${domainName}${normalizeTld(tld)}`;
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 5 !== 0;
}

export function tierSetupPrice(tier: ProfessionalTier): number {
  switch (tier) {
    case "professional":
      return 299;
    case "sophisticated":
      return 599;
    default:
      return 99;
  }
}

export interface SectionSeedInput {
  first_name: string;
  last_name: string;
  current_role: string;
  target_role: string;
  about_summary?: string | null;
}

export interface SectionSeed {
  section_type: string;
  tier_minimum: ProfessionalTier;
  content: string;
  display_order: number;
}

const SECTION_TYPES = ["hero", "about", "portfolio", "services", "testimonials", "blog", "cta"] as const;
export type SiteSectionType = (typeof SECTION_TYPES)[number];

export function isSiteSectionType(value: unknown): value is SiteSectionType {
  return typeof value === "string" && (SECTION_TYPES as readonly string[]).includes(value);
}

export function buildDefaultSections(input: SectionSeedInput, tier: ProfessionalTier): SectionSeed[] {
  const fullName = `${input.first_name} ${input.last_name}`.trim();
  const seeds: SectionSeed[] = [
    {
      section_type: "hero",
      tier_minimum: "basic",
      content: JSON.stringify({
        headline: `${input.first_name} ${input.last_name} — ${input.current_role}`,
        tagline: `Transitioning toward ${input.target_role}`,
        cta_label: "Get in touch",
      }),
      display_order: 0,
    },
    {
      section_type: "about",
      tier_minimum: "basic",
      content: JSON.stringify({
        summary:
          input.about_summary ??
          `${fullName} is a ${input.current_role} building toward a ${input.target_role} role.`,
      }),
      display_order: 1,
    },
  ];
  if (tier !== "basic") {
    seeds.push({
      section_type: "portfolio",
      tier_minimum: "professional",
      content: JSON.stringify({ items: [] }),
      display_order: 2,
    });
    seeds.push({
      section_type: "services",
      tier_minimum: "professional",
      content: JSON.stringify({ services: [] }),
      display_order: 3,
    });
  }
  if (tier === "sophisticated") {
    seeds.push({
      section_type: "testimonials",
      tier_minimum: "sophisticated",
      content: JSON.stringify({ testimonials: [] }),
      display_order: 4,
    });
    seeds.push({
      section_type: "blog",
      tier_minimum: "sophisticated",
      content: JSON.stringify({ posts: [] }),
      display_order: 5,
    });
  }
  seeds.push({
    section_type: "cta",
    tier_minimum: "basic",
    content: JSON.stringify({ headline: `Work with ${input.first_name}`, email: null }),
    display_order: seeds.length,
  });
  return seeds;
}

export function tierMonthlyPrice(tier: ProfessionalTier): number {
  switch (tier) {
    case "professional":
      return 29;
    case "sophisticated":
      return 79;
    default:
      return 9;
  }
}
