import * as React from "react";
import { SectionHeader, RawJson } from "@/components/studio/section-header";
import { TelemetryStream, type TelemetryEvent } from "@/components/studio/telemetry-stream";
import { LiveFeedWidget } from "@/components/studio/live-feed-widget";
import { WidgetFeedDrawer } from "@/components/studio/widget-feed-drawer";
import { fetchTasks, fetchWidgets, mountWidget, unmountWidget, type PortalWidget, type Task } from "@/lib/api";

/**
 * Command Center — operational pulse + the operator dashboard grid.
 *
 * Operator view: live stats + mounted WidgetFeed stream cards. The backend
 * (task queue, feeds, events) runs behind-the-curtain; humans see results.
 * Agent view: raw edge state + root tokens (the MCP schema side).
 */
export function CommandCenter({ mode, onMode }: { mode: "operator" | "agent"; onMode: (m: "operator" | "agent") => void }) {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [health, setHealth] = React.useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = React.useState<TelemetryEvent[]>([
    { ts: Date.now(), level: "info", message: "Command Center online — connecting to edge worker" },
  ]);
  const [error, setError] = React.useState<string | null>(null);
  const [widgets, setWidgets] = React.useState<PortalWidget[]>([]);
  const [drawerOpen, setDrawerOpen] = React.useState<boolean>(
    new URLSearchParams(window.location.search).get("widgetfeed") === "1"
  );

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [healthRes, taskRes, widgetRes] = await Promise.all([
          fetch("/api/health").then((r) => (r.ok ? (r.json() as Promise<Record<string, unknown>>) : null)),
          fetchTasks(),
          fetchWidgets(),
        ]);
        if (cancelled) return;
        setHealth(healthRes);
        setTasks(taskRes);
        setWidgets(widgetRes.widgets);
        setError(null);
        setEvents((prev) => [...prev.slice(-39), {
          ts: Date.now(),
          level: "info",
          message: `queue sync — ${taskRes.length} tasks · ${taskRes.filter((t) => t.status === "pending").length} awaiting approval · ${widgetRes.widgets.length} widgets mounted`,
        }]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "health sync failed");
      }
    }

    load();
    const interval = setInterval(load, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const pending = tasks.filter((t) => t.status === "pending").length;
  const executed = tasks.filter((t) => t.status === "executed").length;
  const approved = tasks.filter((t) => t.status === "approved").length;

  async function handleMount(platform: string, config?: Record<string, string>) {
    try {
      await mountWidget(platform, config ?? {});
      setWidgets((w) => [...w]);
      const fresh = await fetchWidgets();
      setWidgets(fresh.widgets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "mount failed");
    }
  }

  async function handleUnmount(platform: string) {
    await unmountWidget(platform);
    setWidgets((w) => w.filter((x) => x.platform !== platform));
  }

  const agentState = {
    host: new URL(window.location.href).hostname,
    worker_health: health,
    task_graph: { total: tasks.length, pending, approved, executed },
    portal_widgets: widgets.map((w) => ({ platform: w.platform, type: w.type, config: w.config, position: w.position })),
    jsonrpc_connections: ["/mcp/v1 connected=yes"],
    session_root_token: "session:… (opaque, KV-backed)",
  };

  return (
    <div>
      <SectionHeader
        title="Command Center"
        description="Your agent economy, live. Approve work, watch inbound signals stream in."
        mode={mode}
        onMode={onMode}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-beacon/40 bg-beacon/10 px-4 py-2 font-mono text-xs text-beacon">⚠ {error}</div>
      )}

      {mode === "operator" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Edge Worker" value={health ? "● online" : "…"} accent={health ? "text-emerald-400" : "text-silver"} />
            <Stat label="Inbound Tasks" value={String(tasks.length)} accent="text-silver" />
            <Stat label="Awaiting HITL" value={String(pending)} accent="text-ember" />
            <Stat label="Executed" value={String(executed)} accent="text-beacon" />
          </div>

          {/* WidgetFeed dashboard grid */}
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-beacon opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-beacon" />
                </span>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Live Feed Grid
                </h2>
              </div>
              <button
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-ember/40 bg-rust px-3 py-1.5 font-mono text-xs font-semibold text-chrome transition hover:bg-ember cursor-pointer"
              >
                <span className="text-base leading-none">+</span> WidgetFeed
              </button>
            </div>

            {widgets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-silver/30 p-10 text-center">
                <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted/30 text-2xl text-silver">◈</div>
                <h3 className="text-sm font-semibold text-porcelain">No widgets mounted yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Mount a live feed stream (YouTube, Medium, Substack, HackerNoon) or a webhook event
                  stream (X, Facebook) to keep an eye on your machine economy in realtime.
                </p>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="mt-4 rounded-md bg-ember px-4 py-2 text-sm font-semibold text-chrome transition hover:bg-ember/85 cursor-pointer"
                >
                  + Mount WidgetFeed
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {widgets.map((w) => (
                  <LiveFeedWidget key={w.platform} widget={w} onUnmount={handleUnmount} />
                ))}
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-silver/30 text-muted-foreground transition hover:border-ember/50 hover:text-porcelain cursor-pointer"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-muted/40 text-xl">+</span>
                  <span className="font-mono text-xs uppercase tracking-widest">Add widget</span>
                </button>
              </div>
            )}
          </div>

          {/* Telemetry ticker (small, unobtrusive) */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-silver/20 bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Agent Ticker</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">● LIVE</span>
              </div>
              <TelemetryStream events={events} className="h-[200px]" />
            </div>
            <div className="rounded-xl border border-silver/20 bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recent Executions</h2>
              {executed === 0 ? (
                <p className="text-sm text-muted-foreground">No executions yet — approve from the queue.</p>
              ) : (
                <div className="font-mono text-xs">
                  {tasks.filter((t) => t.status === "executed").slice(0, 6).map((t) => (
                    <div key={t.id} className="flex justify-between border-b border-silver/10 py-2 last:border-0">
                      <span className="text-muted-foreground">{t.id}</span>
                      <span className="text-porcelain">{t.action}</span>
                      <span className="text-emerald-400">✓</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <RawJson data={agentState} />
      )}

      <WidgetFeedDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mounted={widgets.map((w) => w.platform)}
        onMount={(id, config) => {
          void handleMount(id, config);
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-silver/25 bg-card p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xl tabular-nums ${accent ?? "text-porcelain"}`}>{value}</div>
    </div>
  );
}