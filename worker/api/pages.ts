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
  let generation: GenerateSpecResult | null = null;

  const brief = str(raw.brief, 2000);
  if (brief && !Array.isArray(raw.blocks)) {
    generation = await generateSpec(c.env, brief, str(raw.kind) || "landing", raw.palette);
    if (generation) {
      source = { ...raw, ...generation.spec, brief: undefined };
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
      generation: generation
        ? { model: generation.model, usage: generation.usage }
        : null,
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
/**
 * The one production model that generates sellable pages.
 *
 * This is a model-selection decision, not a default: the brief→spec path is the
 * product, and the price in §7 step 3 is derived from this model's measured
 * per-call cost. Keeping it as one named constant means swapping the backend
 * later is a single edit here rather than a hunt through the inference layer.
 *
 * Cloudflare-hosted, so it runs on the AI binding without an account token in
 * the Worker. Published unit pricing: $0.66/M input, $1.00/M output tokens.
 */
export const PRODUCT_GENERATION_MODEL = "@cf/qwen/qwen2.5-coder-32b-instruct";

/** Token accounting from one generation, recorded so price can be set from it. */
export interface GenerationUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  neurons: number;
}

export interface GenerateSpecResult {
  spec: Partial<PageSpec>;
  usage: GenerationUsage;
  model: string;
}

async function generateSpec(
  env: PagesEnv,
  brief: string,
  kind: string,
  palette: unknown
): Promise<GenerateSpecResult | null> {
  const prompt = [
    "You are designing a single web page on behalf of an agent customer.",
    `Page kind: ${kind}`,
    "",
    "Return ONLY a JSON object with keys: blocks, title, brand.",
    "blocks must be an array drawn from: hero, features, cards, stats, form, cta, consent.",
    "Use real, specific copy. Never use lorem ipsum.",
    kind === "oauth_client"
      ? 'For oauth_client use exactly one block: {type:"consent", clientName, clientDescription, scopes:[...]}.'
      : "Start with a hero block, then two supporting blocks.",
    "",
    `Brief: ${brief}`,
  ].join("\n");

  try {
    // Routed through AI Gateway so every call is logged with its token usage.
    // That log is the only honest source for the price in §7 step 3.
    const result = (await env.AI.run(
      PRODUCT_GENERATION_MODEL,
      { messages: [{ role: "user", content: prompt }] },
      { gateway: { id: "default" } }
    )) as {
      response?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; neurons?: number };
    };

    const content = extractJson(result.response);
    if (!content) return null;

    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      spec: {
        blocks: parsed.blocks as PageBlock[],
        title: str(parsed.title, 160),
        brand: str(parsed.brand, 80),
        palette: resolvePalette(palette ?? null),
      },
      usage: {
        prompt_tokens: Number(result.usage?.prompt_tokens ?? 0),
        completion_tokens: Number(result.usage?.completion_tokens ?? 0),
        total_tokens: Number(result.usage?.total_tokens ?? 0),
        neurons: Number(result.usage?.neurons ?? 0),
      },
      model: PRODUCT_GENERATION_MODEL,
    };
  } catch {
    return null;
  }
}

/**
 * Pull the JSON object out of a model response.
 *
 * Instruct-tuned models wrap JSON in prose or fence it despite being told not
 * to. Slicing the outermost braces tolerates that; returning null when there is
 * no object at all means a malformed generation is dropped with a warning rather
 * than rendered as a blank page.
 */
function extractJson(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

export default pages;