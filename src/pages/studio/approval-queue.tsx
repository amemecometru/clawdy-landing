import * as React from "react";
import { SectionHeader, RawJson } from "@/components/studio/section-header";
import { ApprovalCard } from "@/components/studio/approval-card";
import { fetchTasks, approveTask, rejectTask, executeTask, type Task } from "@/lib/api";

/**
 * Approval Queue — the HITL gate.
 * Operator: approve/reject with notes, resolved history.
 * Agent: the MCP call trace + gating result JSON-RPC payloads.
 */
export function ApprovalQueue({ mode, onMode }: { mode: "operator" | "agent"; onMode: (m: "operator" | "agent") => void }) {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [busyKind, setBusyKind] = React.useState<"approved" | "rejected" | "executed">("approved");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setTasks(await fetchTasks());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "queue load failed");
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const pending = tasks.filter((t) => t.status === "pending");
  const resolved = tasks.filter((t) => t.status !== "pending");

  async function decide(decision: "approved" | "rejected", id: string, note?: string) {
    setBusy(id); setBusyKind(decision);
    try {
      if (decision === "approved") await approveTask(id, { operator: "studio@clawdyclaw.com", note });
      else await rejectTask(id, { operator: "studio@clawdyclaw.com", note });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "decision failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleExecute(id: string) {
    setBusy(id); setBusyKind("executed");
    try {
      await executeTask(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "execution failed");
    } finally {
      setBusy(null);
    }
  }

  if (mode === "agent") {
    return (
      <div>
        <SectionHeader title="Approval Queue — MCP View" description="Machine-readable gating ledger: every HITL decision as a JSON-RPC record." mode={mode} onMode={onMode} />
        <RawJson data={{
          jsonrpc: "2.0",
          gate: {
            intercept_on: ["send_email", "draft_reply"],
            pending_count: pending.length,
            resolved_count: resolved.length,
          },
          queue: pending.map((t) => ({
            task_id: t.id,
            source: t.source,
            action: t.action,
            autonomy_required: t.priority === "critical" ? "block" : "review",
            payload: safeParse(t.payload),
          })),
        }} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Approval Queue" description="Every outbound action lands here. You decide — the agent executes." mode={mode} onMode={onMode} />

      {error && (
        <div className="mb-4 rounded-lg border border-beacon/40 bg-beacon/10 px-4 py-2 font-mono text-xs text-beacon">⚠ {error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {pending.length === 0 && (
          <div className="rounded-xl border border-silver/20 border-dashed p-8 text-center text-sm text-muted-foreground lg:col-span-2">
            Queue clear ✦ nothing awaiting human approval.
          </div>
        )}
        {pending.map((t) => (
          <ApprovalCard
            key={t.id}
            task={t}
            pending={busy === t.id && (busyKind === "approved" || busyKind === "rejected")}
            onDecision={decide}
          />
        ))}
        {pending.filter((t) => busy === t.id && busyKind === "executed").length > 0 && (
          <div className="rounded-xl border border-silver/20 bg-card p-6 text-center text-sm text-chrome lg:col-span-2">
            Executing task… the agent is firing the downstream tool. Trace will appear in Telemetry.
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Resolved History</h2>
          <div className="overflow-hidden rounded-xl border border-silver/20">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 font-mono uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Task</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">Replay</th>
                </tr>
              </thead>
              <tbody className="bg-card">
                {resolved.slice(0, 25).map((t) => (
                  <tr key={t.id} className="border-t border-silver/10">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{t.id}</td>
                    <td className="px-3 py-2">{t.action}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={t.status} />
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground">{t.operator_note || "—"}</td>
                    <td className="px-3 py-2">
                      {t.status === "approved" && (
                        <button
                          onClick={() => void handleExecute(t.id)}
                          disabled={busy === t.id}
                          className="rounded-md bg-ember px-2 py-1 font-semibold text-chrome transition hover:bg-ember/85 disabled:opacity-50 cursor-pointer"
                        >
                          ▶ Execute
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return { raw: s }; }
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "bg-emerald-500/10 text-emerald-400",
    rejected: "bg-beacon/10 text-beacon",
    executed: "bg-ember/10 text-ember",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${styles[status] ?? "bg-silver/10 text-silver"}`}>
      {status}
    </span>
  );
}