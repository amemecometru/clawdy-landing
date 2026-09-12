import { motion } from "framer-motion";
import { Play, ArrowRight, Cpu, Globe, Shield } from "lucide-react";

const stats = [
  { value: "600+", label: "Reels/day capacity", icon: Play },
  { value: "20", label: "Autonomous pages", icon: Globe },
  { value: "30/24h", label: "API limit per page", icon: Cpu },
  { value: "100%", label: "Original content", icon: Shield },
];

export default function FacebookHero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[25%] left-[10%] h-[65%] w-[55%] rounded-full bg-[#0866FF]/[0.16] blur-[140px]" />
        <div className="absolute top-[5%] right-[5%] h-[45%] w-[40%] rounded-full bg-[#1877F2]/[0.10] blur-[120px]" />
        <div className="absolute bottom-[-15%] left-[25%] h-[50%] w-[50%] rounded-full bg-[#E7F3FF]/[0.03] blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 md:px-8 w-full py-20 md:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-[#0866FF]/20 bg-[#0866FF]/10 px-3.5 py-1 mb-6"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#0866FF] animate-pulse" />
              <span className="text-[11px] font-semibold tracking-wider text-[#8ab4ff] uppercase">
                Factory-001 Live
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-[36px] md:text-[48px] lg:text-[56px] font-bold leading-[1.08] tracking-[-0.03em]"
            >
              Autonomous Facebook{" "}
              <span className="bg-gradient-to-r from-[#0866FF] to-[#1877F2] bg-clip-text text-transparent">
                Reels Factory
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-5 max-w-lg text-[15px] md:text-[17px] leading-relaxed text-white/55"
            >
              HITL-gated subagent loops publishing high-quality 9:16 Reels to
              autonomous Facebook Pages. Adaptive rate-limiting, trust-score
              backoff, zero watermark original content — fully orchestrated via
              Cloudflare Workers.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <a
                href="#automations"
                className="group inline-flex items-center gap-2 rounded-full bg-[#0866FF] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_0_30px_rgba(8,102,255,0.3)] transition hover:bg-[#0757d9] hover:shadow-[0_0_40px_rgba(8,102,255,0.45)]"
              >
                Deploy Factory-001
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </a>
              <a
                href="#reels"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-[14px] font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                <Play className="h-3.5 w-3.5" />
                View Reels Pipeline
              </a>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6"
            >
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.55 + i * 0.08 }}
                  className="flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5">
                    <stat.icon className="h-3.5 w-3.5 text-[#0866FF]" />
                    <span className="text-[22px] font-bold tracking-tight text-white">
                      {stat.value}
                    </span>
                  </div>
                  <span className="text-[12px] text-white/40 font-medium">
                    {stat.label}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right: Widget preview card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="relative rounded-[24px] border border-[#0866FF]/15 bg-[linear-gradient(180deg,rgba(8,102,255,0.08),rgba(8,102,255,0.02))] backdrop-blur-xl p-[1px] overflow-hidden">
              <div className="rounded-[23px] bg-[#0E0E10]/90 overflow-hidden">
                {/* Widget header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#0866FF] shadow-[0_0_8px_rgba(8,102,255,0.5)]" />
                    <span className="text-[13px] font-semibold text-white/80">
                      FB Factory Dashboard
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    LIVE
                  </span>
                </div>

                {/* Simulated feed items */}
                <div className="p-4 space-y-3">
                  {[
                    {
                      title: "Reel #041 published",
                      desc: "POV Terminal — Clay to Code pipeline",
                      time: "2s ago",
                      status: "published",
                    },
                    {
                      title: "Trust score updated",
                      desc: "ClawdyClaw Page → 0.87 (+0.03)",
                      time: "14s ago",
                      status: "trust",
                    },
                    {
                      title: "HITL gate passed",
                      desc: "Reel #042 approved — >15% avg watch time",
                      time: "28s ago",
                      status: "approved",
                    },
                    {
                      title: "Rate limiter active",
                      desc: "22/30 API slots used (24h window)",
                      time: "41s ago",
                      status: "limit",
                    },
                    {
                      title: "Subagent loop complete",
                      desc: "Video render → upload → publish cycle",
                      time: "1m ago",
                      status: "cycle",
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.1, duration: 0.4 }}
                      className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3"
                    >
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-[#0866FF] shrink-0 shadow-[0_0_6px_rgba(8,102,255,0.4)]" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold text-white/80 truncate">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-white/30 shrink-0">
                            {item.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/40 mt-0.5 truncate">
                          {item.desc}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Bottom command hint */}
                <div className="border-t border-white/[0.06] px-5 py-3">
                  <code className="text-[11px] font-mono text-white/30">
                    <span className="text-[#0866FF]/70">$</span> npx clawdyclaw
                    deploy factory-001 --limit 2/day
                  </code>
                </div>
              </div>
            </div>

            {/* Glow ring */}
            <div className="absolute -inset-8 rounded-[32px] bg-[#0866FF]/[0.06] blur-2xl pointer-events-none" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
