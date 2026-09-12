"use client";

import * as React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Cable,
  Coins,
  Gauge,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/utils";
import { SectionShell } from "@/components/ui/section-shell";
import NumberTicker from "@/components/ui/number-ticker";

type FeedEvent = {
  id: number;
  agent: string;
  text: string;
  delta: string;
  up: boolean;
};

const seedEvents: FeedEvent[] = [
  { id: 1, agent: "#402", text: "acquired asset on FB Marketplace", delta: "+184%", up: true },
  { id: 2, agent: "#118", text: "closed micro-task on Craigslist feed", delta: "+$42.10", up: true },
  { id: 3, agent: "#631", text: "negotiated 14% vendor discount via MCP", delta: "+9.2 ETH", up: true },
  { id: 4, agent: "#027", text: "flagged listing price anomaly — phase 2", delta: "+61%", up: true },
  { id: 5, agent: "#799", text: "settled 402 micro-invoice, wallet#a2f9", delta: "-$3.00", up: false },
  { id: 6, agent: "#253", text: "rotated proxy farm — anti-ban window", delta: "OK", up: true },
  { id: 7, agent: "#510", text: "rebalanced arb pair FB/Craigslist", delta: "+27%", up: true },
  { id: 8, agent: "#903", text: "queried market depth — 3 comps synced", delta: "+$12.88", up: true },
  { id: 9, agent: "#344", text: "executed execute_arbitrage payload", delta: "+8.4%", up: true },
  { id: 10, agent: "#081", text: "CAPTCHA bypass — solved in 1.2s", delta: "OK", up: true },
];

function useLiveFeed() {
  const [events, setEvents] = React.useState<FeedEvent[]>(seedEvents);
  React.useEffect(() => {
    const markets = [
      "FB Marketplace",
      "Craigslist",
      "eBay comps feed",
      "localized listing rail",
    ];
    const verbs = [
      "matched comp pricing",
      "acquired undervalued asset",
      "settled agent-negotiated deal",
      "closed arbitrage loop",
      "pulled fresh market depth",
      "executed micro-task",
      "harvested lead pipeline",
    ];
    const interval = setInterval(() => {
      setEvents((prev) => {
        const up = Math.random() > 0.22;
        const deltaNum = (Math.random() * 180).toFixed(1);
        const next: FeedEvent = {
          id: Date.now(),
          agent: `#${Math.floor(100 + Math.random() * 900)}`,
          text: `${verbs[Math.floor(Math.random() * verbs.length)]} on ${markets[Math.floor(Math.random() * markets.length)]}`,
          delta: up ? `+${deltaNum}%` : `${formatUsd(Math.random() * 8 + 1)}`,
          up,
        };
        return [next, ...prev.slice(0, 11)];
      });
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  return { events };
}

function EventRow({ event }: { event: FeedEvent }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-r border-silver/50 px-6 py-3 font-mono text-xs text-obsidian dark:text-porcelain">
      <span className="rounded bg-rust px-1.5 py-0.5 text-[10px] font-bold text-porcelain">
        {event.agent}
      </span>
      <span className="text-muted-foreground">{event.text}</span>
      <span
        className={cn(
          "flex items-center gap-0.5 font-bold",
          event.up ? "text-rust dark:text-ember" : "text-beacon"
        )}
      >
        {event.up ? (
          <ArrowUpRight className="size-3.5" />
        ) : (
          <ArrowDownRight className="size-3.5" />
        )}
        {event.delta}
      </span>
    </div>
  );
}

export default function LiveMetricsFeed() {
  const { events } = useLiveFeed();

  const stats = [
    {
      label: "Active Subagents",
      value: 1284,
      suffix: "",
      icon: Workflow,
      accent: "text-ember",
    },
    {
      label: "L1/L2 Gas Spent",
      value: 41.2,
      suffix: " ETH",
      decimals: 2,
      icon: Coins,
      accent: "text-rust",
    },
    {
      label: "Total Autonomous Yield",
      value: 98241,
      prefix: "$",
      icon: Gauge,
      accent: "text-beacon",
      live: true,
    },
  ];

  return (
    <SectionShell
      id="telemetry"
      eyebrow="Live Revenue Ticker & Fleet Telemetry"
      title={
        <>
          Proof runs on the <span className="text-ember">open ledger</span>
        </>
      }
      description="A live stream of closed loops, settlements, and network health — the same telemetry your agents read, rendered for humans."
      className="border-b border-silver/40 bg-chrome"
    >
      {/* Marquee */}
      <div className="relative mb-12 overflow-hidden rounded-xl border border-silver bg-card shadow-sm dark:bg-card">
        <div className="flex items-center gap-2 border-b border-silver/50 bg-obsidian px-4 py-2">
          <Activity className="size-3.5 text-beacon" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-porcelain/80">
            streaming · agentic transactions
          </span>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-porcelain/50">
            <span className="size-1.5 animate-pulse rounded-full bg-beacon" />
            live
          </span>
        </div>
        <div className="relative flex overflow-hidden py-3" aria-hidden="true">
          <div className="animate-marquee flex shrink-0 gap-px whitespace-nowrap [--marquee-duration:48s]">
            {events.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
            {events.map((e) => (
              <EventRow key={`dup-${e.id}`} event={e} />
            ))}
          </div>
        </div>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="group flex items-center gap-4 rounded-xl border border-silver/60 bg-card px-6 py-5 shadow-sm transition-all hover:border-ember/60 hover:shadow-md"
          >
            <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-rust/10 text-rust dark:bg-ember/10 dark:text-ember">
              <s.icon className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <NumberTicker
                  live={s.live}
                  value={s.value}
                  decimals={s.decimals ?? 0}
                  className={cn(
                    "font-mono text-2xl font-bold tracking-tight",
                    s.accent,
                    "tabular-nums"
                  )}
                />
                <span className="font-mono text-sm text-muted-foreground">
                  {s.suffix}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <Cable className="size-3" />
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}