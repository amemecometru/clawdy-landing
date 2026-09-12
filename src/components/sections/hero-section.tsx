"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Copy, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

const MCP_ENDPOINT = "/mcp/v1/manifest.json";

function RetroGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden [perspective:200px] opacity-40">
      <div className="absolute inset-0 [transform:rotateX(65deg)]">
        <div className="animate-grid [background-image:linear-gradient(to_right,theme(colors.silver)_1px,transparent_0),linear-gradient(to_bottom,theme(colors.silver)_1px,transparent_0)] [background-repeat:repeat] [background-size:56px_56px] [height:240vh] [inset:0%_0px] [margin-left:-200%] [transform-origin:100%_0_0] [width:600vw]" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/80 to-transparent" />
    </div>
  );
}

function AgentHandshakeBadge() {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://clawdyclaw.com${MCP_ENDPOINT}`);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy agent handshake endpoint"
      className="group inline-flex items-center gap-3 rounded-full border border-silver/60 bg-obsidian/60 py-2 pl-2 pr-4 font-mono text-xs text-porcelain shadow-[0_0_24px_rgba(227,17,33,0.25)] backdrop-blur transition-all hover:border-beacon hover:shadow-[0_0_32px_rgba(227,17,33,0.45)] cursor-pointer"
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-beacon/20 text-beacon">
        <Radio className="size-3.5 animate-pulse" />
      </span>
      <span className="tracking-tight">Agent Handshake</span>
      <span className="hidden text-porcelain/50 sm:inline">{"//"}</span>
      <span className="hidden text-ember sm:inline">{MCP_ENDPOINT}</span>
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1 text-green-500"
          >
            <Check className="size-3.5" /> Copied
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-porcelain/50 transition-colors group-hover:text-silver"
          >
            <Copy className="size-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

const telemetry = [
  { label: "ACTIVE SUBAGENTS", value: "1,284", accent: "text-ember" },
  { label: "LOOP CLOSE P95", value: "412ms", accent: "text-porcelain" },
  { label: "NODES ONLINE", value: "37", accent: "text-beacon" },
];

export default function HeroSection() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-obsidian text-porcelain">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-ember/10 blur-[140px]" />
        <div className="absolute -left-32 top-1/3 h-72 w-72 rounded-full bg-beacon/10 blur-[120px]" />
        <div className="absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-rust/20 blur-[130px]" />
      </div>

      <RetroGrid />

      <SiteHeader />

      {/* Hero Content */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 pb-24 pt-14 text-center md:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="flex flex-col items-center gap-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-silver/50 bg-obsidian/60 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-porcelain/70">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-beacon opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-beacon" />
            </span>
            Systems online · MCP bridge live
          </div>

          <AgentHandshakeBadge />

          <h1 className="mx-auto max-w-4xl text-4xl font-black leading-[1.05] tracking-tight text-porcelain md:text-6xl lg:text-7xl">
            Autonomous{" "}
            <span className="bg-gradient-to-r from-ember via-beacon to-ember bg-clip-text text-transparent">
              Capital Accumulation
            </span>{" "}
            for the Agentic Era.
          </h1>

          <p className="max-w-2xl text-base leading-relaxed text-porcelain/70 md:text-lg">
            ClawdyClaw orchestrates fleets of autonomous subagents that harvest
            market inefficiencies, negotiate on your behalf, and drive
            machine-rate revenue — closed loops, serverless, and auditable.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Button asChild variant="ember" size="xl" className="w-full font-mono sm:w-auto">
              <a href="#pricing">
                Deploy Agent Hub <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="xl" className="w-full bg-obsidian/50 font-mono text-porcelain sm:w-auto">
              <a href="#playground">
                Test the Simulator <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>

          {/* Telemetry strip */}
          <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-silver/40 bg-silver/20 sm:grid-cols-3">
            {telemetry.map((t) => (
              <div
                key={t.label}
                className="flex flex-col items-center gap-1 bg-obsidian/80 px-4 py-4"
              >
                <span className={cn("font-mono text-xl font-bold", t.accent)}>
                  {t.value}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-porcelain/50">
                  {t.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 font-mono text-xs text-porcelain/40">
            <span className="text-green-500">●</span> accepting machine handshakes at{" "}
            <span className="text-ember">https://clawdyclaw.com/mcp/v1</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}