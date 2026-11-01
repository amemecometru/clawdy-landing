"use client";

import * as React from "react";
import { DocsShell } from "@/pages/docs/docs-shell";
import { BASE, PREVIEW, DOC_COMMANDS, DOCS_PAGES, type DocsRoute } from "@/pages/docs/docs-nav";
import { RawJson } from "@/components/studio/section-header";

function copy(text: string, setCopied: (k: string | null) => void, key: string) {
  void navigator.clipboard.writeText(text);
  setCopied(key);
  setTimeout(() => setCopied(null), 1500);
}

function CliReferenceDoc() {
  const [copied, setCopied] = React.useState<string | null>(null);
  const agentState = {
    source: "cli/clawdy.mjs",
    runtime: "node >= 18, global fetch",
    config: {
      CLAWDYCLAW_BASE_URL: BASE,
      CLAWDYCLAW_TOKEN: "optional bearer for protected commands",
    },
    routes_wrapped: DOC_COMMANDS.filter((c) => c.path).map((c) => `${c.method || "GET"} ${c.path}`),
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-ember">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-beacon opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-beacon" />
          </span>
          CLI Reference
        </div>
        <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-porcelain md:text-5xl">
          Drive the edge worker from your <span className="text-ember">terminal</span>.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-porcelain/70">
          Zero dependencies, Node ≥ 18. Points to the worker by default; override with <span className="font-mono text-porcelain">CLAWDYCLAW_BASE_URL</span>.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-silver/30 bg-card/80 p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-rust font-mono text-sm font-bold text-chrome">›_</span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Reference</h2>
          </div>
          <div className="space-y-3">
            {DOC_COMMANDS.map((b, i) => (
              <div key={`${b.label}-${i}`} className="group">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-porcelain/70">{b.label}</span>
                  <button
                    onClick={() => copy(b.code, setCopied, `${b.label}-${i}`)}
                    className="font-mono text-[10px] text-muted-foreground transition hover:text-ember cursor-pointer"
                  >
                    {copied === `${b.label}-${i}` ? "copied ✓" : "copy"}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-xl border border-silver/20 bg-obsidian px-4 py-3 font-mono text-[11px] leading-relaxed text-emerald-300">{b.code}</pre>
                {b.comment && <div className="mt-1 font-mono text-[10px] text-muted-foreground"># {b.comment}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-silver/30 bg-card/80 p-6 backdrop-blur-xl">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Where does this live?</h2>
            <p className="text-sm leading-relaxed text-porcelain/70">
              The <span className="font-mono text-porcelain">clawdy</span> bin ships in this repo at{" "}
              <span className="font-mono text-ember">cli/clawdy.mjs</span> — zero dependencies, global <span className="font-mono text-porcelain">fetch</span>. Defaults to{" "}
              <span className="font-mono text-ember">{BASE}</span> (with <span className="font-mono text-porcelain">{PREVIEW}</span> available as a CF preview). Route via custom domains under <span className="font-mono text-porcelain">clawdyclaw.com</span> in production.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-porcelain/70">
              npm package <span className="font-mono text-porcelain">clawdyclaw-cli</span> is publish-pending approval; for now run from a repo clone or fetch the raw script.
            </p>
          </div>

          <div className="rounded-2xl border border-silver/30 bg-card/80 p-6 backdrop-blur-xl">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Agent surface</h2>
            <RawJson data={agentState} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DocsLanding() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-ember">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-beacon opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-beacon" />
          </span>
          Documentation
        </div>
        <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-porcelain md:text-5xl">
          Build, route, and ship with <span className="text-ember">ClawdyClaw</span>.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-porcelain/70">
          Operator docs for the agentic economy: CLI access, MCP manifest, and the collaborative studio built for agents and humans working together as revenue-generating partners.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DOCS_PAGES.map((p) => (
          <a key={p.slug} href={`/docs/${p.slug}`} className="group rounded-2xl border border-silver/30 bg-card/80 p-6 transition-colors hover:border-ember/50 hover:bg-card backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-lg bg-rust font-mono text-sm text-chrome">{p.icon}</span>
              <h2 className="text-lg font-semibold text-porcelain">{p.title}</h2>
            </div>
            <p className="text-sm leading-relaxed text-porcelain/70">{p.description}</p>
            <div className="mt-4 font-mono text-xs uppercase tracking-widest text-ember/80 group-hover:text-ember">Read more →</div>
          </a>
        ))}
        <a href="/mcp/v1/manifest.json" className="group rounded-2xl border border-silver/30 bg-card/80 p-6 transition-colors hover:border-ember/50 hover:bg-card backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-muted/40 font-mono text-sm">M</span>
            <h2 className="text-lg font-semibold text-porcelain">MCP Manifest</h2>
          </div>
          <p className="text-sm leading-relaxed text-porcelain/70">Discover and mount MCP capability bundles for agent tools.</p>
          <div className="mt-4 font-mono text-xs uppercase tracking-widest text-ember/80 group-hover:text-ember">Open manifest →</div>
        </a>
        <a href="/studio" className="group rounded-2xl border border-silver/30 bg-card/80 p-6 transition-colors hover:border-ember/50 hover:bg-card backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-muted/40 font-mono text-sm">◎</span>
            <h2 className="text-lg font-semibold text-porcelain">Studio</h2>
          </div>
          <p className="text-sm leading-relaxed text-porcelain/70">Collaborative workspace for agents and humans to build, qualify, and ship revenue-generating work.</p>
          <div className="mt-4 font-mono text-xs uppercase tracking-widest text-ember/80 group-hover:text-ember">Launch studio →</div>
        </a>
      </div>
    </div>
  );
}

export function DocsPage({ route }: { route: DocsRoute }) {
  if (route.kind === "landing") {
    return (
      <DocsShell activeSlug={null}>
        <DocsLanding />
      </DocsShell>
    );
  }
  if (route.kind === "page" && route.slug === "cli-reference") {
    return (
      <DocsShell activeSlug="cli-reference">
        <CliReferenceDoc />
      </DocsShell>
    );
  }
  if (route.kind === "page") {
    return (
      <DocsShell activeSlug={route.slug}>
        <div className="rounded-2xl border border-silver/30 bg-card/80 p-6">
          <h1 className="text-2xl font-bold text-porcelain">Page coming soon</h1>
          <p className="mt-2 text-porcelain/70">This docs page is not yet implemented.</p>
          <a href="/docs" className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-ember">← Back to docs</a>
        </div>
      </DocsShell>
    );
  }
  return null;
}
