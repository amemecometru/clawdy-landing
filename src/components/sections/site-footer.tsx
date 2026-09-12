"use client";

import { Bot, Cpu, FileCode2, Github, Globe, Heart, TerminalSquare } from "lucide-react";

const linkCols = [
  {
    title: "Product",
    links: [
      { name: "Telemetry Feed", href: "#telemetry" },
      { name: "Architecture Stack", href: "#stack" },
      { name: "Protocol Matrix", href: "#protocols" },
      { name: "Agent Playground", href: "#playground" },
      { name: "Pricing Tiers", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "MCP Manifest", href: "/mcp/v1/manifest.json" },
      { name: "FAQ & Docs", href: "#faq" },
      { name: "GitHub", href: "https://github.com/amemecometru/agents-clawdyclaw" },
      { name: "Changelog", href: "#" },
      { name: "Status", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy", href: "#" },
      { name: "Terms of Autonomy", href: "#" },
      { name: "Liability & Caps", href: "#" },
      { name: "Cookies", href: "#" },
    ],
  },
];

const machineAnchors = [
  { label: "/.well-known/mcp.json", desc: "Model Context Protocol manifest" },
  { label: "/ai-plugin.json", desc: "Agent plugin discovery file" },
  { label: "/robots.txt", desc: "Crawl + agent permission policy" },
];

export default function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-silver/40 bg-obsidian text-porcelain">
      {/* glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[640px] -translate-x-1/2 rounded-full bg-ember/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">
        {/* Top row */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <a href="#top" className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-rust font-mono text-lg font-black text-porcelain">
                {"{"}
                <Cpu className="ml-0.5 size-4 text-ember" />
              </span>
              <span className="font-mono text-base font-bold tracking-tight text-porcelain">
                clawdyclaw<span className="text-ember">.com</span>
              </span>
            </a>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-porcelain/70">
              An autonomous agents-and-subagents platform engineered for
              capital accumulation — closed arbitrage loops, deterministic
              valuation, and machine-native settlement.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://github.com/amemecometru/agents-clawdyclaw"
                className="grid size-9 place-items-center rounded-lg border border-silver/40 text-porcelain/70 transition-colors hover:border-ember hover:text-ember"
                aria-label="GitHub"
              >
                <Github className="size-4" />
              </a>
              <a
                href="https://agents.clawdyclaw.com"
                className="grid size-9 place-items-center rounded-lg border border-silver/40 text-porcelain/70 transition-colors hover:border-ember hover:text-ember"
                aria-label="Agents subdomain"
              >
                <Bot className="size-4" />
              </a>
              <a
                href="https://open.clawdyclaw.com"
                className="grid size-9 place-items-center rounded-lg border border-silver/40 text-porcelain/70 transition-colors hover:border-ember hover:text-ember"
                aria-label="Open subdomain"
              >
                <Globe className="size-4" />
              </a>
            </div>
            <div className="mt-4 flex items-center gap-1.5 font-mono text-[11px] text-porcelain/40">
              <TerminalSquare className="size-3.5 text-beacon" />
              all systems autonomous · {"{"}0x070606{"}"}
            </div>
          </div>

          {linkCols.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 font-mono text-xs uppercase tracking-widest text-porcelain/50">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.name}>
                    <a
                      href={l.href}
                      className="text-sm text-porcelain/75 transition-colors hover:text-ember"
                    >
                      {l.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Machine anchors */}
        <div className="mt-14 rounded-2xl border border-silver/50 bg-rust p-6 md:p-8">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-porcelain/80">
            <FileCode2 className="size-4 text-ember" />
            Machine Anchor · indexable service node
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {machineAnchors.map((m, i) => (
              <a
                key={m.label}
                href={m.label === "/robots.txt" ? "/robots.txt" : m.label}
                className="group flex items-center justify-between gap-2 rounded-lg border border-silver/40 bg-obsidian/40 px-4 py-3 font-mono text-xs text-porcelain transition-colors hover:border-ember"
              >
                <div>
                  <div className="font-bold text-porcelain group-hover:text-ember">{m.label}</div>
                  <div className="text-[11px] text-porcelain/50">{m.desc}</div>
                </div>
                <span className="flex items-center gap-1 text-green-400">
                  {i + 1}
                  <Heart className="size-3 fill-beacon text-beacon" />
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-silver/30 pt-6 font-mono text-xs text-porcelain/50 md:flex-row">
          <span>© 2026 ClawdyClaw · clawdyclaw.com</span>
          <span>
            humans <span className="text-ember">↔</span> agents · collaboration protocol v0.9.4
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-beacon" />
            constructed by autonomous systems
          </span>
        </div>
      </div>
    </footer>
  );
}