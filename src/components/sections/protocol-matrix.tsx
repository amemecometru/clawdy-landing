"use client";

import { motion } from "framer-motion";
import {
  BadgeCheck,
  ShieldBan,
  Bolt,
  Braces,
  CheckCircle2,
  CircleDollarSign,
  Server,
  Wallet,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionShell } from "@/components/ui/section-shell";
import { Badge } from "@/components/ui/badge";

const mcpCols = [
  { name: "Claude", badge: "Anthropic", status: "native", tint: "text-ember" },
  { name: "Gemini", badge: "Google", status: "native", tint: "text-ember" },
  { name: "Custom hosts", badge: "any MCP client", status: "native", tint: "text-ember" },
];

export default function ProtocolMatrix() {
  return (
    <SectionShell
      id="protocols"
      eyebrow="MCP & 402 Protocol Integration"
      title={
        <>
          Built for <span className="text-ember">machine commerce</span>
        </>
      }
      description="ClawdyClaw is natively ready for agents that pay and get paid. Expose tools to any MCP host, settle with any agentic wallet."
      tone="dark"
      className="border-b border-silver/30 bg-rust"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* MCP compliance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-silver/50 bg-obsidian/50 p-6 backdrop-blur md:p-8"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Badge variant="ember" className="mb-3 font-mono">01 · MCP Compliance</Badge>
              <h3 className="text-xl font-bold text-porcelain md:text-2xl">
                Native tool exposure
              </h3>
            </div>
            <Braces className="size-8 text-ember" />
          </div>
          <div className="mb-4 overflow-x-auto rounded-xl border border-silver/40 bg-obsidian p-4 font-mono text-xs text-porcelain">
            <span className="text-porcelain/40">$</span>{" "}
            <span className="text-ember">npx clawdyclaw</span>{" "}
            <span className="text-porcelain/70">add-mcp --host &#123;HOST&#125;</span>
          </div>
          <pre className="mb-6 whitespace-pre-wrap rounded-xl border border-silver/40 bg-obsidian p-4 font-mono text-xs leading-relaxed text-porcelain/80">
            <span className="text-beacon">mcp</span> {"{"}{"\n"}
              <span className="text-ember">"tools"</span>: [<span className="text-green-500">"tools/execute_arbitrage"</span>, <span className="text-green-500">"tools/query_market_depth"</span>],{"\n"}
              <span className="text-ember">"semantic"</span>: <span className="text-green-500">"@id: clawdyclaw/bridge#compliance"</span>,{"\n"}
              <span className="text-ember">"agents"</span>: [<span className="text-green-500">"claude"</span>, <span className="text-green-500">"gemini"</span>, <span className="text-green-500">"custom"</span>]{"\n"}
            {"}"}
          </pre>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {mcpCols.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between rounded-lg border border-silver/40 bg-obsidian/60 px-3 py-2.5"
              >
                <div>
                  <div className={cn("font-mono text-xs font-bold", c.tint)}>{c.name}</div>
                  <div className="font-mono text-[10px] text-porcelain/50">{c.badge}</div>
                </div>
                <span className="flex items-center gap-1 font-mono text-[10px] tracking-widest text-green-500">
                  <CheckCircle2 className="size-3.5" /> {c.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* HTTP 402 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border border-silver/50 bg-obsidian/50 p-6 backdrop-blur md:p-8"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Badge variant="beacon" className="mb-3 font-mono">02 · HTTP 402</Badge>
              <h3 className="text-xl font-bold text-porcelain md:text-2xl">
                Pay-per-query settlement
              </h3>
            </div>
            <CircleDollarSign className="size-8 text-beacon" />
          </div>
          <div className="mb-4 overflow-x-auto rounded-xl border border-silver/40 bg-obsidian p-4 font-mono text-xs text-porcelain">
            <span className="text-porcelain/40">POST /v1/datasets/market-depth</span>
          </div>
          <pre className="mb-6 whitespace-pre-wrap rounded-xl border border-silver/40 bg-obsidian p-4 font-mono text-xs leading-relaxed text-porcelain/80">
            <span className="text-porcelain/40">{">>> "}</span> 402 Payment Required{"\n"}
              <span className="text-ember">"code"</span>: <span className="text-green-500">"402_agent_invoice"</span>,{"\n"}
              <span className="text-ember">"pay"</span>: <span className="text-green-500">"lightning://lnbc…"</span>,{"\n"}
              <span className="text-ember">"wallet"</span>: <span className="text-green-500">"agentic:0xa2f9…"</span>{"\n"}
              <span className="text-porcelain/40">&lt;&lt;&lt; </span><span className="text-green-500">200 OK · dataset delivered</span>
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            {["Lightning", "Evm 402", "Agentic wallets", "Webhooks"].map((t) => (
              <Badge key={t} variant="outline" className="border-silver/50 bg-obsidian/60 text-porcelain/80">
                <Bolt className="size-3 text-ember" /> {t}
              </Badge>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom strip */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-silver/50 bg-obsidian/50 p-6 md:grid-cols-3 md:p-8"
      >
        {[
          {
            icon: Server,
            title: "Discoverable endpoints",
            text: "Machines find you via /.well-known/mcp.json and ai-plugin.json.",
          },
          {
            icon: Wallet,
            title: "Instant settlement",
            text: "Invoices clear in seconds — no human approval, no merchant account.",
          },
          {
            icon: ShieldBan,
            title: "Access control",
            text: "Scoped keys, monthly 402 budgets, and per-host rate-limit tiers.",
          },
        ].map((f) => (
          <div key={f.title} className="flex gap-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-ember/10 text-ember">
              <f.icon className="size-5" />
            </div>
            <div>
              <h4 className="flex items-center gap-1.5 font-bold text-porcelain">
                <BadgeCheck className="size-4 text-green-500" /> {f.title}
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-porcelain/70">{f.text}</p>
            </div>
          </div>
        ))}
      </motion.div>

      <div className="mt-8 flex items-center justify-center gap-4 font-mono text-xs text-porcelain/60">
        <Zap className="size-4 text-ember" />
        <span>
          curl <span className="text-ember">-H "x-api-key: $KEY"</span> https://clawdyclaw.com/mcp/v1
        </span>
      </div>
    </SectionShell>
  );
}