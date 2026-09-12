import * as React from "react";
import { cn } from "@/lib/utils";

export type ViewMode = "operator" | "agent";

/**
 * Dual-view state toggle — switches between the Human Operator view
 * and the Agent MCP JSON Schema view.
 */
export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-silver/30 bg-muted/40 p-1">
      <ModeButton
        active={mode === "operator"}
        onClick={() => onChange("operator")}
      >
        <span className="flex size-5 items-center justify-center">👤</span>
        Human Operator
      </ModeButton>
      <ModeButton
        active={mode === "agent"}
        onClick={() => onChange("agent")}
      >
        <span className="flex size-5 items-center justify-center font-mono text-xs">{"</>"}</span>
        Agent MCP Schema
      </ModeButton>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition cursor-pointer",
        active
          ? "bg-ember text-chrome shadow shadow-ember/30"
          : "text-muted-foreground hover:bg-muted/60 hover:text-porcelain"
      )}
    >
      {children}
    </button>
  );
}