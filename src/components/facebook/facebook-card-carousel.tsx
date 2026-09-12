import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  ShoppingCart,
  MessageSquare,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowCard {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  flow: string[];
  metric: string;
  code: string;
  tagline: string;
}

const workflows: WorkflowCard[] = [
  {
    id: "01",
    icon: Bot,
    title: "FB Marketplace Flip Engine",
    flow: ["Scrape listings", "AI pricing delta", "HITL gate", "Messenger invoice"],
    metric: "15–30% margin",
    tagline: "End-to-end autonomous arbitrage",
    code: `apify.run("fb-marketplace")
  -> qwen.pricing_delta()
  -> hitl.approve()
  -> messenger.send(template: invoice)`,
  },
  {
    id: "02",
    icon: TrendingUp,
    title: "Autonomous Reels Factory",
    flow: ["AI script gen", "Video render", "Trust backoff", "Graph API publish"],
    metric: "600 Reels/day",
    tagline: "20 Pages × 30 API slots",
    code: `factory.render(template: pov)
  -> video.encode(9:16, 1080x1920)
  -> rate_limit.adaptive_backoff()
  -> graph.publish(page_id, reel)`,
  },
  {
    id: "03",
    icon: ShoppingCart,
    title: "Marketplace Arbitrage",
    flow: ["FB Marketplace scraper", "Qwen pricing delta", "Vector Memory", "WhatsApp alert"],
    metric: "15–30% margin flips",
    tagline: "Real-time deal detection pipeline",
    code: `apify.run("fb-marketplace")
  -> qwen.pricing_delta()
  -> vector.upsert(memory)
  -> whatsapp.broadcast(deal)`,
  },
  {
    id: "04",
    icon: MessageSquare,
    title: "Groups → Content → Broadcast",
    flow: ["Group feed", "LLM summary", "HITL approval", "IG carousel + WA broadcast"],
    metric: "3× content velocity",
    tagline: "Cross-platform content orchestration",
    code: `group.on_post -> llm.summarize()
  -> hitl.approve()
  -> ig.carousel(via 21st.dev)
  -> wa.broadcast(audience)`,
  },
  {
    id: "05",
    icon: Bot,
    title: "Messenger AI Concierge",
    flow: ["Inbox stream", "Intent classifier", "Response gen", "HITL override"],
    metric: "< 2s response time",
    tagline: "Autonomous customer engagement",
    code: `messenger.on_message()
  -> llm.classify_intent()
  -> llm.generate_response()
  -> hitl.override_if_needed()`,
  },
  {
    id: "06",
    icon: TrendingUp,
    title: "Ad Creative Pipeline",
    flow: ["Trend scraper", "Hook generator", "Video render", "Ad account publish"],
    metric: "10× creative output",
    tagline: "Data-driven creative automation",
    code: `trends.fb_reels_hot()
  -> llm.hook_generator()
  -> video.render(template)
  -> ads.publish(campaign_id)`,
  },
];

export default function FacebookCardCarousel() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const checkScroll = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = (dir: "left" | "right") => {
    const el = containerRef.current;
    if (!el) return;
    const cardWidth = 380;
    el.scrollBy({ left: dir === "left" ? -cardWidth : cardWidth, behavior: "smooth" });
  };

  return (
    <section id="automations" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        {/* Section header */}
        <div className="flex items-end justify-between gap-4 mb-12">
          <div>
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[11px] font-semibold tracking-widest text-[#0866FF] uppercase"
            >
              Automation Workflows
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mt-3 text-[28px] md:text-[36px] font-bold tracking-[-0.03em]"
            >
              SkillChain Orchestration
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="mt-3 text-[15px] text-white/45 max-w-md"
            >
              Each workflow runs as an autonomous HITL-gated subagent loop — from
              trigger to execution, with trust-score backoff built in.
            </motion.p>
          </div>

          {/* Nav arrows */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border border-white/10 transition",
                canScrollLeft ? "bg-white/[0.06] text-white hover:bg-white/[0.10]" : "text-white/20 cursor-not-allowed"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border border-white/10 transition",
                canScrollRight ? "bg-white/[0.06] text-white hover:bg-white/[0.10]" : "text-white/20 cursor-not-allowed"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Carousel track */}
      <div
        ref={containerRef}
        className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory px-6 md:px-[calc((100vw-1200px)/2+24px)] pb-4 scrollbar-none"
      >
        {workflows.map((wf, i) => (
          <motion.div
            key={wf.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.5 }}
            className="snap-start shrink-0 w-[340px] md:w-[370px]"
          >
            <div className="group relative rounded-[20px] border border-[#0866FF]/20 bg-[linear-gradient(180deg,rgba(8,102,255,0.10),rgba(8,102,255,0.02))] backdrop-blur-xl p-[1px] overflow-hidden h-full hover:border-[#0866FF]/30 transition-colors">
              <div className="rounded-[19px] bg-[#0E0E10]/90 p-6 h-full flex flex-col">
                {/* Top row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0866FF]/15 border border-[#0866FF]/20 text-[#8ab4ff]">
                      <wf.icon className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-[11px] text-white/30">
                      WF-{wf.id}
                    </span>
                  </div>
                  <span className="rounded-full bg-[#0866FF]/15 border border-[#0866FF]/20 px-2.5 py-1 text-[10px] font-semibold text-[#8ab4ff]">
                    {wf.metric}
                  </span>
                </div>

                {/* Title + tagline */}
                <h3 className="mt-4 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em]">
                  {wf.title}
                </h3>
                <p className="mt-1 text-[12px] text-white/35">{wf.tagline}</p>

                {/* Flow chips */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {wf.flow.map((step, j) => (
                    <span key={j} className="inline-flex items-center gap-1.5">
                      <span className="rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-1 text-[11px] text-white/55 font-mono">
                        {step}
                      </span>
                      {j < wf.flow.length - 1 && (
                        <span className="text-white/20">→</span>
                      )}
                    </span>
                  ))}
                </div>

                {/* Code block */}
                <div className="mt-4 rounded-[12px] bg-black/60 border border-white/[0.06] p-3 font-mono text-[11px] leading-[1.65] text-white/45 whitespace-pre flex-1">
                  {wf.code}
                </div>

                {/* Bottom note */}
                <div className="mt-4 flex items-center gap-2 text-[11px] text-white/30">
                  <ArrowRight className="h-3.5 w-3.5 text-[#8ab4ff]" />
                  HITL gate + trust score increment
                </div>
              </div>

              {/* Hover glow */}
              <div className="pointer-events-none absolute -inset-px rounded-[20px] bg-gradient-to-b from-[#0866FF]/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-500" style={{ mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor" }} />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
