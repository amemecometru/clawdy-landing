import * as React from "react";
import { cn } from "@/lib/utils";

export interface TelemetryEvent {
  ts: number;
  level: "info" | "agent" | "approval" | "error";
  message: string;
}

const LEVEL_COLOR: Record<TelemetryEvent["level"], string> = {
  info: "text-silver",
  agent: "text-ember",
  approval: "text-emerald-400",
  error: "text-beacon",
};

const LEVEL_TAG: Record<TelemetryEvent["level"], string> = {
  info: "INFO",
  agent: "AGENT",
  approval: "HITL",
  error: "ERROR",
};

/**
 * Live telemetry ticker. Scrolls agent loops, execution status, and task
 * telemetry. Falls back to local polling when WebSocket isn't live yet.
 */
export function TelemetryStream({
  events,
  className,
}: {
  events: TelemetryEvent[];
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const autoScroll = React.useRef(true);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    autoScroll.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 12;
  }

  React.useEffect(() => {
    if (autoScroll.current && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [events]);

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className={cn(
        "h-full overflow-y-auto rounded-lg border border-silver/20 bg-obsidian/80 p-3 font-mono text-xs leading-relaxed",
        className
      )}
    >
      {events.map((e, i) => (
        <div key={i} className="flex gap-2 whitespace-nowrap">
          <span className="shrink-0 text-muted-foreground">
            {new Date(e.ts).toISOString().slice(11, 19)}
          </span>
          <span className={cn("shrink-0", LEVEL_COLOR[e.level])}>
            [{LEVEL_TAG[e.level]}]
          </span>
          <span className="text-porcelain/90">{e.message}</span>
        </div>
      ))}
      <div className="mt-2 animate-pulse text-emerald-400">▊ awaiting next loop tick…</div>
    </div>
  );
}