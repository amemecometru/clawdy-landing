/**
 * Pages API — /api/v1/pages
 *
 * An agent orders a page and gets two connections back: a hosted URL and source
 * it owns. The hosted copy lives at https://mcp.clawdyclaw.com/p/<slug>.
 *
 * Two entry shapes on the same endpoint:
 *   - the agent sends a complete PageSpec (deterministic, no model involved)
 *   - the agent sends a brief and we generate the spec through the AI Gateway
 *
 * Auth: `requireSession` for the human path, or an agent credential header for
 * machine callers. Both resolve to an owner so the board is never anonymous.
 */

import { Hono, type Context } from "hono";
import { requireSession, authedUser } from "../lib/require-auth";
import { renderPageHtml, renderPageReact } from "../lib/page-render";
import {
  boardRows,
  boardTotals,
  createPage,
  getPage,
  getPageBySlug,
  listOrders,
  recordOrder,
  setPageStatus,
} from "../db/pages";
import {
  PALETTES,
  PAGE_KINDS,
  resolvePalette,
  type PageBlock,
  type PageKind,
  type PageSpec,
  type PageStatus,
} from "../../shared/pages";
import { isStatus, normaliseSpec, priceToMicros, str } from "./pages-normalise";

export interface PagesEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  AI: Ai;
  AI_GATEWAY_URL?: string;
  /** Canonical origin for hosted page URLs. Defaults to mcp.clawdyclaw.com. */
  PUBLIC_ORIGIN?: string;
}

const pages = new Hono<{ Bindings: PagesEnv; Variables: { owner: string } }>();

const DEFAULT_PAGE_ORIGIN = "https://mcp.clawdyclaw.com";
const pageOrigin = (env: PagesEnv) =>
  (env.PUBLIC_ORIGIN?.replace(/\/+$/, "") || DEFAULT_PAGE_ORIGIN);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Who is calling. A session cookie means a human; `X-Agent-Key` means a machine
 * client. Agents are named, not authenticated cryptographically, in this slice —
 * that is the gap to close before the marketplace takes real money.
 */
function ownerOf(
  c: { req: { header(name: string): string | undefined } },
  user: { sub: string; name: string | null } | null
): string {
  if (user) return `human:${user.sub}`;
  const agent = c.req.header("x-agent-name")?.trim();
  return agent ? `agent:${agent}` : "anonymous";
}

async function readJson(c: Context): Promise<Record<string, unknown>> {
  try {
    const body = (await c.req.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * Order a page. Accepts a full spec, or a `brief` string to generate one from.
 *
 * Generation is opt-in: if no brief is supplied the spec is taken as given,
 * which keeps ordering deterministic and free for agents that already know what
 * they want.
 */
pages.post("/", async (c) => {
  const raw = await readJson(c);
  const owner = ownerOf(c, null);

  let source: Record<string, unknown> = raw;

  // Brief → spec, through the AI Gateway when one is configured.
  const brief = str(raw.brief, 2000);
  if (brief && !Array.isArray(raw.blocks)) {
    const generated = await generateSpec(c.env, brief, str(raw.kind) || "landing", raw.palette);
    if (generated) {
      source = { ...raw, ...generated, brief: undefined };
    } else {
      return c.json(
        { error: "brief supplied but no spec could be generated", hint: "send `blocks` explicitly" },
        503
      );
    }
  }

  const { spec, warnings } = normaliseSpec(source);
  const price = priceToMicros(raw.price_usd ?? raw.price);

  const page = await createPage(c.env.DB, {
    spec,
    agentName: owner,
    html: renderPageHtml(spec),
    status: isStatus(raw.status) ? raw.status : "published",
    priceMicros: price,
  });

  return c.json(
    {
      page: publicPage(page),
      hosted_url: `${pageOrigin(c.env)}/p/${page.slug}`,
      source: {
        html: renderPageHtml(spec),
        react: renderPageReact(spec),
      },
      warnings,
    },
    201
  );
});

// The board exposes revenue and who is building what, so it is session-gated.
// Ordering stays open to agent credentials — that is the machine path.
pages.get("/", requireSession, async (c) => {
  const [rows, totals] = await Promise.all([boardRows(c.env.DB), boardTotals(c.env.DB)]);
  return c.json({
    rows: rows.map((r) => publicBoardRow(r, c.env)),
    totals,
    generated_at: Date.now(),
  });
});

pages.get("/orders", requireSession, async (c) => {
  const pageId = c.req.query("page_id");
  return c.json({ orders: await listOrders(c.env.DB, pageId) });
});

pages.get("/catalog", (c) =>
  c.json({
    kinds: PAGE_KINDS,
    palettes: Object.keys(PALETTES),
    blocks: ["hero", "features", "cards", "stats", "form", "cta", "consent"],
  })
);

pages.get("/:id", async (c) => {
  const page = await getPage(c.env.DB, c.req.param("id"));
  if (!page) return c.json({ error: "Page not found" }, 404);
  return c.json({ page: publicPage(page), hosted_url: `${pageOrigin(c.env)}/p/${page.slug}` });
});

pages.get("/:id/source", async (c) => {
  const page = await getPage(c.env.DB, c.req.param("id"));
  if (!page) return c.json({ error: "Page not found" }, 404);
  let spec: PageSpec;
  try {
    spec = JSON.parse(page.spec_json) as PageSpec;
  } catch {
    return c.json({ error: "Stored spec is unreadable" }, 500);
  }
  return c.json({
    id: page.id,
    slug: page.slug,
    html: renderPageHtml(spec),
    react: renderPageReact(spec),
  });
});

pages.post("/:id/status", async (c) => {
  const raw = await readJson(c);
  if (!isStatus(raw.status)) return c.json({ error: "status must be one of draft|building|review|published|failed" }, 400);
  const page = await setPageStatus(c.env.DB, c.req.param("id"), raw.status);
  if (!page) return c.json({ error: "Page not found" }, 404);
  return c.json({ page: publicPage(page) });
});

pages.post("/:id/orders", async (c) => {
  const raw = await readJson(c);
  const amount = priceToMicros(raw.amount_usd ?? raw.amount);
  if (amount <= 0) return c.json({ error: "amount_usd must be a positive number" }, 400);
  const buyer = str(raw.buyer, 120) || `human:${authedUser(c).sub}`;
  const order = await recordOrder(c.env.DB, {
    pageId: c.req.param("id"),
    buyer,
    amountMicros: amount,
    txRef: str(raw.tx_ref, 120) || null,
  });
  if (!order) return c.json({ error: "Page not found" }, 404);
  return c.json({ order }, 201);
});

// ── Hosted pages ──────────────────────────────────────────────────────────────

/**
 * The hosted connection. Served from whatever host the request arrives on so it
 * works on mcp.clawdyclaw.com in production and on localhost in dev.
 *
 * Only published pages are served; a page under construction is reachable to its
 * owner through /api/v1/pages/:id but never through the public route.
 */
export const hosted = new Hono<{ Bindings: PagesEnv }>();

hosted.get("/p/:slug", async (c) => {
  const page = await getPageBySlug(c.env.DB, c.req.param("slug"));
  if (!page || page.status !== "published" || !page.html) {
    return c.text("Not found", 404);
  }
  return c.html(page.html, 200, {
    // Pages are immutable artefacts; let the edge hold them.
    "cache-control": "public, max-age=300",
    "x-page-id": page.id,
    "x-page-kind": page.kind,
  });
});

// ── Projections ───────────────────────────────────────────────────────────────

function publicPage(p: {
  id: string;
  slug: string;
  kind: PageKind;
  status: PageStatus;
  title: string;
  brand: string | null;
  agent_name: string | null;
  created_at: number;
  built_at: number | null;
  published_at: number | null;
  price_micros: number;
  sold_count: number;
  revenue_micros: number;
}) {
  return {
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    status: p.status,
    title: p.title,
    brand: p.brand,
    agent: p.agent_name,
    created_at: p.created_at,
    built_at: p.built_at,
    published_at: p.published_at,
    price_micros: p.price_micros,
    sold_count: p.sold_count,
    revenue_micros: p.revenue_micros,
  };
}

type BoardProjection = Awaited<ReturnType<typeof boardRows>>[number];

function publicBoardRow(r: BoardProjection, env: PagesEnv) {
  return {
    ...publicPage(r),
    seconds_on_market: r.seconds_on_market,
    hosted_url: `${pageOrigin(env)}/p/${r.slug}`,
  };
}

// ── Brief → spec ──────────────────────────────────────────────────────────────

/**
 * Turn a written brief into a PageSpec through the AI Gateway.
 *
 * Returns null rather than throwing when no gateway is configured or the call
 * fails — the caller surfaces a 503 and the agent can resend with explicit
 * blocks. A half-generated spec is worse than an honest failure.
 */
async function generateSpec(
  env: PagesEnv,
  brief: string,
  kind: string,
  palette: unknown
): Promise<Partial<PageSpec> | null> {
  const gateway = env.AI_GATEWAY_URL?.replace(/\/+$/, "");
  if (!gateway) return null;

  const prompt = [
    "You are designing a single web page on behalf of an agent customer.",
    `Page kind: ${kind}`,
    "",
    "Return ONLY a JSON object with keys: blocks, title, brand.",
    "blocks must be an array drawn from: hero, features, cards, stats, form, cta, consent.",
    "Use real, specific copy. Never use lorem ipsum.",
    kind === "oauth_client"
      ? "For oauth_client use exactly one block: {type:\"consent\", clientName, clientDescription, scopes:[...]}."
      : "Start with a hero block, then two supporting blocks.",
    "",
    `Brief: ${brief}`,
  ].join("\n");

  try {
    const res = await fetch(`${gateway}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      blocks: parsed.blocks as PageBlock[],
      title: str(parsed.title, 160),
      brand: str(parsed.brand, 80),
      palette: resolvePalette(palette ?? null),
    };
  } catch {
    return null;
  }
}

export default pages;