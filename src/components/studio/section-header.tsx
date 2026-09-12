import * as React from "react";

/** Shared section header with the dual-mode toggle. */
export function SectionHeader({
  title,
  description,
  mode,
  onMode,
}: {
  title: string;
  description: string;
  mode: "operator" | "agent";
  onMode: (m: "operator" | "agent") => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-xl">
        <h1 className="text-xl font-bold tracking-tight text-porcelain">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="inline-flex items-center gap-1 rounded-lg border border-silver/30 bg-muted/40 p-1">
        <ModeBtn active={mode === "operator"} onClick={() => onMode("operator")}>👤 Human Operator</ModeBtn>
        <ModeBtn active={mode === "agent"} onClick={() => onMode("agent")}>{"</>"} Agent MCP Schema</ModeBtn>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-ember px-3 py-1.5 text-sm font-medium text-chrome shadow shadow-ember/30 cursor-pointer"
          : "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-porcelain cursor-pointer"
      }
    >
      {children}
    </button>
  );
}

/** Pretty JSON block for MCP view. */
export function RawJson({ data, className }: { data: unknown; className?: string }) {
  return (
    <pre
      className={
        "overflow-x-auto rounded-xl border border-silver/25 bg-obsidian/80 p-4 font-mono text-xs leading-relaxed text-emerald-300 " +
        (className ?? "")
      }
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}