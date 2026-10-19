/**
 * WidgetFeed + Platform Feed API.
 *
 *   GET    /api/v1/portal/widgets                → operator's mounted dashboard widgets
 *   POST   /api/v1/portal/widgets                → mount a widget (upsert)
 *   DELETE /api/v1/portal/widgets/:platform       → unmount a widget
 *   POST   /api/v1/portal/widgets/:platform/move  → change position in the grid
 *
 *   GET    /api/v1/feeds/:platform               → live aggregated info feed (server-side RSS/Atom)
 *   GET    /api/v1/feeds/:platform/events        → recent platform events (webhook/simulation)
 *   POST   /api/v1/feeds/webhook/:platform       → platform webhook notifications / events ingress
 *   POST   /api/v1/feeds/:platform/events        → send a test event (operator "wiggle" button)
 *
 * Live feeds are fetched server-side on the Worker edge and cached in KV
 * (120s TTL). Platform events persist to D1 `feed_events` and surface inside
 * the mounted widgets — the human-facing action happens behind-the-curtain.
 */

import { Hono } from "hono";
import { getSessionUser, sessionUserOrDefault } from "../lib/session";
import { webhookSecretValid, requireSession, authedUser } from "../lib/require-auth";
import {
  FEED_PLATFORMS,
  feedSourceUrl,
  defaultFeedSource,
  parseFeedXml,
  generateEventId,
  type FeedItem,
} from "../../shared/feed-platforms";

export interface FeedsEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  WEBHOOK_SECRET?: string;
}

const CACHE_TTL = 120;

const feeds = new Hono<{ Bindings: FeedsEnv }>();

async function loadFeed(env: FeedsEnv, platform: string, config: Record<string, string>): Promise<{
  ok: boolean;
  source: string | null;
  items: FeedItem[];
  error?: string;
}> {
  const def = FEED_PLATFORMS.find((p) => p.id === platform);
  if (!def) return { ok: false, source: null, items: [], error: "unknown platform" };
  if (def.type === "events") return { ok: true, source: null, items: [], error: "event-stream platform (webhook)" };

  const sourceUrl = feedSourceUrl(platform, config) ?? defaultFeedSource(platform);
  if (!sourceUrl) return { ok: false, source: null, items: [], error: "no feed source configured" };

  const cacheKey = `feed:cache:${platform}:${sourceUrl}`;
  const cached = await env.SESSIONS.get(cacheKey);
  if (cached) {
    try { return { ok: true, source: sourceUrl, items: JSON.parse(cached) as FeedItem[] }; }
    catch { /* refetch on corrupt cache */ }
  }

  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "ClawdyClaw-Edge/1.0 (+https://clawdyclaw.com)" },
      cf: { cacheTtl: 90 },
    });
    if (!res.ok) return { ok: false, source: sourceUrl, items: [], error: `upstream ${res.status}` };
    const xml = await res.text();
    const items = parseFeedXml(xml);
    if (items.length === 0) return { ok: false, source: sourceUrl, items: [], error: "no items in feed" };
    await env.SESSIONS.put(cacheKey, JSON.stringify(items), { expirationTtl: CACHE_TTL });
    return { ok: true, source: sourceUrl, items };
  } catch (e) {
    return { ok: false, source: sourceUrl, items: [], error: e instanceof Error ? e.message : "upstream fetch failed" };
  }
}

// ── Widgets (per-operator dashboard mounts) ─────────────────────────────────

feeds.get("/portal/widgets", async (c) => {
  const user = sessionUserOrDefault(await getSessionUser(c.env, c.req.raw));
  const rows = await c.env.DB
    .prepare("SELECT platform, config, position, created_at FROM portal_widgets WHERE user_id = ? ORDER BY position ASC")
    .bind(user.sub)
    .all<{ platform: string; config: string | null; position: number; created_at: number }>();

  const widgets = rows.results.map((r) => {
    let config: Record<string, string> = {};
    try { config = r.config ? JSON.parse(r.config) : {}; } catch { /* empty */ }
    const def = FEED_PLATFORMS.find((p) => p.id === r.platform);
    return {
      platform: r.platform,
      name: def?.name ?? r.platform,
      type: def?.type ?? "events",
      icon: def?.icon ?? "◈",
      color: def?.color ?? "text-silver",
      accent: def?.accent ?? "border-silver/20",
      tagline: def?.tagline ?? "",
      config,
      position: r.position,
      created_at: r.created_at,
    };
  });

  return c.json({ user: { sub: user.sub, email: user.email }, widgets });
});

feeds.post("/portal/widgets", requireSession, async (c) => {
  const user = authedUser(c);
  let body: { platform?: string; config?: Record<string, string>; position?: number } = {};
  try { body = await c.req.json(); } catch { /* empty */ }
  const platform = body.platform;
  if (!platform) return c.json({ error: "platform is required" }, 400);
  const def = FEED_PLATFORMS.find((p) => p.id === platform);
  if (!def) return c.json({ error: "unknown platform" }, 404);

  const config = body.config ?? {};
  const position = body.position ?? 1000;

  await c.env.DB.prepare(
    `INSERT INTO portal_widgets (user_id, platform, config, position, created_at)
     VALUES (?, ?, ?, ?, unixepoch())
     ON CONFLICT(user_id, platform) DO UPDATE SET config = excluded.config, position = excluded.position`
  )
    .bind(user.sub, platform, JSON.stringify(config), position)
    .run();

  return c.json({ ok: true, platform, connected: true });
});

feeds.delete("/portal/widgets/:platform", requireSession, async (c) => {
  const user = authedUser(c);
  await c.env.DB.prepare("DELETE FROM portal_widgets WHERE user_id = ? AND platform = ?")
    .bind(user.sub, c.req.param("platform"))
    .run();
  return c.json({ ok: true, unmounted: c.req.param("platform") });
});

feeds.post("/portal/widgets/:platform/move", requireSession, async (c) => {
  const user = authedUser(c);
  let body: { position?: number } = {};
  try { body = await c.req.json(); } catch { /* empty */ }
  const position = body.position ?? 0;
  await c.env.DB.prepare("UPDATE portal_widgets SET position = ? WHERE user_id = ? AND platform = ?")
    .bind(position, user.sub, c.req.param("platform"))
    .run();
  return c.json({ ok: true, platform: c.req.param("platform"), position });
});

// ── Live feeds + events ────────────────────────────────────────────────────

feeds.get("/feeds/:platform", async (c) => {
  const platform = c.req.param("platform");
  const config = JSON.parse(c.req.query("config") ?? "{}") as Record<string, string>;
  const feed = await loadFeed(c.env, platform, config);
  return c.json({ platform, type: FEED_PLATFORMS.find((p) => p.id === platform)?.type ?? "events", ...feed });
});

feeds.get("/feeds/:platform/events", async (c) => {
  const platform = c.req.param("platform");
  const limit = Math.min(Number(c.req.query("limit") ?? "20"), 50);
  const rows = await c.env.DB
    .prepare("SELECT id, platform, event_type, payload, created_at FROM feed_events WHERE platform = ? ORDER BY created_at DESC LIMIT ?")
    .bind(platform, limit)
    .all<{ id: string; platform: string; event_type: string; payload: string; created_at: number }>();
  const events = rows.results.map((e) => {
    let payload: unknown = null;
    try { payload = JSON.parse(e.payload); } catch { payload = e.payload; }
    return { id: e.id, platform: e.platform, event_type: e.event_type, payload, created_at: e.created_at };
  });
  return c.json({ platform, events });
});

/** Platform webhook ingress — accept real platform notifications / events. */
feeds.post("/feeds/webhook/:platform", async (c) => {
  const platform = c.req.param("platform");
  const def = FEED_PLATFORMS.find((p) => p.id === platform);
  if (!def) return c.json({ error: "unknown platform" }, 404);

  // Shared-secret gate — per-platform FEED_SECRET_<PLATFORM> wins, falls
  // back to the global WEBHOOK_SECRET. Until configured, the check is
  // skipped with a warn (see require-auth.ts).
  const envRec = c.env as unknown as Record<string, unknown>;
  const perPlatform = `FEED_SECRET_${platform.toUpperCase()}`;
  const secretName = typeof envRec[perPlatform] === "string" ? perPlatform : "WEBHOOK_SECRET";
  if (!webhookSecretValid(envRec, secretName, c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const raw = await c.req.text();
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { payload = raw; }

  await c.env.DB.prepare(
    "INSERT INTO feed_events (id, platform, event_type, payload, created_at) VALUES (?, ?, ?, ?, unixepoch())"
  )
    .bind(generateEventId(platform), platform, "webhook", JSON.stringify(payload))
    .run();

  return c.json({ ok: true, platform, received: "event" });
});

/** Operator-triggered test event — proves the live pipeline end-to-end. */
feeds.post("/feeds/:platform/events", async (c) => {
  const platform = c.req.param("platform");
  const def = FEED_PLATFORMS.find((p) => p.id === platform);
  if (!def) return c.json({ error: "unknown platform" }, 404);

  let body: { event_type?: string; payload?: unknown } = {};
  try { body = await c.req.json(); } catch { /* empty */ }

  const labels: Record<string, string> = {
    x: "verified signal from @clawdyclaw",
    facebook: "new lead notification from page",
    youtube: "upstream live notification",
    hackernoon: "new story matched your tag",
    medium: "publication activity",
    substack: "newsletter shipped",
  };

  const event = {
    event_type: body.event_type ?? "notification",
    payload: body.payload ?? {
      message: labels[platform] ?? `${platform} event received by the edge`,
      meta: { source: "studio_test_event", platform },
    },
  };

  await c.env.DB.prepare(
    "INSERT INTO feed_events (id, platform, event_type, payload, created_at) VALUES (?, ?, ?, ?, unixepoch())"
  )
    .bind(generateEventId(platform), platform, event.event_type, JSON.stringify(event.payload))
    .run();

  return c.json({ ok: true, platform, delivered: event });
});

export default feeds;
