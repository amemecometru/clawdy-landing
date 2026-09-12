"use client";

import * as React from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowUp } from "lucide-react";

const sections = [
  { id: "top", label: "Hero" },
  { id: "telemetry", label: "Feed" },
  { id: "view-mode", label: "Interface" },
  { id: "stack", label: "Stack" },
  { id: "protocols", label: "Protocols" },
  { id: "playground", label: "Sandbox" },
  { id: "shields", label: "Shields" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "Docs" },
];

export default function InfinityScrollerNav() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 25 });
  const [active, setActive] = React.useState("top");
  const [showTop, setShowTop] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > window.innerHeight);
      const probe = window.scrollY + window.innerHeight * 0.35;
      let current = "top";
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.offsetTop <= probe) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Scroll progress rail */}
      <div className="fixed left-4 top-1/2 z-50 hidden -translate-y-1/2 flex-col items-center gap-3 md:flex">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-label={s.label}
            className="group flex items-center gap-2"
          >
            <span
              className={`font-mono text-[10px] uppercase tracking-widest transition-all group-hover:opacity-100 ${
                active === s.id ? "text-ember opacity-100" : "text-porcelain/0 opacity-0"
              }`}
            >
              {s.label}
            </span>
            <span
              className={`block h-2 rounded-full transition-all ${
                active === s.id ? "w-2 bg-ember shadow-[0_0_8px_rgba(227,82,52,0.9)]" : "w-2 bg-silver/50"
              }`}
            />
          </a>
        ))}
      </div>

      {/* Top progress bar */}
      <motion.div
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 h-[3px] origin-left bg-gradient-to-r from-ember via-beacon to-ember z-50"
      />

      {/* Back to top */}
      <AnimatedTopButton visible={showTop} />
    </>
  );
}

function AnimatedTopButton({ visible }: { visible: boolean }) {
  return (
    <motion.button
      type="button"
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 12, pointerEvents: visible ? "auto" : "none" }}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 grid size-11 place-items-center rounded-full bg-rust text-porcelain shadow-lg shadow-ember/30 transition-colors hover:bg-ember cursor-pointer"
      aria-label="Back to top"
    >
      <ArrowUp className="size-5" />
    </motion.button>
  );
}