import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ArrowUpRight, Clock, Eye, Heart, MessageCircle } from "lucide-react";

interface FeedEvent {
  id: number;
  type: "reel_published" | "engagement_spike" | "trust_update" | "rate_limit" | "hitl_approved";
  title: string;
  detail: string;
  page: string;
  metric?: string;
  timestamp: string;
}

const initialFeed: FeedEvent[] = [
  { id: 1, type: "reel_published", title: "Reel #041 published", detail: "POV Terminal — Clay to Code pipeline", page: "ClawdyClaw", metric: "1080×1920 • 22s", timestamp: "2s" },
  { id: 2, type: "engagement_spike", title: "Engagement spike detected", detail: "Reel #038 — 47 likes in 12min", page: "FB.ClawdyClaw", metric: "+340% above avg", timestamp: "8s" },
  { id: 3, type: "trust_update", title: "Trust score updated", detail: "ClawdyClaw Page → 0.87 (+0.03)", page: "ClawdyClaw", metric: "87/100", timestamp: "14s" },
  { id: 4, type: "hitl_approved", title: "HITL gate passed", detail: "Reel #042 approved — >15% watch time", page: "Factory-001", timestamp: "22s" },
  { id: 5, type: "rate_limit", title: "Rate limiter check", detail: "22/30 API slots used (24h window)", page: "All Pages", metric: "22/30", timestamp: "31s" },
  { id: 6, type: "reel_published", title: "Reel #040 published", detail: "Marketplace Flip Walkthrough", page: "FB.ClawdyClaw", metric: "1080×1920 • 18s", timestamp: "45s" },
  { id: 7, type: "engagement_spike", title: "Watch time milestone", detail: "Page reached 42,000 minutes viewed", page: "ClawdyClaw", metric: "42K / 600K", timestamp: "1m" },
  { id: 8, type: "hitl_approved", title: "Subagent loop complete", detail: "Render → encode → upload → publish", page: "Factory-001", timestamp: "1m" },
];

const typeConfig: Record<string, { color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  reel_published: { color: "#0866FF", icon: Eye },
  engagement_spike: { color: "#22c55e", icon: Heart },
  trust_update: { color: "#a855f7", icon: ArrowUpRight },
  rate_limit: { color: "#f59e0b", icon: Clock },
  hitl_approved: { color: "#06b6d4", icon: MessageCircle },
};

export default function FacebookLiveFeed() {
  const [events, setEvents] = React.useState(initialFeed);
  const [counter, setCounter] = React.useState(8);

  // Simulate live events
  React.useEffect(() => {
    const titles = [
      { type: "reel_published" as const, title: "Reel #043 published", detail: "Build-in-Public Terminal Session", page: "ClawdyClaw", metric: "1080×1920 • 25s" },
      { type: "engagement_spike" as const, title: "Share spike detected", detail: "Reel #041 — 12 shares in 5min", page: "FB.ClawdyClaw", metric: "+520% shares" },
      { type: "trust_update" as const, title: "Follower milestone", detail: "ClawdyClaw → 2,847 followers", page: "ClawdyClaw", metric: "2.8K / 10K" },
      { type: "hitl_approved" as const, title: "Quality gate passed", detail: "Avg watch time 18.2% — approved", page: "Factory-001" },
      { type: "rate_limit" as const, title: "Backoff triggered", detail: "X-App-Usage at 78% — slowing", page: "All Pages", metric: "78%" },
    ];

    const interval = setInterval(() => {
      const next = titles[Math.floor(Math.random() * titles.length)];
      setCounter((c) => c + 1);
      setEvents((prev) => [
        { ...next, id: counter + 1, timestamp: "now" },
        ...prev.slice(0, 7),
      ]);
    }, 4500);

    return () => clearInterval(interval);
  }, [counter]);

  return (
    <section id="livefeed" className="relative py-24 md:py-32">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[#0866FF]/[0.06] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 md:px-8">
        <div className="grid lg:grid-cols-[1fr_440px] gap-12 items-start">
          {/* Left: info */}
          <div>
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[11px] font-semibold tracking-widest text-[#0866FF] uppercase"
            >
              Live Telemetry
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mt-3 text-[28px] md:text-[36px] font-bold tracking-[-0.03em]"
            >
              Factory Command Center
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="mt-3 text-[15px] text-white/45 max-w-md leading-relaxed"
            >
              Real-time telemetry from your autonomous Facebook Pages. Every
              publish, engagement spike, trust update, and rate-limit event streams
              through the factory command center.
            </motion.p>

            {/* Mini stats */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-8 grid grid-cols-3 gap-4"
            >
              {[
                { label: "Active Pages", value: "5", icon: Activity },
                { label: "Reels Today", value: "14", icon: Eye },
                { label: "Avg Watch Time", value: "17.2%", icon: Clock },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
                >
                  <s.icon className="h-4 w-4 text-[#0866FF] mb-2" />
                  <div className="text-[20px] font-bold">{s.value}</div>
                  <div className="text-[11px] text-white/35 mt-0.5">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Live feed widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="rounded-[20px] border border-white/[0.08] bg-[#0E0E10]/80 backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Activity className="h-4 w-4 text-[#0866FF]" />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <span className="text-[13px] font-semibold text-white/80">
                  Live Feed
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-400">
                  STREAMING
                </span>
              </div>
            </div>

            {/* Events list */}
            <div className="max-h-[420px] overflow-y-auto scrollbar-none">
              <AnimatePresence initial={false}>
                {events.map((evt) => {
                  const cfg = typeConfig[evt.type] || typeConfig.reel_published;
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, height: 0, y: -8 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35 }}
                      className="border-b border-white/[0.04] px-5 py-3 hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.color}25` }}
                        >
                          <Icon className="h-3 w-3" style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-semibold text-white/80 truncate">
                              {evt.title}
                            </span>
                            <span className="text-[10px] text-white/25 shrink-0 font-mono">
                              {evt.timestamp}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/40 mt-0.5 truncate">
                            {evt.detail}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-white/25">
                              {evt.page}
                            </span>
                            {evt.metric && (
                              <span className="text-[10px] text-[#0866FF]/60 font-mono">
                                {evt.metric}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
