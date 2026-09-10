import * as React from "react";
import { StudioShell } from "@/components/studio/studio-shell";
import { CommandCenter } from "@/pages/studio/command-center";
import { ApprovalQueue } from "@/pages/studio/approval-queue";
import { TelemetryPage } from "@/pages/studio/telemetry-page";
import { ToolRegistry } from "@/pages/studio/tool-registry";
import { SandboxPage } from "@/pages/studio/sandbox-page";
import { VaultPage } from "@/pages/studio/vault-page";

type Section = "command" | "queue" | "telemetry" | "tools" | "sandbox" | "vault";

const NAV: Array<{ path: Section; label: string; icon: string; badge?: string }> = [
  { path: "command", label: "Command Center", icon: "◈" },
  { path: "queue", label: "Approval Queue", icon: "⚑", badge: "HITL" },
  { path: "telemetry", label: "Telemetry", icon: "⇄" },
  { path: "tools", label: "Tool Registry", icon: "⚒" },
  { path: "sandbox", label: "Sandbox", icon: "◪" },
  { path: "vault", label: "API Vault", icon: "✦" },
];

const REAL_PATH: Record<Section, string> = {
  command: "/studio",
  queue: "/studio/queue",
  telemetry: "/studio/telemetry",
  tools: "/studio/tools",
  sandbox: "/studio/sandbox",
  vault: "/studio/vault",
};

function fromSearchPath(pathname: string): Section {
  if (pathname.startsWith("/studio/queue")) return "queue";
  if (pathname.startsWith("/studio/telemetry")) return "telemetry";
  if (pathname.startsWith("/studio/tools")) return "tools";
  if (pathname.startsWith("/studio/sandbox")) return "sandbox";
  if (pathname.startsWith("/studio/vault")) return "vault";
  return "command";
}

function viewParam(): "operator" | "agent" | null {
  const m = /[?&]view=(operator|agent)/.exec(window.location.search);
  return m ? (m[1] as "operator" | "agent") : null;
}

/**
 * Central Station — the routed Studio workspace.
 * Six sections, each dual-mode: Human Operator vs Agent MCP Schema.
 */
export default function StudioPage() {
  // Route by real URL pathname (full-page nav — no router dependency).
  const [section, setSection] = React.useState<Section>(() => fromSearchPath(window.location.pathname));
  const [mode, setMode] = React.useState<"operator" | "agent">(() => viewParam() ?? "operator");

  // Re-read the URL when the popstate fires (browser back/forward).
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
      className="bg-obsidian text-porcelain"
    >
      {section === "queue" && <ApprovalQueue mode={mode} onMode={setMode} />}
      {section === "telemetry" && <TelemetryPage mode={mode} onMode={setMode} />}
      {section === "tools" && <ToolRegistry mode={mode} onMode={setMode} />}
      {section === "sandbox" && <SandboxPage mode={mode} onMode={setMode} />}
      {section === "vault" && <VaultPage mode={mode} onMode={setMode} onNavigate={goto} />}
      {section === "command" && <CommandCenter mode={mode} onMode={setMode} />}
    </StudioShell>
  );
}