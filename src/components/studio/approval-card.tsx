import * as React from "react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/api";

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-beacon/15 text-beacon border-beacon/40",
  high: "bg-ember/15 text-ember border-ember/40",
  normal: "bg-silver/10 text-silver border-silver/40",
  low: "bg-muted/20 text-muted-foreground border-silver/20",
};

const SOURCE_LABEL: Record<string, string> = {
  facebook_ads: "Facebook Lead Ad",
  gmail: "Gmail Webhook",
  scraper: "Marketplace Scraper",
  manual: "Manual Entry",
};

function parsePayload(task: Task): {
  client_name: string | null;
  contact: string | null;
  intent: string;
  estimated_value: number | null;
  source_url: string | null;
} {
  try {
    const p = JSON.parse(task.payload);
    return {
      client_name: p.client_name ?? "Unknown",
      contact: p.contact ?? null,
      intent: p.intent ?? "",
      estimated_value: p.estimated_value ?? null,
      source_url: p.source_url ?? null,
    };
  } catch {
    return { client_name: "Unknown", contact: null, intent: "", estimated_value: null, source_url: null };
  }
}

/**
 * Interactive HITL approval card.
 * Shows inline payload diff, an action countdown timer, and
 * Approve (green) / Reject (red) micro-interactions tied to the API.
 */
export function ApprovalCard({
  task,
  onDecision,
  pending,
}: {
  task: Task;
  onDecision: (decision: "approved" | "rejected", id: string, note?: string) => void;
  pending: boolean;
}) {
  const p = parsePayload(task);
  const [note, setNote] = React.useState("");
  const ageSec = Math.max(0, Math.floor(Date.now() / 1000 - task.created_at));

  return (
    <div className="rounded-xl border border-silver/25 bg-card p-4 transition hover:border-ember/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.normal
              )}
            >
              {task.priority}
            </span>
            <span className="rounded-full border border-silver/20 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
              {SOURCE_LABEL[task.source] ?? task.source}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-base font-semibold text-foreground">
            {p.client_name}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-xs tabular-nums text-ember">
            ⏱ {ageSec}s ago
          </div>
          <div className="mt-0.5 rounded bg-silver/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {task.action}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-silver/20 bg-obsidian/60 p-3 font-mono text-xs leading-relaxed">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-porcelain/80">
          {p.contact && (
            <span>
              <span className="text-muted-foreground">contact: </span>
              {p.contact}
            </span>
          )}
          {p.estimated_value != null && (
            <span>
              <span className="text-muted-foreground">value: </span>
              <span className="text-beacon">${Number(p.estimated_value).toFixed(2)}</span>
            </span>
          )}
          {p.source_url && (
            <span className="truncate">
              <span className="text-muted-foreground">src: </span>
              <a href={p.source_url} target="_blank" rel="noreferrer" className="text-ember hover:underline">
                {p.source_url}
              </a>
            </span>
          )}
        </div>
        {p.intent && (
          <div className="mt-2 text-porcelain">
            <span className="text-muted-foreground">intent: </span>
            <span className="text-chrome">"{p.intent}"</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Operator note (optional)"
          className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={() => onDecision("approved", task.id, note || undefined)}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
        >
          ✓ Approve
        </button>
        <button
          disabled={pending}
          onClick={() => onDecision("rejected", task.id, note || undefined)}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-beacon text-sm font-semibold text-white transition hover:bg-beacon/85 disabled:opacity-50 cursor-pointer"
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}