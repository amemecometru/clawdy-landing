import * as React from "react";
import { SectionHeader, RawJson } from "@/components/studio/section-header";
import { TelemetryStream, type TelemetryEvent } from "@/components/studio/telemetry-stream";
import { fetchTasks, type Task } from "@/lib/api";

/**
 * Command Center — operational pulse check.
 * Operator: live health, throughput stats, recent executions.
 * Agent: raw edge state, root tokens, current task graph.
 */
export function CommandCenter({ mode, onMode }: { mode: "operator" | "agent"; onMode: (m: "operator" | "agent") => void }) {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [health, setHealth] = React.useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = React.useState<TelemetryEvent[]>([
    { ts: Date.now(), level: "info", message: "Command Center online — connecting to edge worker" },
  ]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [healthRes, taskRes] = await Promise.all([
          fetch("/api/health").then((r) => (r.ok ? (r.json() as Promise<Record<string, unknown>>) : null)),
          fetchTasks(),
        ]);
        if (cancelled) return;
        setHealth(healthRes);
        setTasks(taskRes);
        setError(null);
        setEvents((prev) => [...prev.slice(-49), {
          ts: Date.now(),
          level: "info",
          message: `queue sync — ${taskRes.length} tasks · ${taskRes.filter((t) => t.status === "pending").length} awaiting approval`,
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
  const approved = tasks.filter((t) => t.status === "approved").length;
  const executed = tasks.filter((t) => t.status === "executed").length;

  const agentState = {
    host: new URL(window.location.href).hostname,
    worker_health: health,
    task_graph: {
      total: tasks.length,
      pending,
      approved,
      executed,
      ids: tasks.map((t) => t.id),
    },
    jsonrpc_connections: ["/mcp/v1 connected=yes"],
    session_root_token: "session:… (opaque, KV-backed)",
  };

  return (
    <div>
      <SectionHeader
        title="Command Center"
        description="Operational pulse — agent loops, throughput, and system health."
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

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
            <div className="flex flex-col gap-2 rounded-xl border border-silver/20 bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Telemetry</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">● LIVE</span>
              </div>
              <TelemetryStream events={events} className="h-[240px]" />
            </div>
          </div>
        </>
      ) : (
        <RawJson data={agentState} />
      )}
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