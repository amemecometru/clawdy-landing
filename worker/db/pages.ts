/**
 * Pages data access.
 *
 * The board reads are deliberately shaped for the tools board: one aggregate
 * query returns every row with its money and its time-on-market already
 * computed, so the board never fans out into N queries per row.
 */

import {
  slugify,
  type BoardRow,
  type BoardTotals,
  type PageBuild,
  type PageKind,
  type PageOrder,
  type PageSpec,
  type PageStatus,
} from "../../shared/pages";

const PAGE_COLUMNS =
  "id, slug, kind, status, title, brand, agent_name, spec_json, html, created_at, built_at, published_at, price_micros, sold_count, revenue_micros";

export interface CreatePageInput {
  spec: PageSpec;
  agentName: string | null;
  html: string;
  status: PageStatus;
  /** Asking price in micros. Defaults to 0 (not listed for sale). */
  priceMicros?: number;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function toBuild(row: Record<string, unknown>): PageBuild {
  return {
    id: String(row.id),
    slug: String(row.slug),
    kind: String(row.kind) as PageKind,
    status: String(row.status) as PageStatus,
    title: String(row.title),
    brand: (row.brand as string | null) ?? null,
    agent_name: (row.agent_name as string | null) ?? null,
    spec_json: String(row.spec_json),
    html: (row.html as string | null) ?? null,
    created_at: Number(row.created_at),
    built_at: row.built_at === null ? null : Number(row.built_at),
    published_at: row.published_at === null ? null : Number(row.published_at),
    price_micros: Number(row.price_micros ?? 0),
    sold_count: Number(row.sold_count ?? 0),
    revenue_micros: Number(row.revenue_micros ?? 0),
  };
}

export async function createPage(db: D1Database, input: CreatePageInput): Promise<PageBuild> {
  const id = crypto.randomUUID();
  // Suffix collisions rather than failing: two agents ordering "Landing Page"
  // in the same second must both get a page.
  const slug = await uniqueSlug(db, slugify(`${input.spec.title}`));
  const ts = nowSeconds();

  await db
    .prepare(
      `INSERT INTO page_builds
         (id, slug, kind, status, title, brand, agent_name, spec_json, html,
          created_at, built_at, published_at, price_micros)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      slug,
      input.spec.kind,
      input.status,
      input.spec.title,
      input.spec.brand ?? null,
      input.agentName,
      JSON.stringify(input.spec),
      input.html,
      ts,
      ts,
      input.status === "published" ? ts : null,
      input.priceMicros ?? 0
    )
    .run();

  return (await getPage(db, id))!;
}

async function uniqueSlug(db: D1Database, base: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const hit = await db
      .prepare(`SELECT 1 FROM page_builds WHERE slug = ? LIMIT 1`)
      .bind(candidate)
      .first();
    if (!hit) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function getPage(db: D1Database, id: string): Promise<PageBuild | null> {
  const row = await db
    .prepare(`SELECT ${PAGE_COLUMNS} FROM page_builds WHERE id = ? LIMIT 1`)
    .bind(id)
    .first();
  return row ? toBuild(row) : null;
}

export async function getPageBySlug(db: D1Database, slug: string): Promise<PageBuild | null> {
  const row = await db
    .prepare(`SELECT ${PAGE_COLUMNS} FROM page_builds WHERE slug = ? LIMIT 1`)
    .bind(slug)
    .first();
  return row ? toBuild(row) : null;
}

export async function listPages(db: D1Database, limit = 200): Promise<PageBuild[]> {
  const result = await db
    .prepare(`SELECT ${PAGE_COLUMNS} FROM page_builds ORDER BY created_at DESC LIMIT ?`)
    .bind(Math.min(Math.max(limit, 1), 500))
    .all();
  return (result.results ?? []).map((r) => toBuild(r as Record<string, unknown>));
}

export async function setPageStatus(
  db: D1Database,
  id: string,
  status: PageStatus
): Promise<PageBuild | null> {
  const publishAt = status === "published" ? nowSeconds() : null;
  await db
    .prepare(
      `UPDATE page_builds
          SET status = ?,
              published_at = COALESCE(published_at, ?)
        WHERE id = ?`
    )
    .bind(status, publishAt, id)
    .run();
  return getPage(db, id);
}

export async function updatePageHtml(
  db: D1Database,
  id: string,
  html: string,
  spec: PageSpec
): Promise<PageBuild | null> {
  await db
    .prepare(
      `UPDATE page_builds
          SET html = ?, spec_json = ?, built_at = ?
        WHERE id = ?`
    )
    .bind(html, JSON.stringify(spec), nowSeconds(), id)
    .run();
  return getPage(db, id);
}

// ── Orders / revenue ──────────────────────────────────────────────────────────

export async function recordOrder(
  db: D1Database,
  input: { pageId: string; buyer: string; amountMicros: number; txRef?: string | null }
): Promise<PageOrder | null> {
  const page = await getPage(db, input.pageId);
  if (!page) return null;

  const order: PageOrder = {
    id: crypto.randomUUID(),
    page_id: input.pageId,
    buyer: input.buyer,
    amount_micros: input.amountMicros,
    currency: "USD",
    tx_ref: input.txRef ?? null,
    created_at: nowSeconds(),
  };

  // The denormalised counters and the order row move together; a partial write
  // would make the board disagree with the ledger.
  const batch = [
    db
      .prepare(
        `INSERT INTO page_orders (id, page_id, buyer, amount_micros, currency, tx_ref, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        order.id,
        order.page_id,
        order.buyer,
        order.amount_micros,
        order.currency,
        order.tx_ref,
        order.created_at
      ),
    db
      .prepare(
        `UPDATE page_builds
            SET sold_count = sold_count + 1,
                revenue_micros = revenue_micros + ?
          WHERE id = ?`
      )
      .bind(order.amount_micros, order.page_id),
  ];

  await db.batch(batch);
  return order;
}

export async function listOrders(db: D1Database, pageId?: string): Promise<PageOrder[]> {
  const sql = pageId
    ? `SELECT * FROM page_orders WHERE page_id = ? ORDER BY created_at DESC LIMIT 200`
    : `SELECT * FROM page_orders ORDER BY created_at DESC LIMIT 200`;
  const stmt = pageId ? db.prepare(sql).bind(pageId) : db.prepare(sql);
  const result = await stmt.all();
  return (result.results ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      page_id: String(row.page_id),
      buyer: String(row.buyer),
      amount_micros: Number(row.amount_micros),
      currency: String(row.currency ?? "USD"),
      tx_ref: (row.tx_ref as string | null) ?? null,
      created_at: Number(row.created_at),
    };
  });
}

// ── The board ─────────────────────────────────────────────────────────────────

/**
 * One query for the whole board, with time-on-market computed in SQL so it is
 * correct regardless of what the client clock says. No joins: every column the
 * board needs lives on page_builds, so this stays a single indexed scan.
 */
export async function boardRows(db: D1Database, now = Date.now()): Promise<BoardRow[]> {
  const nowSec = Math.floor(now / 1000);
  const result = await db
    .prepare(
      `SELECT ${PAGE_COLUMNS},
              CASE WHEN published_at IS NOT NULL
                   THEN MAX(0, ? - published_at)
                   ELSE 0 END AS seconds_on_market
         FROM page_builds
        ORDER BY created_at DESC
        LIMIT 500`
    )
    .bind(nowSec)
    .all();

  return (result.results ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const build = toBuild(row);
    return {
      ...build,
      price_micros: build.price_micros,
      listed_at: build.published_at,
      seconds_on_market: Number(row.seconds_on_market ?? 0),
    };
  });
}

export async function boardTotals(db: D1Database): Promise<BoardTotals> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS pages,
              SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
              COALESCE(SUM(sold_count), 0) AS sold,
              COALESCE(SUM(revenue_micros), 0) AS revenue
         FROM page_builds`
    )
    .first();

  const r = (row ?? {}) as Record<string, unknown>;
  return {
    pages: Number(r.pages ?? 0),
    published: Number(r.published ?? 0),
    sold: Number(r.sold ?? 0),
    revenue_micros: Number(r.revenue ?? 0),
  };
}