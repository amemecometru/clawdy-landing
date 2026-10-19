/**
 * Page contract — what an agent orders, and what we build back for it.
 *
 * The customer here is an agent, not a human. That changes the contract in one
 * important way: design intent has to be *addressable parameters*, not prose.
 * A human iterates visually; an agent cannot, so colour, density and structure
 * are named tokens it can set directly. That is what makes an order
 * reproducible and what a human-driven builder cannot offer.
 *
 * One order yields two connections:
 *   - a hosted page under https://mcp.clawdyclaw.com/p/<slug>
 *   - source the agent can drop into its own project
 *
 * Both render from the same PageSpec, so they cannot drift.
 */

export type PageKind =
  | "oauth_client"
  | "landing"
  | "studio"
  | "carousel"
  | "thumbnail"
  | "inline"
  | "horizontal"
  | "inspirational";

export const PAGE_KINDS: PageKind[] = [
  "oauth_client",
  "landing",
  "studio",
  "carousel",
  "thumbnail",
  "inline",
  "horizontal",
  "inspirational",
];

/**
 * The colour-picker surface. Every field is a resolved CSS colour so a renderer
 * never has to branch on tokens — an agent can pass hex, hsl, or a named preset
 * and we normalise to something renderable.
 */
export interface Palette {
  mode: "dark" | "light";
  /** Page background. */
  bg: string;
  /** Raised card / panel background. */
  surface: string;
  /** Primary text. */
  text: string;
  /** Secondary text, captions, borders-as-text. */
  muted: string;
  /** Hairline borders and dividers. */
  border: string;
  /** The one colour that means "act on this". */
  accent: string;
  /** Text/icon colour that sits legibly on `accent`. */
  accentText: string;
}

export interface HeroBlock {
  type: "hero";
  eyebrow?: string;
  title: string;
  body?: string;
  /** Primary call to action. */
  cta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export interface FeatureItem {
  title: string;
  body: string;
  /** Optional lucide icon name, rendered if present. */
  icon?: string;
}

export interface FeaturesBlock {
  type: "features";
  heading?: string;
  items: FeatureItem[];
  /** 2 or 3 columns; 3 collapses to 2 then 1 on small screens. */
  columns?: 2 | 3;
}

export interface CardItem {
  title: string;
  body?: string;
  href?: string;
  image?: string;
  tag?: string;
}

export interface CardsBlock {
  type: "cards";
  heading?: string;
  items: CardItem[];
  /** `grid` stacks; `carousel` scrolls horizontally with snap points. */
  layout?: "grid" | "carousel";
  columns?: 2 | 3 | 4;
}

export interface StatItem {
  label: string;
  value: string;
  hint?: string;
}

export interface StatsBlock {
  type: "stats";
  items: StatItem[];
}

export interface FieldItem {
  name: string;
  label: string;
  type?: "text" | "email" | "url" | "select";
  options?: string[];
  required?: boolean;
}

export interface FormBlock {
  type: "form";
  heading?: string;
  body?: string;
  submitLabel?: string;
  fields: FieldItem[];
  /** Where a hosted copy posts. Omitted means the form is presentational. */
  action?: string;
}

export interface CtaBlock {
  type: "cta";
  title: string;
  body?: string;
  cta: { label: string; href: string };
}

/**
 * An OAuth consent screen. Structurally distinct from every other kind: it is
 * the one page that has to be unambiguous about who is asking for access to
 * what, and it ships as a distinct template rather than a preset.
 */
export interface ConsentBlock {
  type: "consent";
  clientName: string;
  clientDescription: string;
  scopes: string[];
  /** Where the user is sent back to. Set by the server, never by the agent. */
  redirectNote?: string;
}

export type PageBlock =
  | HeroBlock
  | FeaturesBlock
  | CardsBlock
  | StatsBlock
  | FormBlock
  | CtaBlock
  | ConsentBlock;

export interface PageSpec {
  kind: PageKind;
  /** Shown in the board and used as the default page heading. */
  title: string;
  brand?: string;
  palette: Palette;
  blocks: PageBlock[];
  /** Free-form, surfaced verbatim on the hosted page as <meta>. */
  meta?: Record<string, string>;
}

export type PageStatus =
  | "draft"
  | "building"
  | "review"
  | "published"
  | "failed";

export interface PageBuild {
  id: string;
  slug: string;
  kind: PageKind;
  status: PageStatus;
  title: string;
  brand: string | null;
  agent_name: string | null;
  spec_json: string;
  html: string | null;
  created_at: number;
  built_at: number | null;
  published_at: number | null;
  /** Asking price in micros (1_000_000 = $1). */
  price_micros: number;
  /** Denormalised board counters so the board is one query, not N. */
  sold_count: number;
  revenue_micros: number;
}

export interface PageOrder {
  id: string;
  page_id: string;
  buyer: string;
  amount_micros: number;
  currency: string;
  tx_ref: string | null;
  created_at: number;
}

/** Row shape the tools board renders, joined server-side. */
export interface BoardRow extends PageBuild {
  price_micros: number;
  listed_at: number | null;
  /** Seconds a published page has been sellable. */
  seconds_on_market: number;
}

export interface BoardTotals {
  pages: number;
  published: number;
  sold: number;
  revenue_micros: number;
}

// ── Palettes ──────────────────────────────────────────────────────────────────

/**
 * Named palettes an agent can address instead of inventing hex values. Chosen to
 * read as intentional at a glance; every one is checked for contrast against its
 * own `text` in the render tests.
 */
export const PALETTES: Record<string, Palette> = {
  obsidian: {
    mode: "dark",
    bg: "#070606",
    surface: "#121110",
    text: "#f4f1ec",
    muted: "#8c8781",
    border: "#26231f",
    accent: "#e35234",
    accentText: "#0b0706",
  },
  graphite: {
    mode: "dark",
    bg: "#0b0d10",
    surface: "#14181d",
    text: "#eef2f6",
    muted: "#8b96a3",
    border: "#232a33",
    accent: "#4f9cf9",
    accentText: "#05080c",
  },
  bone: {
    mode: "light",
    bg: "#faf8f5",
    surface: "#ffffff",
    text: "#16150f",
    muted: "#6b6660",
    border: "#e5e0d8",
    accent: "#b8431f",
    accentText: "#fffaf7",
  },
  parchment: {
    mode: "light",
    bg: "#f7f3ea",
    surface: "#fffdf8",
    text: "#241f16",
    muted: "#786c5a",
    border: "#e3d9c6",
    accent: "#2f6f4f",
    accentText: "#f6fbf8",
  },
};

export const DEFAULT_PALETTE = "obsidian";

export function resolvePalette(input: unknown): Palette {
  if (typeof input === "string" && PALETTES[input]) return { ...PALETTES[input] };
  if (input && typeof input === "object") {
    const p = input as Partial<Palette>;
    const base = PALETTES[DEFAULT_PALETTE];
    return {
      mode: p.mode === "light" ? "light" : base.mode,
      bg: str(p.bg, base.bg),
      surface: str(p.surface, base.surface),
      text: str(p.text, base.text),
      muted: str(p.muted, base.muted),
      border: str(p.border, base.border),
      accent: str(p.accent, base.accent),
      accentText: str(p.accentText, base.accentText),
    };
  }
  return { ...PALETTES[DEFAULT_PALETTE] };
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "page"
  );
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.floor(seconds))}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function formatMicros(micros: number): string {
  if (micros === 0) return "$0.00";
  return `$${(micros / 1_000_000).toFixed(2)}`;
}