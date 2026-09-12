import * as React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Automations", href: "#automations" },
  { label: "Reels Factory", href: "#reels" },
  { label: "Live Feed", href: "#livefeed" },
  { label: "Partners", href: "#partners" },
];

export default function FacebookHeader() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 120], [0, 0.85]);
  const borderOpacity = useTransform(scrollY, [0, 120], [0, 0.12]);

  return (
    <motion.header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-16",
        "backdrop-blur-xl",
        "border-b border-white/[0.06]"
      )}
      style={{
        backgroundColor: useTransform(bgOpacity, (v) => `rgba(10,10,11,${v})`),
        borderColor: useTransform(borderOpacity, (v) => `rgba(255,255,255,${v})`),
      }}
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6 md:px-8">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#0866FF] text-sm shadow-[0_0_24px_rgba(8,102,255,0.45)]">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">
              facebook
            </span>
            <span className="text-[15px] font-light text-white/50">
              .clawdyclaw
            </span>
          </div>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/60 transition hover:text-white hover:bg-white/[0.06]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/login"
            className="rounded-full px-4 py-1.5 text-[13px] font-medium text-white/70 transition hover:text-white"
          >
            Sign In
          </a>
          <a
            href="#automations"
            className="rounded-full bg-[#0866FF] px-4 py-1.5 text-[13px] font-semibold text-white shadow-[0_0_20px_rgba(8,102,255,0.35)] transition hover:bg-[#0757d9] hover:shadow-[0_0_28px_rgba(8,102,255,0.5)]"
          >
            Deploy Factory
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg text-white/70 hover:bg-white/[0.06]"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="md:hidden absolute top-16 left-0 right-0 border-b border-white/[0.06] bg-[#0A0A0B]/95 backdrop-blur-2xl"
        >
          <nav className="flex flex-col gap-1 p-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-2.5 text-[14px] font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
              <a href="/login" className="rounded-lg px-4 py-2.5 text-[14px] font-medium text-white/70 hover:bg-white/[0.06] transition text-center">
                Sign In
              </a>
              <a href="#automations" className="rounded-full bg-[#0866FF] px-4 py-2.5 text-[14px] font-semibold text-white text-center">
                Deploy Factory
              </a>
            </div>
          </nav>
        </motion.div>
      )}
    </motion.header>
  );
}
