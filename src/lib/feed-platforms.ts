/**
 * Social / content feed platform registry.
 * Shared by the WidgetFeed backend (src/api/feeds.ts) and the Studio frontend.
 *
 * Two widget types:
 *   "feed"   → server-side live RSS aggregation (YouTube, Medium, Substack, HackerNoon)
 *   "events" → platform event stream (X, Facebook) fed by webhooks + test events
 *
 * NOTE: platform slots are data-driven (not hardcoded JSX) so new platforms can
 * mount without touching the widget grid UI.
 */

export type WidgetType = "feed" | "events";

export interface FeedPlatform {
  id: string;
  name: string;
  icon: string; // emoji / glyph rendered by the widget grid
  color: string; // tailwind text color class
  type: WidgetType;
  tagline: string;
  accent: string; // tailwind border/glow class
  config?: Array<{ key: string; label: string; placeholder: string; default: string }>;
}

export const FEED_PLATFORMS: FeedPlatform[] = [
  {
    id: "x",
    name: "X (Twitter)",
    icon: "𝕏",
    color: "text-silver",
    type: "events",
    tagline: "Realtime event stream via webhook — mentions, engagements, DMs.",
    accent: "border-silver/40",
    config: [{ key: "username", label: "Handle", placeholder: "@clawdyclaw", default: "@clawdyclaw" }],
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "f",
    color: "text-blue-400",
    type: "events",
    tagline: "Page events, lead notifications, and ad insights via webhook.",
    accent: "border-blue-400/40",
    config: [{ key: "page", label: "Page", placeholder: "ClawdyClaw", default: "ClawdyClaw" }],
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "▶",
    color: "text-red-400",
    type: "feed",
    tagline: "Live channel feed — new uploads stream in as they publish.",
    accent: "border-red-400/40",
    config: [{ key: "channel_id", label: "Channel ID", placeholder: "UC…", default: "" }],
  },
  {
    id: "hackernoon",
    name: "HackerNoon",
    icon: "H",
    color: "text-emerald-400",
    type: "feed",
    tagline: "Live HackerNoon stream — fresh how-to & dev-economy stories.",
    accent: "border-emerald-400/40",
    config: [{ key: "tag", label: "Tag", placeholder: "ai", default: "" }],
  },
  {
    id: "medium",
    name: "Medium",
    icon: "M",
    color: "text-amber-400",
    type: "feed",
    tagline: "Live Medium stream — follows the latest author publications.",
    accent: "border-amber-400/40",
    config: [{ key: "user", label: "Author", placeholder: "@clawdyclaw", default: "" }],
  },
  {
    id: "substack",
    name: "Substack",
    icon: "S",
    color: "text-orange-400",
    type: "feed",
    tagline: "Live newsletter feed — posts arrive the moment they ship.",
    accent: "border-orange-400/40",
    config: [{ key: "pub", label: "Publication", placeholder: "example", default: "" }],
  },
];

export interface FeedItem {
  id: string;
  title: string;
  link: string;
  author: string | null;
  published: string | null;
  summary: string | null;
}

/** Build the live RSS/Atom endpoint URL for a platform from its widget config. */
export function feedSourceUrl(platform: string, config: Record<string, string> = {}): string | null {
  switch (platform) {
    case "youtube": {
      const channelId = config.channel_id || "";
      return channelId ? `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}` : null;
    }
    case "medium":
      return config.user ? `https://medium.com/feed/${encodeURIComponent(config.user.replace(/^@/, ""))}` : null;
    case "substack":
      return config.pub ? `https://${encodeURIComponent(config.pub)}.substack.com/feed` : null;
    case "hackernoon":
      return config.tag ? `https://hackernoon.com/feed?ref=${encodeURIComponent(config.tag)}` : "https://hackernoon.com/feed";
    default:
      return null; // events platforms have no live RSS
  }
}

/** Platform that powers the default live feed for a fresh studio mount.
 *  Where an upstream is unreliable or account-specific, we require explicit
 *  config (entered in the widget builder) rather than baking in a dead feed. */
export function defaultFeedSource(platform: string): string | null {
  switch (platform) {
    case "youtube":
      return null; // requires channel_id
    case "medium":
      return null; // requires publication @user
    case "substack":
      return null; // requires publication slug
    case "hackernoon":
      return "https://hackernoon.com/feed";
    default:
      return null;
  }
}

/**
 * Minimal, dependency-free RSS/Atom → FeedItem[] extractor.
 * Workers have no DOM parser, so we parse with bounded regex passes.
 */
export function parseFeedXml(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const isAtom = /<feed[^>]*xmlns[^>]*=/i.test(xml.slice(0, 200)) || !/<rss|<rdf/i.test(xml.slice(0, 120));
  const blockRe = isAtom ? /<entry>([\s\S]*?)<\/entry>/g : /<item>([\s\S]*?)<\/item>/gi;

  let m: RegExpExecArray | null;
  const stack: string[] = [];
  while ((m = blockRe.exec(xml)) !== null) {
    const block = m[1];
    const grab = (tag: string, max = 400): string => {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
      const am = re.exec(block);
      if (!am) return "";
      const raw = am[1];
      const stripped = raw
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      return stripped.trim().slice(0, max);
    };

    const title = grab("title");
    const linkMatch = isAtom
      ? /<link[^>]*href="([^"]+)"/.exec(block)
      : /<link[^>]*>([^<]*)<\/link>/.exec(block);
    const link = (isAtom ? linkMatch?.[1] : linkMatch?.[1]) ?? "";
    const author = grab(isAtom ? "name" : "dc:creator") || grab(isAtom ? "author" : "author");
    const published = grab(isAtom ? "published" : "pubDate");
    const summary = grab("description") || grab("summary");

    if (!title && !link) continue;
    items.push({
      id: `${stack.length}-${link || title}`,
      title,
      link,
      author: author || null,
      published: published || null,
      summary: summary || null,
    });
  }
  return items.slice(0, 25);
}

/**
 * Generate a deterministic id for platform events (webhook ingress + test events).
 */
export function generateEventId(platform: string, nonce?: string): string {
  const base = `${platform}-${nonce ?? crypto.randomUUID()}`;
  return base.slice(0, 64);
}