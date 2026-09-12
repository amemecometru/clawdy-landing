import * as React from "react";
import { motion } from "framer-motion";
import { Play, Eye, Clock, Heart, Share2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReelCard {
  id: string;
  title: string;
  format: string;
  duration: string;
  template: string;
  stats: { views: string; likes: string; watchTime: string; shares: string };
  code: string;
  gradient: string;
}

const reels: ReelCard[] = [
  {
    id: "R-041",
    title: "POV Terminal — Clay to Code",
    format: "9:16 • 1080×1920",
    duration: "22s",
    template: "pov-terminal",
    stats: { views: "12.4K", likes: "847", watchTime: "18.2%", shares: "34" },
    code: `template: pov-terminal
hook: "Watch me build this..."
audio: trending_id_7x
captions: burned_in
publish: graph_api → page_id`,
    gradient: "from-[#0866FF]/20 to-[#1877F2]/5",
  },
  {
    id: "R-038",
    title: "Marketplace Flip Walkthrough",
    format: "9:16 • 1080×1920",
    duration: "18s",
    template: "clay-to-code",
    stats: { views: "8.7K", likes: "623", watchTime: "21.4%", shares: "28" },
    code: `template: clay-to-code
hook: "Found this listing..."
audio: trending_id_3a
captions: burned_in
publish: graph_api → page_id`,
    gradient: "from-emerald-500/15 to-emerald-500/5",
  },
  {
    id: "R-035",
    title: "Agent Subloop Demo",
    format: "9:16 • 1080×1920",
    duration: "25s",
    template: "build-in-public",
    stats: { views: "6.2K", likes: "412", watchTime: "15.8%", shares: "19" },
    code: `template: build-in-public
hook: "My AI just flipped..."
audio: trending_id_9k
captions: burned_in
publish: graph_api → page_id`,
    gradient: "from-purple-500/15 to-purple-500/5",
  },
  {
    id: "R-032",
    title: "Worker Pipeline Timelapse",
    format: "9:16 • 1080×1920",
    duration: "20s",
    template: "flip-reveal",
    stats: { views: "15.1K", likes: "1.2K", watchTime: "23.6%", shares: "56" },
    code: `template: flip-reveal
hook: "From scrap to sale..."
audio: trending_id_2m
captions: burned_in
publish: graph_api → page_id`,
    gradient: "from-amber-500/15 to-amber-500/5",
  },
];

function FlipCard({ reel, index }: { reel: ReelCard; index: number }) {
  const [isFlipped, setIsFlipped] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      className="shrink-0 w-[300px] md:w-[320px] perspective-[1200px]"
    >
      <motion.div
        className="relative w-full h-[440px] cursor-pointer"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* FRONT */}
        <div
          className="absolute inset-0 rounded-[20px] overflow-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className={cn("h-full rounded-[20px] border border-white/[0.08] bg-gradient-to-br", reel.gradient, "backdrop-blur-xl p-5 flex flex-col")}>
            {/* Reel preview area */}
            <div className="relative flex-1 rounded-[14px] bg-black/50 border border-white/[0.06] overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
              <Play className="h-12 w-12 text-white/20" />

              {/* Overlay stats */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3 w-3 text-white/50" />
                  <span className="text-[11px] text-white/50 font-medium">{reel.stats.views}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Heart className="h-3 w-3 text-white/50" />
                  <span className="text-[11px] text-white/50 font-medium">{reel.stats.likes}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Share2 className="h-3 w-3 text-white/50" />
                  <span className="text-[11px] text-white/50 font-medium">{reel.stats.shares}</span>
                </div>
              </div>

              {/* Top badges */}
              <div className="absolute top-3 left-3">
                <span className="rounded-full bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-0.5 text-[10px] font-mono text-white/60">
                  {reel.format}
                </span>
              </div>
              <div className="absolute top-3 right-3">
                <span className="rounded-full bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-0.5 text-[10px] font-mono text-white/60">
                  {reel.duration}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#0866FF]/70">{reel.id}</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-emerald-400" />
                  <span className="text-[11px] font-semibold text-emerald-400">{reel.stats.watchTime}</span>
                  <span className="text-[10px] text-white/30">watch time</span>
                </div>
              </div>
              <h3 className="mt-1.5 text-[14px] font-semibold leading-snug">{reel.title}</h3>
              <p className="mt-1 text-[11px] text-white/35">Template: {reel.template}</p>
            </div>

            {/* Flip button */}
            <button
              onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] border border-white/[0.08] py-2.5 text-[12px] font-medium text-white/60 hover:bg-white/[0.10] hover:text-white transition"
            >
              <RotateCw className="h-3.5 w-3.5" />
              View Config
            </button>
          </div>
        </div>

        {/* BACK */}
        <div
          className="absolute inset-0 rounded-[20px] overflow-hidden"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="h-full rounded-[20px] border border-[#0866FF]/15 bg-[linear-gradient(180deg,rgba(8,102,255,0.10),rgba(8,102,255,0.02))] backdrop-blur-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] text-[#0866FF]/70">{reel.id} — CONFIG</span>
              <span className="rounded-full bg-[#0866FF]/15 border border-[#0866FF]/20 px-2 py-0.5 text-[10px] font-semibold text-[#8ab4ff]">
                {reel.template}
              </span>
            </div>

            <div className="flex-1 rounded-[14px] bg-black/60 border border-white/[0.06] p-4 font-mono text-[12px] leading-[1.8] text-white/50 whitespace-pre overflow-y-auto">
              <span className="text-[#0866FF]/60">{"// Factory Config"}</span>
              {"\n"}
              {reel.code}
              {"\n\n"}
              <span className="text-emerald-500/60">{"// Auto-generated"}</span>
              {"\n"}
              <span className="text-white/30">rate_limit: adaptive</span>
              {"\n"}
              <span className="text-white/30">trust_backoff: exponential</span>
              {"\n"}
              <span className="text-white/30">hitl_gate: enabled</span>
              {"\n"}
              <span className="text-white/30">watermark: none</span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] border border-white/[0.08] py-2.5 text-[12px] font-medium text-white/60 hover:bg-white/[0.10] hover:text-white transition"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Flip Back
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function FacebookReelsFlipCard() {
  const trackRef = React.useRef<HTMLDivElement>(null);

  return (
    <section id="reels" className="relative py-24 md:py-32 overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-6 md:px-8 mb-12">
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-[11px] font-semibold tracking-widest text-[#0866FF] uppercase"
        >
          Reels Pipeline
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-3 text-[28px] md:text-[36px] font-bold tracking-[-0.03em]"
        >
          Autonomous Reels Factory
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="mt-3 text-[15px] text-white/45 max-w-lg leading-relaxed"
        >
          Each card shows a published Reel — flip it to see the exact factory
          config, template, and publishing parameters. All original content,
          burned-in captions, zero watermarks.
        </motion.p>
      </div>

      {/* Flip card track */}
      <div
        ref={trackRef}
        className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory px-6 md:px-[calc((100vw-1200px)/2+24px)] pb-4 scrollbar-none"
      >
        {reels.map((reel, i) => (
          <div key={reel.id} className="snap-start">
            <FlipCard reel={reel} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}
