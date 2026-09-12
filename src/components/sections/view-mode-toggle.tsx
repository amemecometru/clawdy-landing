"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Braces,
  CheckCircle2,
  Eye,
  FileJson,
  Globe,
  Laptop,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionShell } from "@/components/ui/section-shell";

type ViewMode = "human" | "agent";

function SegmentedToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const options: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
    { value: "human", label: "Human", icon: <Eye className="size-3.5" /> },
    { value: "agent", label: "Agent / MCP", icon: <Braces className="size-3.5" /> },
  ];

  return (
    <div className="relative inline-flex items-center rounded-full border border-silver/60 bg-obsidian/80 p-1 font-mono text-xs">
      {options.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors cursor-pointer",
              active ? "text-obsidian" : "text-porcelain/60 hover:text-porcelain"
            )}
          >
            {active && (
              <motion.span
                layoutId="viewmode-pill"
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                className="absolute inset-0 -z-10 rounded-full bg-ember shadow-lg shadow-ember/30"
              />
            )}
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const manifest: { key: string; value: string }[] = [
  { key: '"name"', value: '"clawdyclaw-bridge"' },
  { key: '"version"', value: '"0.9.4"' },
  { key: '"protocol"', value: '"Model Context Protocol ≥2024-11-05"' },
  { key: '"severity"', value: '"autonomous"' },
];

const tools = [
  { name: "execute_arbitrage", desc: "Evaluate & close spread between two market feeds", status: "READY" },
  { name: "query_market_depth", desc: "Pull localized comps with deterministic scoring", status: "READY" },
  { name: "negotiate_agent", desc: "Agent-to-agent 402 negotiation endpoint", status: "READY" },
  { name: "rotate_proxy_pool", desc: "Anti-ban rate-limit rotation for harvesters", status: "READY" },
];

function HumanView() {
  return (
    <div className="grid gap-4 p-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Fleet Yield — 24h
          </span>
          <span className="flex items-center gap-1.5 font-mono text-xs text-green-600 dark:text-green-500">
            <span className="size-1.5 animate-pulse rounded-full bg-green-500" /> live
          </span>
        </div>
        <div className="flex h-32 items-end gap-2">
          {[38, 52, 44, 61, 49, 74, 58, 82, 66, 92, 71, 100].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              whileInView={{ height: `${h}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04, duration: 0.5, ease: "easeOut" }}
              className={cn(
                "flex-1 rounded-t-md",
                i % 3 === 0
                  ? "bg-rust"
                  : i % 3 === 1
                    ? "bg-ember"
                    : "bg-beacon/70"
              )}
            />
          ))}
        </div>
      </Card>
      <Card>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Yield composition
        </span>
        <div className="mt-4 space-y-4">
          {[
            { label: "Arbitrage loops", pct: 61, color: "bg-rust" },
            { label: "Micro-tasks", pct: 24, color: "bg-ember" },
            { label: "Data products", pct: 15, color: "bg-beacon" },
          ].map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex justify-between font-mono text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-bold">{r.pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${r.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={cn("h-full rounded-full", r.color)}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="md:col-span-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Approval queue
        </span>
        <div className="mt-4 space-y-3">
          {[
            { id: "TX-22931", note: "Purchase 2019 Makita circular saw — est. resale +41%", amount: "$63.00" },
            { id: "TX-22930", note: "402 invoice settlement — wallet#a2f9", amount: "$3.00" },
          ].map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-silver/50 bg-muted/40 p-3"
            >
              <div>
                <div className="font-mono text-xs font-bold">{t.id}</div>
                <div className="text-xs text-muted-foreground">{t.note}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold">{t.amount}</span>
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-500" />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Loop health
        </span>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid size-16 place-items-center rounded-full border-4 border-ember/30">
            <span className="font-mono text-lg font-black text-ember">98.2</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Closed loops
            <br />
            remaining on budget.
          </p>
        </div>
      </Card>
    </div>
  );
}

function AgentView() {
  return (
    <div className="grid gap-4 p-6 md:grid-cols-2">
      <div className="rounded-xl border border-silver/40 bg-obsidian p-5 font-mono text-xs leading-relaxed">
        <div className="mb-3 flex items-center gap-2 text-porcelain/50">
          <FileJson className="size-4" /> /mcp/v1/manifest.json
        </div>
        <pre className="whitespace-pre-wrap text-porcelain">
          <span className="text-porcelain/30">{"{"}</span>
          {"\n  "}
          {manifest.map((m, i) => (
            <span key={m.key} className="block pl-4 text-porcelain/60">
              <span className="text-ember">{m.key}</span>
              {": "}
              <span className="text-green-500">{m.value}</span>
              {i < manifest.length - 1 && ","}
            </span>
          ))}
          {"\n  "}
          <span className="text-porcelain/30">{"},"}</span>
          {"\n  "}
          <span className="text-porcelain/30">{'"tools": ['}</span>
          {tools.map((t) => (
            <span key={t.name} className="block pl-6 text-porcelain/60">
              <span className="text-beacon">{'"' + t.name + '"'}</span>
              {","}
            </span>
          ))}
          <span className="block pl-4 text-porcelain/30">{'"],'}</span>
          <span className="block pl-4 text-porcelain/30">{'"semantic": "@id: clawdyclaw/bridge#mcp"'}</span>
          <span className="text-porcelain/30">{"}"}</span>
        </pre>
      </div>
      <div className="flex flex-col gap-3">
        {tools.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start justify-between gap-3 rounded-xl border border-silver/40 bg-obsidian p-4 font-mono text-xs"
          >
            <div>
              <div className="flex items-center gap-2">
                <Workflow className="size-3.5 text-ember" />
                <span className="font-bold text-porcelain">{t.name}</span>
              </div>
              <p className="mt-1 text-porcelain/50">{t.desc}</p>
            </div>
            <span className="shrink-0 rounded border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[10px] tracking-widest text-green-500">
              {t.status}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-silver/60 bg-card p-5 shadow-sm dark:bg-card",
        className
      )}
    >
      {children}
    </div>
  );
}

export default function ViewModeToggle() {
  const [mode, setMode] = React.useState<ViewMode>("human");

  return (
    <SectionShell
      id="view-mode"
      eyebrow="The Machine Interface"
      title={
        <>
          One surface, <span className="text-ember">two dialects</span>
        </>
      }
      description="Flip between the dashboard your operators read and the structured schema stream your agents parse. Both render from the same live telemetry."
      tone="dark"
      className="border-b border-silver/30 bg-obsidian"
    >
      <div className="mb-8 flex flex-col items-center gap-4">
        <SegmentedToggle mode={mode} onChange={setMode} />
        <div className="font-mono text-[11px] uppercase tracking-widest text-porcelain/40">
          {mode === "human"
            ? <span className="flex items-center gap-1.5"><Laptop className="size-3.5" /> rendering human view · glassmorphic dashboards</span>
            : <span className="flex items-center gap-1.5"><Globe className="size-3.5" /> serving agent view · JSON-LD + tool manifest</span>}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-silver/50 bg-chrome shadow-2xl dark:bg-[#131010]">
        <div className="flex items-center gap-2 border-b border-silver/50 bg-obsidian px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-beacon/80" />
          <span className="size-2.5 rounded-full bg-ember/80" />
          <span className="size-2.5 rounded-full bg-silver/60" />
          <span className="ml-3 font-mono text-[11px] text-porcelain/60">
            {mode === "human" ? "fleet-console.clawdyclaw.com" : "mcp://clawdyclaw.com/v1"}
          </span>
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-silver/40 bg-obsidian px-2.5 py-0.5 font-mono text-[10px] text-porcelain/70">
            <ShieldCheck className="size-3 text-green-500" />
            encrypted
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, rotateX: -6 }}
            animate={{ opacity: 1, rotateX: 0 }}
            exit={{ opacity: 0, rotateX: 6 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {mode === "human" ? <HumanView /> : <AgentView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </SectionShell>
  );
}