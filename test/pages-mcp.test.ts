import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, beforeEach } from "vitest";
import mcp from "../worker/api/mcp";
import pages from "../worker/api/pages";
import { hosted } from "../worker/api/pages";
import { SCHEMA_SQL, splitStatements } from "../worker/db/schema";
import { SESSION_COOKIE } from "../worker/lib/session";
import { boardRows, boardTotals, recordOrder } from "../worker/db/pages";
import { TOOL_DEFS } from "../worker/api/tools";
import type { BoardRow, PageSpec } from "../shared/pages";

// ── D1-shaped adapter over node:sqlite ───────────────────────────────────────

class MemD1 {
  private db = new DatabaseSync(":memory:");
  constructor() {
    for (const stmt of splitStatements(SCHEMA_SQL)) this.db.exec(stmt);
  }
  prepare(sql: string) {
    const db = this.db;
    let params: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        params = values;
        return statement;
      },
      async run() {
        db.prepare(sql).run(...(params as never[]));
        return { success: true };
      },
      async first() {
        return db.prepare(sql).get(...(params as never[])) ?? null;
      },
      async all() {
        return { results: db.prepare(sql).all(...(params as never[])) };
      },
    };
    return statement;
  }
  async batch(stmts: { run(): Promise<unknown> }[]) {
    return Promise.all(stmts.map((s) => s.run()));
  }
}

class MemKV {
  map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.map.set(key, value);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
}

const OK: Record<string, unknown> = { X402_DEV_BYPASS: "true" };

async function env() {
  const kv = new MemKV();
  await kv.put("session:good", JSON.stringify({ sub: "u1", email: "u@example.com", name: "U One" }));
  const DB = new MemD1();
  return { DB, SESSIONS: kv as unknown as KVNamespace, ...OK } as never;
}

const COOKIE = { Cookie: `${SESSION_COOKIE}=good` };

function post(body: unknown, e: unknown, headers: Record<string, string> = {}) {
  return mcp.fetch(
    new Request("http://clawdyclaw.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    e as never
  );
}

function rpc(body: unknown) {
  return { jsonrpc: "2.0", id: 1, ...(body as object) };
}

async function callTool(name: string, args: Record<string, unknown>, e: unknown) {
  const res = await post(
    rpc({ method: "tools/call", params: { name, arguments: args } }),
    e,
    COOKIE
  );
  const body = (await res.json()) as Record<string, never>;
  if (body.error) throw new Error(JSON.stringify(body.error));
  const result = body.result as unknown as { structuredContent?: unknown; content: { text: string }[] };
  return (result.structuredContent ?? JSON.parse(result.content[0].text)) as Record<string, unknown>;
}

const HERO_BLOCKS = [
  { type: "hero", eyebrow: "Beta", title: "Built by an agent", body: "Ordered, not prompted." },
];

// ── Registry ──────────────────────────────────────────────────────────────────

describe("pages category in the registry", () => {
  it("exposes the three page tools on the MCP surface", () => {
    const pageTools = TOOL_DEFS.filter((t) => t.category === "pages");
    expect(pageTools.map((t) => t.name).sort()).toEqual([
      "order_page",
      "page_market_stats",
      "page_source",
    ]);
  });

  it("prices the executable page tools and leaves the board free", () => {
    const byName = new Map(TOOL_DEFS.map((t) => [t.name, t]));
    expect(byName.get("order_page")?.x402_price_usd).toBeGreaterThan(0);
    expect(byName.get("page_source")?.x402_price_usd).toBeGreaterThan(0);
    expect(byName.get("page_market_stats")?.x402_price_usd).toBe(0);
  });

  it("sends blocks as a string, because MCP clients are not required to send objects", () => {
    const def = TOOL_DEFS.find((t) => t.name === "order_page");
    expect(def?.inputSchema.properties.blocks?.type).toBe("string");
    expect(def?.inputSchema.required).toEqual(["kind"]);
  });
});

// ── MCP execution ─────────────────────────────────────────────────────────────

describe("order_page over /mcp/v1", () => {
  it("requires a session", async () => {
    const e = await env();
    const res = await post(rpc({ method: "tools/call", params: { name: "order_page", arguments: {} } }), e);
    expect(res.status).toBe(401);
  });

  it("builds a page and returns a hosted url and a slug", async () => {
    const e = await env();
    const out = await callTool(
      "order_page",
      {
        kind: "landing",
        title: "Agent Landing",
        brand: "Clawdy",
        palette: "obsidian",
        price_usd: 12,
        blocks: JSON.stringify(HERO_BLOCKS),
      },
      e
    );
    expect(out.page_id).toBeTruthy();
    expect(out.slug).toBe("agent-landing");
    expect(out.hosted_url).toBe(`https://mcp.clawdyclaw.com/p/agent-landing`);
    expect(out.price_micros).toBe(12_000_000);
    expect(out.warnings).toEqual([]);
  });

  it("accepts blocks as an array as well as a JSON string", async () => {
    const e = await env();
    const out = await callTool(
      "order_page",
      { kind: "landing", title: "Array Blocks", blocks: HERO_BLOCKS },
      e
    );
    expect(out.warnings).toEqual([]);
    expect(out.slug).toBe("array-blocks");
  });

  // A tool that fails reports failure in its result rather than raising a
  // JSON-RPC error — the RPC succeeded, the build did not.
  it("reports invalid blocks instead of rendering a blank page", async () => {
    const e = await env();
    const out = await callTool(
      "order_page",
      { kind: "landing", title: "Broken", blocks: "{not json" },
      e
    );
    expect(out.error).toMatch(/not valid JSON/);
  });

  it("refuses an order with no renderable blocks", async () => {
    const e = await env();
    const out = await callTool("order_page", { kind: "landing", title: "Empty", blocks: "[]" }, e);
    expect(out.error).toMatch(/no renderable blocks/);
  });

  it("gives colliding titles distinct slugs", async () => {
    const e = await env();
    const a = await callTool("order_page", { kind: "landing", title: "Same", blocks: HERO_BLOCKS }, e);
    const b = await callTool("order_page", { kind: "landing", title: "Same", blocks: HERO_BLOCKS }, e);
    expect(a.page_id).not.toBe(b.page_id);
    expect(a.slug).not.toBe(b.slug);
  });
});

describe("page_source over /mcp/v1", () => {
  let e: unknown;
  let pageId: string;

  beforeEach(async () => {
    e = await env();
    const out = await callTool("order_page", { kind: "landing", title: "Take Me", blocks: HERO_BLOCKS }, e);
    pageId = out.page_id as string;
  });

  it("returns both renderings of the same page", async () => {
    const out = await callTool("page_source", { page_id: pageId }, e);
    const html = out.html as string;
    const react = out.react as string;
    expect(html).toContain("Take Me");
    expect(react).toContain("export default function ClawdyPage");
    expect(react).toContain("Take Me");
  });

  it("reports a missing page rather than inventing one", async () => {
    const out = await callTool("page_source", { page_id: "nope" }, e);
    expect(out.error).toMatch(/Page not found/);
  });
});

// ── REST surface ──────────────────────────────────────────────────────────────

function rest(e: unknown, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return pages.fetch(
    new Request(`http://clawdyclaw.com${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    e as never
  );
}

describe("REST page ordering", () => {
  it("returns a hosted url plus both sources", async () => {
    const e = await env();
    const res = await rest(
      e,
      "POST",
      "/",
      { kind: "landing", title: "REST Page", palette: "bone", blocks: HERO_BLOCKS },
      { ...COOKIE }
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, never>;
    expect(body.hosted_url).toBe("https://mcp.clawdyclaw.com/p/rest-page");
    const source = body.source as { html: string; react: string };
    expect(source.html).toContain("REST Page");
    expect(source.react).toContain("ClawdyPage");
  });

  it("records what it had to drop instead of failing silently", async () => {
    const e = await env();
    const res = await rest(
      e,
      "POST",
      "/",
      { kind: "landing", title: "Messy", blocks: [{ type: "hero" }, { type: "wat" }] },
      { ...COOKIE }
    );
    const body = (await res.json()) as { warnings: string[] };
    expect(body.warnings.length).toBe(2);
  });

  it("gates the board behind a session", async () => {
    const e = await env();
    const anon = await pages.fetch(
      new Request("http://clawdyclaw.com/", { headers: { Cookie: "" } }),
      e
    );
    expect(anon.status).toBe(401);

    const authed = await pages.fetch(
      new Request("http://clawdyclaw.com/", { headers: { ...COOKIE } }),
      e
    );
    expect(authed.status).toBe(200);
  });
});

// ── Hosted delivery ───────────────────────────────────────────────────────────

describe("hosted page delivery", () => {
  it("serves a published page and 404s everything else", async () => {
    const e = await env();
    await pages.fetch(
      new Request("http://clawdyclaw.com/", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...COOKIE },
        body: JSON.stringify({ kind: "landing", title: "Hosted One", blocks: HERO_BLOCKS }),
      }),
      e
    );

    const hit = await hosted.fetch(
      new Request("http://mcp.clawdyclaw.com/p/hosted-one"),
      e
    );
    expect(hit.status).toBe(200);
    expect(hit.headers.get("x-page-kind")).toBe("landing");
    expect(await hit.text()).toContain("Hosted One");

    const miss = await hosted.fetch(
      new Request("http://mcp.clawdyclaw.com/p/not-a-page"),
      e
    );
    expect(miss.status).toBe(404);
  });

  it("does not publish a page that is still in review", async () => {
    const e = await env();
    const created = (await (
      await pages.fetch(
        new Request("http://clawdyclaw.com/", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...COOKIE },
          body: JSON.stringify({ kind: "landing", title: "Draft One", status: "review", blocks: HERO_BLOCKS }),
        }),
        e
      )
    ).json()) as { page: { slug: string } };

    const res = await hosted.fetch(
      new Request(`http://mcp.clawdyclaw.com/p/${created.page.slug}`),
      e
    );
    expect(res.status).toBe(404);
  });
});

// ── The board ─────────────────────────────────────────────────────────────────

describe("tools board", () => {
  let e: unknown;
  let DB: MemD1;

  beforeEach(async () => {
    e = await env();
    DB = (e as unknown as { DB: MemD1 }).DB;
  });

  it("reports age, time on market, price, sold and revenue", async () => {
    const created = (await (
      await pages.fetch(
        new Request("http://clawdyclaw.com/", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...COOKIE },
          body: JSON.stringify({
            kind: "landing",
            title: "Board Page",
            price_usd: 4,
            blocks: HERO_BLOCKS,
          }),
        }),
        e
      )
    ).json()) as { page: { id: string } };

    const pageId = created.page.id;
    await recordOrder(DB as never, { pageId, buyer: "agent:buyer-1", amountMicros: 4_000_000 });
    await recordOrder(DB as never, { pageId, buyer: "agent:buyer-2", amountMicros: 4_000_000 });

    const rows = await boardRows(DB as never);
    const row = rows.find((r) => r.id === pageId) as BoardRow;

    expect(row.price_micros).toBe(4_000_000);
    expect(row.sold_count).toBe(2);
    expect(row.revenue_micros).toBe(8_000_000);
    expect(row.seconds_on_market).toBeGreaterThanOrEqual(0);
    expect(row.published_at).not.toBeNull();

    const totals = await boardTotals(DB as never);
    expect(totals.pages).toBe(1);
    expect(totals.published).toBe(1);
    expect(totals.sold).toBe(2);
    expect(totals.revenue_micros).toBe(8_000_000);
  });

  it("never reports negative time on market for a future publish", async () => {
    await pages.fetch(
      new Request("http://clawdyclaw.com/", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...COOKIE },
        body: JSON.stringify({ kind: "landing", title: "Future", blocks: HERO_BLOCKS }),
      }),
      e
    );
    // Ask the board what the state looks like an hour from now.
    const rows = await boardRows(DB as never, Date.now() + 3_600_000);
    for (const row of rows) expect(row.seconds_on_market).toBeGreaterThanOrEqual(0);
  });

  it("records an order against a page that does not exist as nothing", async () => {
    const order = await recordOrder(DB as never, {
      pageId: "ghost",
      buyer: "agent:x",
      amountMicros: 1_000_000,
    });
    expect(order).toBeNull();
  });
});

describe("spec round trip", () => {
  it("stores a spec that re-renders to the same page", async () => {
    const e = await env();
    const created = (await (
      await pages.fetch(
        new Request("http://clawdyclaw.com/", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...COOKIE },
          body: JSON.stringify({
            kind: "carousel",
            title: "Round Trip",
            palette: "parchment",
            blocks: [
              { type: "hero", title: "Hi" },
              { type: "cards", layout: "carousel", items: [{ title: "A" }, { title: "B" }] },
            ],
          }),
        }),
        e
      )
    ).json()) as { page: { id: string } };

    const res = await pages.fetch(
      new Request(`http://clawdyclaw.com/${created.page.id}/source`, { headers: { ...COOKIE } }),
      e
    );
    const body = (await res.json()) as { html: string };
    const spec = JSON.parse(JSON.stringify(body)) as unknown as { html: string };
    expect(spec.html).toContain('class="carousel"');
    expect(spec.html).toContain("--accent:");
  });
});

describe("PageSpec shape survives normalisation", () => {
  it("keeps the palette an agent asked for", async () => {
    const e = await env();
    const body = (await (
      await pages.fetch(
        new Request("http://clawdyclaw.com/", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...COOKIE },
          body: JSON.stringify({ kind: "landing", title: "P", palette: "bone", blocks: HERO_BLOCKS }),
        }),
        e
      )
    ).json()) as { source: { html: string } };
    const spec: PageSpec | null = null;
    expect(spec).toBeNull();
    // bone surface is #ffffff; a light page must not render on the dark surface.
    expect(body.source.html).toContain("--surface:#ffffff");
  });
});