"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Cpu, Network, User, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionShell } from "@/components/ui/section-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Tier = {
  icon: typeof User;
  name: string;
  tagline: string;
  price: string;
  cadence: string;
  featured?: boolean;
  features: string[];
  cta: string;
};

const tiers: Tier[] = [
  {
    icon: User,
    name: "Operator",
    tagline: "One agent, full visibility",
    price: "$99",
    cadence: "/ mo · human-run fleets",
    features: [
      "Single subagent deployment",
      "Operator dashboards + manual overrides",
      "Approval queue for every settlement",
      "Standard market harvesting rights",
      "Email + in-app support",
    ],
    cta: "Deploy Operator",
  },
  {
    icon: Network,
    name: "Swarm",
    tagline: "Multi-subagent clusters, own the rails",
    price: "$499",
    cadence: "/ mo · pro operators",
    featured: true,
    features: [
      "Multi-subagent cluster orchestration",
      "Full marketplace scraping rights",
      "Custom skillchains & workflow routing",
      "Deterministic comps engine, unlimited",
      "402 revenue sharing on data products",
      "Priority support with 4h SLA",
    ],
    cta: "Launch Your Swarm",
  },
  {
    icon: Cpu,
    name: "Autonomous Node",
    tagline: "Zero-fee machine endpoints",
    price: "Contact",
    cadence: "per-node · enterprise/MCP",
    features: [
      "Direct API keys + custom webhooks",
      "Zero-fee machine commerce endpoints",
      "Dedicated MCP tool surface for your hosts",
      "SLA-backed uptime & gas rebate pool",
      "Co-managed security review",
    ],
    cta: "Talk to an Operator",
  },
];

export default function PricingMatrix() {
  return (
    <SectionShell
      id="pricing"
      eyebrow="Pricing & Protocol Access Tiers"
      title={
        <>
          Pick your <span className="text-rust">profit participation</span>
        </>
      }
      description="Every tier monetizes the same pipeline differently. Human operators, pro swarms, and machine nodes each get the rails they deserve."
      className="border-b border-silver/40 bg-chrome"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {tiers.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className={cn(
              "relative flex flex-col rounded-2xl border p-6 shadow-sm md:p-8",
              t.featured
                ? "border-ember bg-rust text-porcelain shadow-xl shadow-ember/20 lg:-my-4 lg:py-12"
                : "border-silver/60 bg-card dark:bg-card"
            )}
          >
            {t.featured && (
              <Badge variant="beacon" className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 font-mono">
                <Zap className="size-3" /> MOST DEPLOYED
              </Badge>
            )}
            <div className="mb-5 flex items-center gap-3">
              <div
                className={cn(
                  "grid size-10 place-items-center rounded-lg",
                  t.featured ? "bg-ember/20 text-ember" : "bg-rust/10 text-rust dark:bg-ember/10 dark:text-ember"
                )}
              >
                <t.icon className="size-5" />
              </div>
              <div>
                <h3 className={cn("text-lg font-bold", t.featured ? "text-porcelain" : "text-obsidian dark:text-porcelain")}>
                  {t.name}
                </h3>
                <p className={cn("text-xs", t.featured ? "text-porcelain/70" : "text-muted-foreground")}>
                  {t.tagline}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <div className={cn("flex items-baseline gap-1 font-mono", t.featured ? "text-porcelain" : "text-obsidian dark:text-porcelain")}>
                <span className="text-3xl font-black md:text-4xl">{t.price}</span>
              </div>
              <div className={cn("mt-1 font-mono text-[11px] uppercase tracking-widest", t.featured ? "text-porcelain/60" : "text-muted-foreground")}>
                {t.cadence}
              </div>
            </div>

            <ul className="mb-8 space-y-3">
              {t.features.map((f) => (
                <li key={f} className={cn("flex items-start gap-2 text-sm", t.featured ? "text-porcelain/90" : "text-obsidian/80 dark:text-porcelain/85")}>
                  <Check className={cn("mt-0.5 size-4 shrink-0", t.featured ? "text-ember" : "text-rust dark:text-ember")} />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              asChild
              variant={t.featured ? "ember" : "outline"}
              size="lg"
              className="mt-auto w-full font-mono"
            >
              <a href="#cta">
                {t.cta}
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  );
}