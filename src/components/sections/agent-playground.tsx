"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  CircleDot,
  CornerDownLeft,
  GitBranch,
  Loader2,
  Sparkles,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionShell } from "@/components/ui/section-shell";

type Stage =
  | { kind: "plan"; label: string }
  | { kind: "route"; label: string; sub: string }
  | { kind: "run"; label: string; sub: string }
  | { kind: "done"; label: string };

type Pipeline = {
  id: number;
  prompt: string;
  stages: Stage[];
};

const PRESETS = [
  {
    label: "Find undervalued power tools within 15 miles",
    files: promptToPipeline,
  },
  { label: "Sell my vintage camera to the highest bidder", files: promptToPipeline },
  { label: "Audit my yield portfolio and rebalance", files: promptToPipeline },
];

function promptToPipeline(prompt: string): Pipeline {
  return {
    id: Date.now(),
    prompt,
    stages: [
      { kind: "plan", label: "directive parsed · intent → \"market-opportunity\"" },
      { kind: "route", label: "routing to Inbound Harvesters", sub: "subagent #402 · craigslist + fb feeds" },
      { kind: "run", label: "comps engine scoring 214 listings", sub: "deterministic valuation · 412ms" },
      { kind: "run", label: "quota check vs anti-ban windows", sub: "proxy pool · 0 rate-limit hits" },
      { kind: "done", label: "3 arbitrage opportunities closed · +$128.40" },
    ],
  };
}

const typeLines: { prompt: string; reply: string }[] = [
  { prompt: "list opportunities --category power_tools", reply: "Found 3 undervalued listings within 15 miles." },
  { prompt: "negotiate asset 0x41c2 --max 42", reply: "Counter accepted · settled at $37.50 (ROI +41%)." },
  { prompt: "status --yield", reply: "Autonomous yield: $98,241.18 · all loops on budget." },
];

function useTyping(lines: { prompt: string; reply: string }[]) {
  const [full, setFull] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const [pos, setPos] = React.useState(0);

  React.useEffect(() => {
    if (idx >= lines.length) return;
    const line = lines[idx];
    const target = line.prompt + "\n" + line.reply;
    if (pos < target.length) {
      const t = setTimeout(
        () => setPos((p) => p + 1),
        pos < line.prompt.length ? 22 : 14
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setFull((f) => (f ? f + "\n" : "") + target);
      setIdx((i) => i + 1);
      setPos(0);
    }, 450);
    return () => clearTimeout(t);
  }, [idx, pos, lines]);

  const pending = idx < lines.length ? lines[idx].prompt + "\n" + lines[idx].reply : "";
  return { buf: full + (pos > 0 ? (full ? "\n" : "") + pending.slice(0, pos) : ""), done: idx >= lines.length };
}

export default function AgentPlayground() {
  const [input, setInput] = React.useState("");
  const [pipeline, setPipeline] = React.useState<Pipeline | null>(null);
  const [running, setRunning] = React.useState(false);
  const [revealed, setRevealed] = React.useState(0);
  const { buf, done: typingDone } = useTyping(typeLines);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const run = (prompt: string) => {
    if (!prompt.trim()) return;
    setInput("");
    setRunning(true);
    setRevealed(0);
    const p = promptToPipeline(prompt);
    const timer = setTimeout(() => {
      setPipeline(p);
      setRunning(false);
    }, 600);
    return () => clearTimeout(timer);
  };

  React.useEffect(() => {
    if (!pipeline) return;
    if (revealed < pipeline.stages.length) {
      const t = setTimeout(() => setRevealed((r) => r + 1), 700);
      return () => clearTimeout(t);
    }
  }, [pipeline, revealed]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [buf, pipeline, revealed, typingDone]);

  return (
    <SectionShell
      id="playground"
      eyebrow="Interactive Sandbox"
      title={
        <>
          Drive the fleet <span className="text-rust">live on this page</span>
        </>
      }
      description="Type a directive and watch the pipeline route it — plan, harvest, valuate, negotiate, settle. Zero risk: this is the simulator, your wallet is safe."
      className="border-b border-silver/40 bg-chrome"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Terminal */}
        <div className="lg:col-span-3">
          <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-silver bg-obsidian shadow-2xl">
            <div className="flex items-center gap-2 border-b border-silver/30 bg-obsidian px-4 py-3">
              <span className="size-3 rounded-full bg-beacon/80" />
              <span className="size-3 rounded-full bg-ember/80" />
              <span className="size-3 rounded-full bg-silver/50" />
              <span className="ml-3 flex items-center gap-2 font-mono text-[11px] text-porcelain/60">
                <Terminal className="size-3.5 text-ember" />
                agent://sandbox
              </span>
              <span className="ml-auto flex items-center gap-1.5 rounded-full border border-silver/40 px-2 py-0.5 font-mono text-[10px] text-porcelain/50">
                <span className="size-1.5 animate-pulse rounded-full bg-green-500" /> SIM
              </span>
            </div>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-porcelain/85"
            >
              <p className="text-porcelain/40">
                ClawdyClaw fleet simulator v0.9.4 — type a directive or use a preset below.
              </p>
              <pre className="mt-2 whitespace-pre-wrap">{buf}<span className="inline-block size-2 animate-pulse bg-ember align-middle" /></pre>
              <AnimatePresence>
                {pipeline && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                    {pipeline.stages.slice(0, revealed).map((s, i) => (
                      <div key={i} className="flex items-start gap-2 py-1">
                        {s.kind === "plan" && <CircleDot className="mt-0.5 size-3.5 shrink-0 text-porcelain/50" />}
                        {s.kind === "route" && <GitBranch className="mt-0.5 size-3.5 shrink-0 text-ember" />}
                        {s.kind === "run" && <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-beacon" />}
                        {s.kind === "done" && <Sparkles className="mt-0.5 size-3.5 shrink-0 text-green-500" />}
                        <span className={cn(s.kind === "done" ? "text-green-500" : s.kind === "plan" ? "text-porcelain/70" : "text-porcelain")}>
                          {s.kind === "plan" && "▸ "}
                          {s.label}
                          {"sub" in s && s.sub && <span className="block pl-0 text-porcelain/40">{s.sub}</span>}
                        </span>
                      </div>
                    ))}
                    {revealed < pipeline.stages.length && (
                      <div className="py-1">
                        <span className="inline-block size-2 animate-pulse bg-ember" />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {running && (
                <div className="mt-4 flex items-center gap-2 text-beacon">
                  <Loader2 className="size-3.5 animate-spin" /> routing directive…
                </div>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(input);
              }}
              className="flex items-center gap-2 border-t border-silver/30 bg-obsidian px-4 py-3"
            >
              <span className="font-mono text-ember">❯</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Find undervalued power tools within 15 miles…"
                className="flex-1 bg-transparent font-mono text-xs text-porcelain placeholder:text-porcelain/30 outline-none"
              />
              <button
                type="submit"
                className="grid size-7 place-items-center rounded-md border border-silver/40 text-porcelain/60 transition-colors hover:border-ember hover:text-ember cursor-pointer"
                aria-label="Run directive"
              >
                <CornerDownLeft className="size-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Presets + explainer */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-2xl border border-silver/60 bg-card p-6 shadow-sm">
            <h4 className="flex items-center gap-2 text-sm font-bold text-obsidian dark:text-porcelain">
              <Bot className="size-4 text-ember" /> Try a directive
            </h4>
            <div className="mt-4 space-y-2">
              <PresetButton onClick={() => run(PRESETS[0].label)} label={PRESETS[0].label} />
              <PresetButton onClick={() => run(PRESETS[1].label)} label={PRESETS[1].label} />
              <PresetButton onClick={() => run(PRESETS[2].label)} label={PRESETS[2].label} />
            </div>
          </div>
          <div className="rounded-2xl border border-silver/60 bg-rust p-6 text-porcelain shadow-lg">
            <h4 className="font-mono text-xs uppercase tracking-widest text-porcelain/80">What you just saw</h4>
            <ul className="mt-4 space-y-3 font-mono text-xs">
              {[
                "Semantic intent parse — no prompt injection path",
                "Subagent routing across the harvester pool",
                "Deterministic comps pricing (hard math, no drift)",
                "Auto-proxied rate limiting on every external call",
                "Ledger-signed settlement when a deal closes",
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-ember">▸</span> {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-silver/60 bg-muted/40 px-4 py-2.5 text-left font-mono text-xs text-muted-foreground transition-colors hover:border-ember/70 hover:text-obsidian dark:hover:text-porcelain cursor-pointer"
    >
      {label}
    </button>
  );
}