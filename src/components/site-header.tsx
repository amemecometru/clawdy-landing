"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bot, ChevronDown, Cpu, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

type DropItem = {
  label: string;
  href: string;
  tag?: string;
  desc: string;
};

type DropGroup = {
  id: string;
  label: string;
  groups: Array<{ heading: string; items: DropItem[] }>;
};

const DROPDOWNS: DropGroup[] = [
  {
    id: "models",
    label: "Models",
    groups: [
      {
        heading: "Frontier",
        items: [
          { label: "Claude", href: "/studio/models?view=agent", tag: "opus", desc: "Agentic reasoning from Anthropic, routed through the edge." },
          { label: "Gemini", href: "/studio/models?view=agent", tag: "flash", desc: "Google's multimodal models running behind your vault key." },
          { label: "Grok", href: "/studio/models?view=agent", tag: "beta", desc: "The open-latitude reasoning model family, two-way." },
        ],
      },
      {
        heading: "OpenWeights",
        items: [
          { label: "Hugging Face", href: "/studio/models?view=agent", tag: "hf", desc: "Pin any open-weights model and call it as an MCP tool." },
          { label: "openWeights registry", href: "/studio/models?view=agent", desc: "Your own registry of pinned, self-hostable checkpoints." },
          { label: "FLUX imaging", href: "/studio/models?view=agent", tag: "flux", desc: "Diffusion image generation over your Cloudflare Cloud." },
        ],
      },
    ],
  },
  {
    id: "product",
    label: "Product",
    groups: [
      {
        heading: "Core",
        items: [
          { label: "Agents", href: "/studio", tag: "hub", desc: "Fleet orchestration, approval gates, and model routing." },
          { label: "Cloud", href: "/studio/models?view=agent", tag: "edge", desc: "Worker-edge inference bound to your Cloudflare account." },
          { label: "Operate", href: "/studio", desc: "The human side of the economy — approve and steer." },
        ],
      },
      {
        heading: "Surface",
        items: [
          { label: "Mobile", href: "/login", desc: "Receive approval pings and stream telemetry anywhere." },
          { label: "Automations", href: "/studio/vault", desc: "Scheduled, event-driven agent runs and webhook pipelines." },
          { label: "CLI", href: "/studio/cli", desc: "Drive the worker from a terminal — zero dependencies." },
          { label: "Marketplace", href: "/mcp/v1/manifest.json", tag: "mcp*", desc: "Discover and mount MCP capability bundles." },
        ],
      },
    ],
  },
];

const SIMPLE = [
  { label: "Resources", href: "/login?tab=docs" },
  { label: "Sandbox", href: "/studio/sandbox" },
  { label: "Studio", href: "/studio" },
  { label: "Pricing", href: "/login?tab=pricing" },
];

/**
 * Public site header — shared across hero and auth pages.
 * Models + Product are data-driven dropdown menus (desktop hover/click +
 * keyboard accessible, mobile accordion below).
 */
export function SiteHeader() {
  const [openDrop, setOpenDrop] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const timeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeAfter = (ms = 160) => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setOpenDrop(null), ms);
  };

  React.useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);

  return (
    <header className="relative z-40">
      <nav className="relative z-20 flex items-center justify-between px-6 py-5 md:px-10" aria-label="Primary">
        <a href="/" className="flex items-center gap-3" onClick={() => { setOpenDrop(null); setMobileOpen(false); }}>
          <span className="grid size-9 place-items-center rounded-lg bg-rust font-mono text-lg font-black text-porcelain shadow-lg">
            {"{"}
            <Cpu className="ml-0.5 size-4 text-ember" />
          </span>
          <span className="font-mono text-sm font-bold tracking-tight text-porcelain">
            clawdyclaw<span className="text-ember">.com</span>
          </span>
        </a>

        {/* Desktop menus */}
        <div className="hidden items-center gap-1 font-mono text-xs uppercase tracking-widest text-porcelain/70 lg:flex">
          {DROPDOWNS.map((dd) => {
            const open = openDrop === dd.id;
            return (
              <div
                key={dd.id}
                className="relative"
                onMouseEnter={() => { if (timeout.current) clearTimeout(timeout.current); setOpenDrop(dd.id); }}
                onMouseLeave={() => closeAfter()}
              >
                <button
                  onClick={() => setOpenDrop(open ? null : dd.id)}
                  onFocus={() => setOpenDrop(dd.id)}
                  onBlur={() => closeAfter()}
                  aria-expanded={open}
                  aria-haspopup="true"
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-2 transition-colors cursor-pointer",
                    open ? "text-ember" : "hover:text-ember"
                  )}
                >
                  {dd.label}
                  <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
                </button>
              </div>
            );
          })}

          {SIMPLE.map((s) => (
            <a key={s.label} href={s.href} className="rounded-md px-3 py-2 transition-colors hover:text-ember">
              {s.label}
            </a>
          ))}

          <div className="mx-2 h-5 w-px bg-silver/30" />
          <a href="/login" className="rounded-md px-3 py-2 transition-colors hover:text-ember">Sign In</a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/login"
            className={cn(
              "hidden items-center gap-2 rounded-md border border-ember/40 font-mono text-xs font-semibold",
              "bg-rust px-4 py-2 text-chrome transition hover:bg-ember sm:inline-flex"
            )}
          >
            <Bot className="size-4" /> Open Console
          </a>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            className="grid size-10 place-items-center rounded-md border border-silver/30 text-porcelain lg:hidden cursor-pointer"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* Dropdown panels */}
        <AnimatePresence>
          {DROPDOWNS.map((dd) =>
            openDrop === dd.id ? (
              <motion.div
                key={dd.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.16 }}
                onMouseEnter={() => { if (timeout.current) clearTimeout(timeout.current); setOpenDrop(dd.id); }}
                onMouseLeave={() => closeAfter()}
                className="absolute left-1/2 top-[calc(100%-14px)] hidden max-w-3xl -translate-x-1/2 rounded-2xl border border-silver/40 bg-obsidian/95 p-6 shadow-2xl shadow-black/60 backdrop-blur-xl lg:grid"
              >
                <div className={cn("grid gap-8", dd.groups.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                  {dd.groups.map((g) => (
                    <div key={g.heading}>
                      <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-ember">{g.heading}</div>
                      <div className="space-y-1">
                        {g.items.map((item) => (
                          <a
                            key={item.label}
                            href={item.href}
                            className="group flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/30"
                          >
                            <span className="mt-1 size-1 shrink-0 rounded-full bg-ember/70" />
                            <span>
                              <span className="flex items-center gap-2 text-[13px] font-medium text-porcelain group-hover:text-porcelain">
                                {item.label}
                                {item.tag && (
                                  <span className="rounded-sm bg-ember/20 px-1.5 font-mono text-[9px] uppercase tracking-wider text-ember">{item.tag}</span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{item.desc}</span>
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : null
          )}
        </AnimatePresence>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-y border-silver/20 bg-obsidian/95 backdrop-blur-xl lg:hidden"
          >
            <div className="space-y-4 px-6 py-6">
              {DROPDOWNS.map((dd) => (
                <MobileDrop key={dd.id} dd={dd} />
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2">
                {SIMPLE.map((s) => (
                  <a key={s.label} href={s.href} className="rounded-md border border-silver/25 px-3 py-2.5 text-center text-xs uppercase tracking-widest text-porcelain/80" onClick={() => setMobileOpen(false)}>
                    {s.label}
                  </a>
                ))}
              </div>
              <div className="pt-2">
                <a
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-md bg-rust px-4 py-3 font-mono text-sm font-semibold text-chrome transition hover:bg-ember"
                >
                  Sign In <ArrowRight className="size-4" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function MobileDrop({ dd }: { dd: DropGroup }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-b border-silver/15 pb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-1 text-sm uppercase tracking-widest text-porcelain cursor-pointer"
      >
        {dd.label}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-1 mt-2 space-y-3">
          {dd.groups.map((g) => (
            <div key={g.heading}>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ember">{g.heading}</div>
              {g.items.map((item) => (
                <a key={item.label} href={item.href} onClick={() => setOpen(false)} className="block py-1.5 text-sm text-porcelain/80 transition-colors hover:text-ember">
                  {item.label}{item.tag ? <span className="ml-2 font-mono text-[9px] text-ember">{item.tag}</span> : null}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}