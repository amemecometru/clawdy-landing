import * as React from "react";
import { SectionHeader, RawJson } from "@/components/studio/section-header";

/**
 * CLI — one-command access to the worker from a terminal. The operator sees
 * install + cheat-sheet; agents see the raw HTTP surface the CLI wraps.
 */
export function CliPage({ mode, onMode }: { mode: "operator" | "agent"; onMode: (m: "operator" | "agent") => void }) {
  const [copied, setCopied] = React.useState<string | null>(null);
  const base = "https://clawdyclaw.logiclemonai.workers.dev";

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const blocks: Array<{ id: string; label: string; code: string; comment?: string }> = [
    {
      id: "install",
      label: "Install",
      code: `npm i -g clawdyclaw-cli   # or run in-repo: node cli/clawdy.mjs`,
      comment: "zero-dependency · Node ≥ 18",
    },
    {
      id: "env",
      label: "Point at your worker",
      code: `export CLAWDYCLAW_BASE_URL=${base}`,
      comment: "defaults to the live edge worker already",
    },
    {
      id: "status",
      label: "Health",
      code: `clawdy status`,
    },
    {
      id: "models",
      label: "Model registry",
      code: `clawdy models`,
    },
    {
      id: "tasks",
      label: "Approval queue",
      code: `clawdy tasks pending`,
    },
    {
      id: "telemetry",
      label: "Execution feed",
      code: `clawdy telemetry`,
    },
    {
      id: "widgets",
      label: "Dashboard widgets",
      code: `clawdy widgets`,
    },
    {
      id: "feed",
      label: "Live feed stream",
      code: `clawdy feed medium  # youtube | medium | substack | hackernoon`,
    },
    {
      id: "webhook",
      label: "Push a payload into the economy",
      code: `clawdy webhook github '{"event":"star","repo":"amemecometru/clawdyclaw-landing"}'`,
    },
    {
      id: "simulate",
      label: "Dry-run sandbox trace",
      code: `clawdy simulate '{"document":{"text":"Urgent: reset the staging API key"}}'`,
    },
    {
      id: "auth",
      label: "OAuth connect URLs",
      code: `clawdy auth`,
    },
  ];

  const agentState = {
    source: "cli/clawdy.mjs",
    runtime: "node >= 18, global fetch",
    config: {
      CLAWDYCLAW_BASE_URL: base,
      CLAWDYCLAW_TOKEN: "optional bearer for protected commands",
    },
    routes_wrapped: [
      "GET  /api/health",
      "GET  /api/v1/tasks?status=",
      "GET  /api/v1/telemetry",
      "GET  /api/v1/models",
      "GET  /api/v1/integrations",
      "GET  /api/v1/portal/widgets",
      "GET  /api/v1/feeds/:platform",
      "POST /api/v1/webhook/ingress",
      "POST /api/v1/sandbox/simulate",
    ],
  };

  return (
    <div>
      <SectionHeader
        title="CLI"
        description="Drive the edge worker from your terminal — one command per workflow."
        mode={mode}
        onMode={onMode}
      />

      {mode === "operator" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-silver/25 bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-rust font-mono text-sm font-bold text-chrome">›_</span>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Reference</h2>
            </div>
            <div className="space-y-2.5">
              {blocks.map((b) => (
                <div key={b.id} className="group">
                  <div className="mb-0.5 flex items-baseline justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-porcelain/70">{b.label}</span>
                    <button
                      onClick={() => copy(b.code, b.id)}
                      className="font-mono text-[10px] text-muted-foreground transition hover:text-ember cursor-pointer"
                    >
                      {copied === b.id ? "copied ✓" : "copy"}
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg border border-silver/20 bg-obsidian px-3 py-2 font-mono text-[11px] leading-relaxed text-emerald-300">{b.code}</pre>
                  {b.comment && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground"># {b.comment}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-silver/25 bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Where does this live?
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The <span className="font-mono text-porcelain">clawdy</span> bin ships in this repo at{" "}
                <span className="font-mono text-ember">cli/clawdy.mjs</span> — zero dependencies, just global
                <span className="font-mono text-porcelain"> fetch</span>. It talks straight to the deployed
                edge worker, no local server required.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Wrap it in a <span className="font-mono text-porcelain">.env</span>{" "}
                <span className="font-mono text-ember">CLAWDYCLAW_TOKEN</span> when you want protected
                commands to resolve the same identity your Studio session holds.
              </p>
            </div>

            <div className="rounded-xl border border-silver/25 bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Try it</h2>
              <pre className="overflow-x-auto rounded-lg border border-ember/30 bg-obsidian px-3 py-2 font-mono text-[11px] leading-relaxed text-porcelain">
{`$ node cli/clawdy.mjs status
● worker ok · clawdyclaw.logiclemonai.workers.dev · 2026-09-10T…

$ node cli/clawdy.mjs models
inference backbone: worker-edge · providers bound 8`}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <RawJson data={agentState} />
      )}
    </div>
  );
}