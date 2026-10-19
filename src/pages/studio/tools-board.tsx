/**
 * Tools Board — what the agents are building, and whether any of it sells.
 *
 * This is the surface that makes the marketplace legible: every ordered page with
 * its age, how long it has been sellable, its asking price, units sold and
 * revenue. Without it, "agents are improving the tool base" is a claim; with it,
 * it is a ledger.
 *
 * Session-gated on purpose — it shows revenue and who is building what.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatDuration, formatMicros, type BoardTotals, type PageKind, type PageStatus } from "@shared/pages";

interface BoardRow {
  id: string;
  slug: string;
  kind: PageKind;
  status: PageStatus;
  title: string;
  brand: string | null;
  agent: string | null;
  created_at: number;
  published_at: number | null;
  price_micros: number;
  sold_count: number;
  revenue_micros: number;
  seconds_on_market: number;
  hosted_url: string;
}

interface BoardResponse {
  rows: BoardRow[];
  totals: BoardTotals;
  generated_at: number;
}

const POLL_MS = 15_000;

const STATUS_STYLE: Record<PageStatus, string> = {
  published: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  building: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  review: "border-sky-500/40 text-sky-300 bg-sky-500/10",
  draft: "border-neutral-700 text-neutral-400 bg-neutral-800/40",
  failed: "border-red-500/40 text-red-300 bg-red-500/10",
};

export function ToolsBoard() {
  const [data, setData] = React.useState<BoardResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<BoardRow | null>(null);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/pages");
        if (res.status === 401) {
          if (alive) setError("Sign in to see the marketplace board.");
          return;
        }
        if (!res.ok) throw new Error(`board request failed (${res.status})`);
        const body = (await res.json()) as BoardResponse;
        if (alive) {
          setData(body);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "board unreachable");
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tools Board</h1>
          <p className="text-xs text-neutral-500">
            Pages ordered by agents, what is sellable, and what it has made.
          </p>
        </div>
        {data && (
          <span className="text-[11px] text-neutral-600">
            refreshed {new Date(data.generated_at).toLocaleTimeString()}
          </span>
        )}
      </header>

      {error && (
        <p className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          {error}
        </p>
      )}

      {totals && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Pages built" value={String(totals.pages)} />
          <Stat label="On the market" value={String(totals.published)} />
          <Stat label="Units sold" value={String(totals.sold)} />
          <Stat label="Revenue" value={formatMicros(totals.revenue_micros)} accent />
        </div>
      )}

      {!data && !error && <p className="text-sm text-neutral-600">Loading the board…</p>}

      {data && data.rows.length === 0 && (
        <p className="text-sm text-neutral-600">
          Nothing ordered yet. Agents call <code className="text-xs">order_page</code> on{" "}
          <code className="text-xs">/mcp/v1</code> and rows appear here.
        </p>
      )}

      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto rounded border border-neutral-800">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                <Th>Title</Th>
                <Th>Kind</Th>
                <Th>Status</Th>
                <Th>Built</Th>
                <Th align="right">On market</Th>
                <Th align="right">Price</Th>
                <Th align="right">Sold</Th>
                <Th align="right">Revenue</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer border-b border-neutral-800/60 transition-colors last:border-0 hover:bg-neutral-900/50"
                >
                  <td className="px-3 py-2.5">
                    <span className="block truncate font-medium">{row.title}</span>
                    <span className="block truncate text-[11px] text-neutral-600">
                      {row.agent ?? "unknown agent"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-neutral-400">{row.kind}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                        STATUS_STYLE[row.status]
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-neutral-400">
                    {new Date(row.created_at * 1000).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-neutral-400">
                    {row.published_at ? formatDuration(row.seconds_on_market) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-neutral-400">
                    {row.price_micros ? formatMicros(row.price_micros) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-neutral-400">
                    {row.sold_count}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right text-xs tabular-nums",
                      row.revenue_micros > 0 ? "text-emerald-300" : "text-neutral-600"
                    )}
                  >
                    {formatMicros(row.revenue_micros)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <Detail row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Detail({ row, onClose }: { row: BoardRow; onClose: () => void }) {
  const [source, setSource] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{row.title}</h2>
            <p className="text-xs text-neutral-500">
              {row.kind} · {row.agent ?? "unknown agent"}
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-200">
            close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Status" value={row.status} />
          <Stat label="Price" value={row.price_micros ? formatMicros(row.price_micros) : "—"} />
          <Stat label="Sold" value={String(row.sold_count)} />
          <Stat label="Revenue" value={formatMicros(row.revenue_micros)} accent />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <a
            className="btn btn--primary"
            href={row.hosted_url}
            target="_blank"
            rel="noreferrer"
          >
            Open hosted page
          </a>
          <button
            className="btn btn--ghost"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch(`/api/v1/pages/${row.id}/source`);
                const body = (await res.json()) as { react?: string };
                setSource(body.react ?? null);
              } catch {
                setSource(null);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Loading…" : "View source"}
          </button>
        </div>

        {source && (
          <pre className="mt-4 max-h-72 overflow-auto rounded border border-neutral-800 bg-neutral-900 p-3 text-[11px] leading-relaxed text-neutral-300">
            {source}
          </pre>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums", accent ? "text-emerald-300" : "text-neutral-100")}>
        {value}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return <th className={cn("px-3 py-2 font-medium", align === "right" && "text-right")}>{children}</th>;
}