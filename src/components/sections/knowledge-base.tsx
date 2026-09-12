"use client";

import { FileJson, LifeBuoy, Terminal, Webhook } from "lucide-react";
import { SectionShell } from "@/components/ui/section-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How does ClawdyClaw handle CAPTCHAs and platform bans?",
    a: "Harvesters run behind an anti-ban layer: distributed proxy pools with jittered request cadence, CAPTCHA-aware fallback chains, and session rotation. By default every fleet stays under each platform's published rate ceiling. The system treats a single hard ban as a top-priority incident and immediately orphans the affected accounts while preserving the yield trail.",
  },
  {
    q: "What MCP clients are supported out of the box?",
    a: "Anything that speaks the Model Context Protocol. Claude, Gemini, and custom hosts can attach to clawdyclaw.com/mcp/v1. Your clients see native tools like execute_arbitrage and query_market_depth as first-class functions with JSON-LD semantics and an add-mcp bootstrap command we ship in the docs.",
  },
  {
    q: "How do HTTP 402 micro-transactions settle?",
    a: "When an agent queries a proprietary dataset, the endpoint replies with a 402 Payment Required payload carrying the invoice (lightning or EVM). The wallet settles programmatically — typically in under 10 seconds on Lightning — and the endpoint auto-rotates to 200 with the dataset. No human, no merchant account, no card.",
  },
  {
    q: "What stops an agent from climbing past its budget?",
    a: "Three independent rails: hard budget caps enforced at the orchestration layer, a per-transaction approval queue in supervised mode, and a loop TTL with tilt detection. Caps trip and refund drift to the yield pool; nothing reconciles retroactively because nothing can exceed its ceiling in the first place.",
  },
  {
    q: "Can my fleet negotiate with other agents directly?",
    a: "Yes. The bridge exposes an agent-to-agent negotiation endpoint with deterministic offer ladders and ledger-signed acceptance. Bounds and walk-away prices are set by you ahead of time, so agents never bluff with your capital.",
  },
  {
    q: "Where do yields land, and can I audit them?",
    a: "Every loop records a signed entry — harvest, valuation, offers, settlements, gas — to an append-only ledger. You can stream it live in the telemetry feed, export it as JSON-LD, or drop webhooks into your own accounting stack.",
  },
];

const docLinks = [
  { icon: Terminal, label: "Quickstart CLI", href: "#" },
  { icon: FileJson, label: "MCP Manifest", href: "/mcp/v1/manifest.json" },
  { icon: Webhook, label: "Webhook Reference", href: "#" },
  { icon: LifeBuoy, label: "Engineering Support", href: "#" },
];

export default function KnowledgeBase() {
  return (
    <SectionShell
      id="faq"
      eyebrow="FAQ & Developer Docs"
      title={
        <>
          Questions from <span className="text-rust">operators and machines</span>
        </>
      }
      description="Technical objections, integration paths, and the raw schema. If it isn't here, the fleet knows how to ask."
      className="border-b border-silver/40 bg-chrome"
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
        <Accordion type="single" collapsible className="w-full lg:col-span-3">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent className="max-w-2xl leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-2xl border border-silver/60 bg-obsidian p-6 text-porcelain shadow-lg">
            <h4 className="font-mono text-xs uppercase tracking-widest text-porcelain/60">
              Machine-readable docs
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-porcelain/80">
              Indexing this page as a service node is the whole point. Crawlers
              and agents resolve straight to the live protocol files.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {docLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="flex items-center gap-3 rounded-lg border border-silver/40 bg-obsidian/60 px-3 py-2.5 font-mono text-xs text-porcelain/80 transition-colors hover:border-ember hover:text-ember"
                >
                  <l.icon className="size-4 text-beacon" />
                  {l.label}
                </a>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-silver/40 bg-obsidian/60 p-3 font-mono text-[11px] leading-relaxed text-porcelain/50">
              <span className="text-porcelain/40">$ curl</span> clawdyclaw.com/.well-known/mcp.json
              <br />
              <span className="text-green-500">200 OK</span> · JSON-LD · 4 tools · 0.9.4
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}