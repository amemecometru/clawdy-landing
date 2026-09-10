import * as React from "react";
import { StudioShell } from "@/components/studio/studio-shell";
import { CommandCenter } from "@/pages/studio/command-center";
import { ApprovalQueue } from "@/pages/studio/approval-queue";
import { TelemetryPage } from "@/pages/studio/telemetry-page";
import { ToolRegistry } from "@/pages/studio/tool-registry";
import { ModelsPage } from "@/pages/studio/models-page";
import { SandboxPage } from "@/pages/studio/sandbox-page";
import { VaultPage } from "@/pages/studio/vault-page";
import { CliPage } from "@/pages/studio/cli-page";

type Section = "command" | "queue" | "telemetry" | "tools" | "models" | "sandbox" | "vault" | "cli";

const NAV: Array<{ path: Section; label: string; icon: string; badge?: string }> = [
  { path: "command", label: "Command Center", icon: "◈" },
  { path: "queue", label: "Approval Queue", icon: "⚑", badge: "HITL" },
  { path: "telemetry", label: "Telemetry", icon: "⇄" },
  { path: "tools", label: "Tool Registry", icon: "⚒" },
  { path: "models", label: "Models", icon: "✦" },
  { path: "sandbox", label: "Sandbox", icon: "◪" },
  { path: "vault", label: "API Vault", icon: "🔑" },
  { path: "cli", label: "CLI", icon: "›_" },
];

const REAL_PATH: Record<Section, string> = {
  command: "/studio",
  queue: "/studio/queue",
  telemetry: "/studio/telemetry",
  tools: "/studio/tools",
  models: "/studio/models",
  sandbox: "/studio/sandbox",
  vault: "/studio/vault",
  cli: "/studio/cli",
};

function fromSearchPath(pathname: string): Section {
  if (pathname.startsWith("/studio/queue")) return "queue";
  if (pathname.startsWith("/studio/telemetry")) return "telemetry";
  if (pathname.startsWith("/studio/tools")) return "tools";
  if (pathname.startsWith("/studio/models")) return "models";
  if (pathname.startsWith("/studio/sandbox")) return "sandbox";
  if (pathname.startsWith("/studio/vault")) return "vault";
  if (pathname.startsWith("/studio/cli")) return "cli";
  return "command";
}

function viewParam(): "operator" | "agent" | null {
  const m = /[?&]view=(operator|agent)/.exec(window.location.search);
  return m ? (m[1] as "operator" | "agent") : null;
}

/**
 * Central Station — the routed Studio workspace.
 * Eight sections, each dual-mode: Human Operator vs Agent MCP Schema.
 * The side rail carries the [+ WidgetFeed] mount action for the dashboard grid.
 */
export default function StudioPage() {
  const [section, setSection] = React.useState<Section>(() => fromSearchPath(window.location.pathname));
  const [mode, setMode] = React.useState<"operator" | "agent">(() => viewParam() ?? "operator");

  React.useEffect(() => {
    const sync = () => {
      setSection(fromSearchPath(window.location.pathname));
      const v = viewParam();
      if (v) setMode(v);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const goto = (path: string) => {
    window.location.href = path + (mode === "agent" ? "?view=agent" : "");
  };

  return (
    <StudioShell
      nav={NAV.map((n) => ({ ...n, path: REAL_PATH[n.path] }))}
      activePath={REAL_PATH[section]}
      onNavigate={goto}
      widgetFeedAction={() => goto("/studio?widgetfeed=1")}
      className="bg-obsidian text-porcelain"
    >
      {section === "queue" && <ApprovalQueue mode={mode} onMode={setMode} />}
      {section === "telemetry" && <TelemetryPage mode={mode} onMode={setMode} />}
      {section === "tools" && <ToolRegistry mode={mode} onMode={setMode} />}
      {section === "models" && <ModelsPage mode={mode} onMode={setMode} />}
      {section === "sandbox" && <SandboxPage mode={mode} onMode={setMode} />}
      {section === "vault" && <VaultPage mode={mode} onMode={setMode} onNavigate={goto} />}
      {section === "cli" && <CliPage mode={mode} onMode={setMode} />}
      {section === "command" && <CommandCenter mode={mode} onMode={setMode} />}
    </StudioShell>
  );
}