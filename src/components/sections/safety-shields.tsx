"use client";

import { motion } from "framer-motion";
import {
  Ban,
  CircleCheckBig,
  Clock3,
  Coins,
  ShieldAlert,
  SlidersHorizontal,
  ToggleLeft,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { SectionShell } from "@/components/ui/section-shell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const shields = [
  {
    icon: SlidersHorizontal,
    eyebrow: "Pillar 01",
    title: "Hard Limits & Budget Caps",
    text: "Every subagent inherits a hard ceiling: max per-trade, max per-day, max concurrent loops. When a cap trips, the loop closes instantly and refunds any drift to the yield pool.",
    points: [
      "Per-agent daily stop-loss",
      "Max open positions per market",
      "Gas ceilings across L1/L2",
    ],
    accent: "text-ember border-ember/50",
    iconBg: "bg-ember/10",
  },
  {
    icon: UserRoundCheck,
    eyebrow: "Pillar 02",
    title: "Human-in-the-Loop Overrides",
    text: "Operators keep veto power over every expensive or irreversible step. Toggle a fleet into supervised mode and every settlement waits in the approval queue until signed.",
    points: [
      "One-tap fleet kill-switch",
      "Frictionless approval queue",
      "Role-scoped operator access",
    ],
    accent: "text-rust border-rust/50",
    iconBg: "bg-rust/10",
  },
  {
    icon: Ban,
    eyebrow: "Pillar 03",
    title: "Anti-Ban Rate-Limiting Proxies",
    text: "Harvesters rotate through distributed proxy pools with jittered cadence to stay under platform radar. Attendance-sourced and CAPTCHA-aware by design.",
    points: [
      "Distributed residential proxies",
      "Jittered request cadence",
      "CAPTCHA-aware fallback chain",
    ],
    accent: "text-beacon border-beacon/50",
    iconBg: "bg-beacon/10",
  },
];

export default function SafetyShields() {
  return (
    <SectionShell
      id="shields"
      eyebrow="Security & Risk Guardrails"
      title={
        <>
          Run fast. <span className="text-rust">Never run uninsured.</span>
        </>
      }
      description="Autonomy without guardrails is just a runaway. ClawdyClaw ships capital-loss protection baked into the orchestration layer."
      className="border-b border-silver/40 bg-chrome"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {shields.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="group flex flex-col gap-5 rounded-2xl border border-silver/60 bg-card p-6 shadow-sm transition-all hover:shadow-lg md:p-8"
          >
            <div className="flex items-center justify-between">
              <div className={cn("grid size-12 place-items-center rounded-xl", s.iconBg, s.accent.split(" ")[0])}>
                <s.icon className="size-6" />
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {s.eyebrow}
              </Badge>
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-obsidian dark:text-porcelain">
                <ShieldAlert className={cn("size-4", s.accent.split(" ")[0])} />
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
            <ul className="mt-auto space-y-2">
              {s.points.map((p) => (
                <li key={p} className="flex items-center gap-2 font-mono text-xs text-obsidian/80 dark:text-porcelain/80">
                  <CircleCheckBig className={cn("size-3.5", s.accent.split(" ")[0])} />
                  {p}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {/* Status strip */}
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-silver/60 bg-obsidian p-6 text-porcelain md:flex-row md:items-center md:gap-6 md:p-8">
        {[
          { icon: ToggleLeft, label: "Fleet mode", value: "SUPERVISED" },
          { icon: Coins, label: "Daily cap", value: "$500.00" },
          { icon: Users, label: "Ops keys", value: "2 / 4 active" },
          { icon: Clock3, label: "Loop TTL", value: "90 min" },
        ].map((st) => (
          <div key={st.label} className="flex items-center gap-3">
            <st.icon className="size-5 text-ember" />
            <div className="font-mono">
              <div className="text-[10px] uppercase tracking-widest text-porcelain/50">{st.label}</div>
              <div className="text-sm font-bold text-porcelain">{st.value}</div>
            </div>
          </div>
        ))}
        <div className="md:ml-auto flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 font-mono text-xs text-green-400">
          <span className="size-1.5 animate-pulse rounded-full bg-green-500" />
          ALL GUARDRAILS ACTIVE
        </div>
      </div>
    </SectionShell>
  );
}