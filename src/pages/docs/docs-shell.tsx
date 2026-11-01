"use client";

import * as React from "react";
import { SiteHeader } from "@/components/site-header";
import { DOCS_PAGES } from "@/pages/docs/docs-nav";

export function DocsShell({ activeSlug, children }: { activeSlug: string | null; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-obsidian text-porcelain">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-60 left-1/2 h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-ember/10 blur-[150px]" />
        <div className="absolute -right-40 bottom-10 h-[380px] w-[380px] rounded-full bg-rust/18 blur-[140px]" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,88,38,0.08),transparent_60%)]" />

      <SiteHeader />

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:flex-row lg:items-start lg:gap-10 md:px-10">
        <aside className="w-full lg:w-72 lg:shrink-0">
          <div className="rounded-2xl border border-silver/30 bg-card/80 backdrop-blur-xl">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-4 font-mono text-xs uppercase tracking-widest text-porcelain/80 lg:hidden"
            >
              <span>Documentation</span>
              <span className="text-ember">{mobileOpen ? "—" : "+"}</span>
            </button>
            <nav className={`flex-col gap-1 px-3 pb-4 ${mobileOpen ? "flex" : "hidden"} lg:flex`}>
              <a
                href="/docs"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeSlug === null ? "bg-rust/30 text-porcelain" : "text-porcelain/70 hover:bg-muted/30 hover:text-porcelain"
                }`}
              >
                <span className="grid size-7 place-items-center rounded-md bg-rust/40 font-mono text-xs">#</span>
                <span>Overview</span>
              </a>
              {DOCS_PAGES.map((p) => (
                <a
                  key={p.slug}
                  href={`/docs/${p.slug}`}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeSlug === p.slug ? "bg-rust/30 text-porcelain" : "text-porcelain/70 hover:bg-muted/30 hover:text-porcelain"
                  }`}
                >
                  <span className="grid size-7 place-items-center rounded-md bg-muted/40 font-mono text-xs">{p.icon}</span>
                  <span>{p.title}</span>
                </a>
              ))}
              <div className="mt-3 border-t border-silver/20 pt-3">
                <a href="/studio" className="block px-3 py-1.5 text-xs text-porcelain/60 transition-colors hover:text-ember">
                  Open Studio →
                </a>
                <a href="/mcp/v1/manifest.json" className="block px-3 py-1.5 text-xs text-porcelain/60 transition-colors hover:text-ember">
                  MCP Manifest →
                </a>
              </div>
            </nav>
          </div>
        </aside>

        <div className="w-full min-w-0 flex-1">{children}</div>
      </main>
    </div>
  );
}
