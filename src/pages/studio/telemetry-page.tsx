import * as React from "react";
import { SectionHeader, RawJson } from "@/components/studio/section-header";
import { fetchTelemetry, type IngressRecord, type ExecutionRecord } from "@/lib/api";

/**
 * Telemetry — structured activity feed.
 * Operator: filterable ingress/execution tables, polling.
 * Agent: exact stored rows (what the schema emits).
 */
export function TelemetryPage({ mode, onMode }: { mode: "operator" | "agent"; onMode: (m: "operator" | "agent") => void }) {
  const [ingress, setIngress] = React.useState<IngressRecord[]>([]);
  const [executions, setExecutions] = React.useState<ExecutionRecord[]>([]);
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [toolFilter, setToolFilter] = React.useState<string>("all");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await fetchTelemetry();
      setIngress(data.ingress);
      setExecutions(data.executions);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "telemetry load failed");
    }
  }, []);

  React.useEffect(() => {
    void load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const sources = Array.from(new Set(ingress.map((i) => i.source)));
  const tools = Array.from(new Set(executions.map((e) => e.tool)));

  const inRows = ingress
    .filter((i) => sourceFilter === "all" || i.source === sourceFilter)
    .slice(0, 30);
  const exRows = executions
    .filter((e) => toolFilter === "all" || e.tool === toolFilter)
    .slice(0, 30);

  if (mode === "agent") {
    return (
      <div>
        <SectionHeader title="Telemetry — MCP Schema" description="Raw D1 rows exactly as the system stores them." mode={mode} onMode={onMode} />
        <RawJson data={{ ingress_log: inRows, executions: exRows, limit: 30, poll_interval_ms: 15000 }} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Telemetry" description="Every inbound signal and downstream execution — live from the edge store." mode={mode} onMode={onMode} />

      {error && (
        <div className="mb-4 rounded-lg border border-beacon/40 bg-beacon/10 px-4 py-2 font-mono text-xs text-beacon">⚠ {error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-silver/20 bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Ingress Log</h2>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none"
            >
              <option value="all">all sources</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="text-muted-foreground">
                <tr><th className="px-2 py-1">Source</th><th className="px-2 py-1">Payload</th><th className="px-2 py-1">Task</th><th className="px-2 py-1">At</th></tr>
              </thead>
              <tbody>
                {inRows.map((r) => (
                  <tr key={r.id} className="border-t border-silver/10 align-top">
                    <td className="px-2 py-1.5">
                      <span className="rounded-full bg-rust/20 px-2 py-0.5 text-[10px] text-rust-foreground">{r.source}</span>
                    </td>
                    <td className="max-w-[260px] truncate px-2 py-1.5 text-porcelain/70">{truncate(r.raw_body, 90)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.task_id ?? "—"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{new Date(r.created_at * 1000).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {inRows.length === 0 && (
                  <tr><td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">No inbound signals yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-silver/20 bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Executions</h2>
            <select
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none"
            >
              <option value="all">all tools</option>
              {tools.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="text-muted-foreground">
                <tr><th className="px-2 py-1">Tool</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Result</th><th className="px-2 py-1">At</th></tr>
              </thead>
              <tbody>
                {exRows.map((e) => (
                  <tr key={e.id} className="border-t border-silver/10 align-top">
                    <td className="px-2 py-1.5 text-porcelain">{e.tool}</td>
                    <td className="px-2 py-1.5">
                      <span className={e.ok ? "text-emerald-400" : "text-beacon"}>{e.ok ? "✓ ok" : "✕ failed"}</span>
                    </td>
                    <td className="max-w-[240px] truncate px-2 py-1.5 text-porcelain/70">{truncate(e.result ?? "", 90)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{new Date(e.created_at * 1000).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {exRows.length === 0 && (
                  <tr><td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">No executions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}