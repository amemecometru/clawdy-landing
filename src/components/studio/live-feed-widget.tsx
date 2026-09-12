import * as React from "react";
import { fetchFeed, fetchFeedEvents, sendTestEvent, unmountWidget, type FeedItem, type FeedEvent, type PortalWidget } from "@/lib/api";

/**
 * Live information feed widget. Two modes:
 *   "feed"   → polls the server-side live RSS aggregation every 25s
 *   "events" → streams webhook / test events in realtime (2s poll)
 * The backend function happens behind-the-curtain — the card just renders it.
 */
export function LiveFeedWidget({
  widget,
  onUnmount,
}: {
  widget: PortalWidget;
  onUnmount: (platform: string) => void;
}) {
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const [events, setEvents] = React.useState<FeedEvent[]>([]);
  const [state, setState] = React.useState<"connecting" | "live" | "error">("connecting");
  const [status, setStatus] = React.useState<{ source: string | null; error?: string } | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState<FeedItem | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const loadFeed = async () => {
      try {
        const data = await fetchFeed(widget.platform, widget.config);
        if (cancelled) return;
        setStatus({ source: data.source, error: data.error });
        if (data.ok && data.items.length) {
          setItems(data.items);
          setState("live");
        } else if (data.error) {
          setState(data.error.includes("webhook") ? "live" : "error");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    };

    const loadEvents = async () => {
      try {
        const data = await fetchFeedEvents(widget.platform);
        if (cancelled) return;
        setEvents(data.events);
        if (data.events.length) setState("live");
      } catch {
        if (!cancelled) setState("error");
      }
    };

    if (widget.type === "feed") {
      loadFeed();
      timer = setInterval(loadFeed, 25000);
    } else {
      loadEvents();
      timer = setInterval(loadEvents, 2000);
      // Also show live RSS where available (YouTube etc. are feed-type, but events
      // platforms surface their upcoming/following content via the feed endpoint).
      loadFeed();
    }
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [widget.platform, widget.type]); // config changes re-fire through remount

  async function fireTestEvent() {
    try {
      await sendTestEvent(widget.platform);
      setToast("notification delivered — check the event stream");
      setTimeout(() => setToast(null), 3000);
      const data = await fetchFeedEvents(widget.platform);
      setEvents(data.events);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "delivery failed");
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function remove() {
    await unmountWidget(widget.platform);
    onUnmount(widget.platform);
  }

  const visibleItems = items.slice(0, 6);
  const visibleEvents = events.slice(0, 4);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-silver/25 bg-card transition hover:border-ember/40">
      <div className="flex items-center justify-between border-b border-silver/15 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`text-base font-black ${widget.color}`}>{widget.icon}</span>
          <div>
            <div className="text-sm font-semibold text-porcelain">{widget.name}</div>
            <div className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${state === "live" ? "animate-pulse bg-emerald-400" : state === "error" ? "bg-beacon" : "bg-amber-400"}`} />
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                {state === "live" ? "● live" : state === "error" ? "reconnecting" : "connecting…"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {widget.type === "events" && (
            <button
              onClick={() => void fireTestEvent()}
              title="Send a test event to verify the live pipeline"
              className="rounded-md border border-silver/25 px-2 py-1 font-mono text-[10px] text-porcelain/80 transition hover:border-ember/60 hover:text-ember cursor-pointer"
            >
              ⚡ test event
            </button>
          )}
          <button
            onClick={() => void remove()}
            title="Unmount widget"
            className="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-beacon/20 hover:text-beacon cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 px-4 py-3">
        {widget.type === "events" && visibleEvents.length > 0 && (
          <div className="space-y-1.5">
            {visibleEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-2 rounded-lg border border-silver/10 bg-obsidian/60 px-2.5 py-1.5">
                <span className="mt-0.5 flex size-1.5 shrink-0 rounded-full bg-ember" />
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-ember">{e.event_type}</div>
                  <div className="truncate text-[11px] leading-snug text-porcelain/80">
                    {messageOf(e.payload)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {reading && widget.type === "feed" ? (
          <InlineReader item={reading} onBack={() => setReading(null)} />
        ) : visibleItems.length > 0 ? (
          <div className="space-y-1.5">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setReading(item)}
                title="Read inside the widget"
                className="group block w-full rounded-lg border border-silver/10 bg-obsidian/40 px-2.5 py-2 text-left transition hover:border-ember/40 hover:bg-obsidian cursor-pointer"
              >
                <div className="line-clamp-2 text-xs font-medium leading-snug text-porcelain group-hover:text-porcelain">
                  {item.title}
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
                  {item.author && <span className="truncate text-ember/80">{item.author}</span>}
                  {item.published && <span className="shrink-0">{timeAgo(item.published)}</span>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <span className={`text-2xl ${widget.color}`}>{widget.icon}</span>
            {widget.type === "events" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Waiting for platform events…
                </p>
                {status?.source && (
                  <p className="truncate px-4 font-mono text-[10px] text-porcelain/40">
                    source · {status.source}
                  </p>
                )}
                <button
                  onClick={() => void fireTestEvent()}
                  className="mt-1 rounded-md bg-rust px-3 py-1.5 text-xs font-semibold text-chrome transition hover:bg-ember cursor-pointer"
                >
                  ⚡ Send test event
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {status?.error ? `feed paused — ${status.error}` : "no items yet — stream warming…"}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-silver/15 px-4 py-2">
        <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
          <span className="truncate">
            {widget.config && Object.entries(widget.config).filter(([, v]) => v).length
              ? Object.entries(widget.config).map(([k, v]) => `${k}:${v}`).join(" · ")
              : "default feed"}
          </span>
          <button
            onClick={() => void (widget.type === "feed" ? remove() : fireTestEvent())}
            className="shrink-0 uppercase tracking-wider text-porcelain/50 transition hover:text-ember cursor-pointer"
          >
            {widget.type === "feed" ? "unmount" : "refresh"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="border-t border-ember/30 bg-ember/10 px-4 py-1.5 font-mono text-[10px] text-ember">
          {toast}
        </div>
      )}
    </div>
  );
}

function messageOf(payload: unknown): string {
  if (!payload) return "event received";
  if (typeof payload === "string") return payload;
  const p = payload as Record<string, unknown>;
  if (typeof p.message === "string") return p.message;
  if (p.text) return String(p.text);
  return JSON.stringify(payload).slice(0, 80);
}

/** Strip dangerous HTML from feed summaries; keep safe inline markup. */
function sanitizeSummary(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/<a\s/gi, "<a ")
    .slice(0, 4000);
}

/** In-widget article reader — the feed content stays inside the card. */
function InlineReader({ item, onBack }: { item: FeedItem; onBack: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-porcelain cursor-pointer"
        >
          ← feed
        </button>
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] uppercase tracking-widest text-ember transition hover:text-porcelain"
          >
            open original ↗
          </a>
        )}
      </div>
      <div className="rounded-lg border border-silver/15 bg-obsidian/70 p-3">
        <h4 className="text-sm font-semibold leading-snug text-porcelain">{item.title}</h4>
        <div className="mt-1 flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
          {item.author && <span className="truncate text-ember/80">{item.author}</span>}
          {item.published && <span className="shrink-0">{timeAgo(item.published)}</span>}
        </div>
        {sanitizeSummary(item.summary) ? (
          <div
            className="feed-article mt-3 text-xs leading-relaxed text-porcelain/80"
            dangerouslySetInnerHTML={{ __html: sanitizeSummary(item.summary) }}
          />
        ) : (
          <p className="mt-3 text-xs italic text-muted-foreground">No inline excerpt from this feed — open the original for full content.</p>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}