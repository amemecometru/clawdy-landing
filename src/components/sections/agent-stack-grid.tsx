"use client";

import { motion } from "framer-motion";
import {
  Anchor,
  Armchair,
  BrainCircuit,
  Cable,
  DatabaseZap,
  GitBranch,
  Handshake,
  Radar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionShell } from "@/components/ui/section-shell";
import { Badge } from "@/components/ui/badge";

const pipelines = [
  { name: "craigslist://inbound", state: "streaming", color: "bg-green-500" },
  { name: "fb-marketplace://inbound", state: "streaming", color: "bg-green-500" },
  { name: "comps-engine://synced", state: "1,240 comps", color: "bg-ember" },
];

export default function AgentStackGrid() {
  return (
    <SectionShell
      id="stack"
      eyebrow="Core Architecture Grid"
      title={
        <>
          The Autonomous <span className="text-rust">Stack</span>
        </>
      }
      description="Three deterministic engines — no hallucinated step is ever spent. Every stage is a hard-coded loop with an exit condition and a wallet."
      className="border-b border-silver/40 bg-chrome"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        {/* Card A - Inbound Harvesters */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="group col-span-1 flex flex-col md:col-span-2 md:row-span-2"
        >
          <div className="flex flex-1 flex-col justify-between gap-8 rounded-2xl border border-silver/60 bg-card p-6 shadow-sm transition-all hover:border-ember/60 hover:shadow-lg md:p-8">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <Badge variant="ember" className="font-mono">Card A · Ingest</Badge>
                <Radar className="size-5 text-ember" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-obsidian dark:text-porcelain md:text-2xl">
                Inbound Harvesters
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Scraping and ingestion loops for Craigslist, FB Marketplace, and
                localized feeds. Proxied, rate-limited, and structured into
                queryable inventory in under a second.
              </p>
            </div>
            <div className="space-y-2 font-mono text-xs">
              {pipelines.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 rounded-lg border border-silver/50 bg-muted/40 px-3 py-2"
                >
                  <span className={cn("size-1.5 rounded-full", p.color)} />
                  <span className="text-obsidian/80 dark:text-porcelain/80">{p.name}</span>
                  <span className="ml-auto text-muted-foreground">{p.state}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Card B - Deterministic Valuation Core */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="col-span-1 md:col-span-4"
        >
          <div className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-silver/60 bg-card p-6 shadow-sm transition-all hover:border-rust/60 hover:shadow-lg md:flex-row md:items-center md:p-8">
            <div className="max-w-md">
              <div className="mb-4 flex items-center justify-between">
                <Badge variant="rust" className="font-mono">Card B · Valuation</Badge>
                <BrainCircuit className="size-5 text-rust" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-obsidian dark:text-porcelain md:text-2xl">
                Deterministic Valuation Core
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Bypasses LLM hallucination with hard math and comps engines —
                a weighted scoring model over sold-price history, condition
                curves, and local velocity. An asset is only worth what the
                ledger says it is.
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-3 font-mono">
              {[
                { v: "0.87", l: "score" },
                { v: "38%", l: "undervalue" },
                { v: "412ms", l: "p95 close" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="flex min-w-[86px] flex-col items-center rounded-xl border border-rust/40 bg-rust/5 px-4 py-4"
                >
                  <span className="text-lg font-black text-rust">{s.v}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.l}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Card C - Negotiation & MCP Bridge */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="col-span-1 md:col-span-4"
        >
          <div className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-silver/60 bg-card p-6 shadow-sm transition-all hover:border-beacon/60 hover:shadow-lg md:flex-row md:items-center md:p-8">
            <div className="max-w-md">
              <div className="mb-4 flex items-center justify-between">
                <Badge variant="beacon" className="font-mono">Card C · Execution</Badge>
                <Handshake className="size-5 text-beacon" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-obsidian dark:text-porcelain md:text-2xl">
                Autonomous Negotiation & MCP Bridge
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Automated workflows execute securely over the Model Context
                Protocol — agent-to-agent haggling, deterministic offer
                laddering, and ledger-signed settlement without a human in the
                critical path.
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-silver/50 bg-obsidian p-4 font-mono text-xs text-porcelain shadow-lg">
              <div className="flex items-center gap-2 text-porcelain/50">
                <Cable className="size-4 text-beacon" /> bridge//negotiate
              </div>
              <pre className="mt-3 space-y-1 text-porcelain/70">
                <span><span className="text-beacon">agent</span>: {`"initial offer — $42"`}</span>
                <span><span className="text-ember">counter</span>: {`"accepted at $37.50"`}</span>
                <span className="text-green-500">&gt; settled · ledger sig 0xa2f9…</span>
              </pre>
            </div>
          </div>
        </motion.div>

        {/* Side utility tiles */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="col-span-1 md:col-span-2"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-silver/60 bg-card p-5 shadow-sm">
            <DatabaseZap className="size-8 shrink-0 text-ember" />
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-bold text-obsidian dark:text-porcelain">
                <Sparkles className="size-3.5 text-ember" /> Skillchains
              </h4>
              <p className="text-xs text-muted-foreground">
                Composable pipelines routing requests across the fleet.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="col-span-1 md:col-span-2"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-silver/60 bg-card p-5 shadow-sm">
            <ShieldCheck className="size-8 shrink-0 text-beacon" />
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-bold text-obsidian dark:text-porcelain">
                <Anchor className="size-3.5 text-beacon" /> Human override
              </h4>
              <p className="text-xs text-muted-foreground">
                Kill-switch, budget caps, and approval gates at every stage.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="col-span-1 md:col-span-2"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-silver/60 bg-card p-5 shadow-sm">
            <GitBranch className="size-8 shrink-0 text-rust" />
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-bold text-obsidian dark:text-porcelain">
                <Armchair className="size-3.5 text-rust" /> Audit trail
              </h4>
              <p className="text-xs text-muted-foreground">
                Every decision, offer, and settlement is on the ledger.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </SectionShell>
  );
}