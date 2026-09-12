import { Zap, Github, ExternalLink } from "lucide-react";

const footerSections = [
  {
    title: "Factory",
    links: [
      { name: "Deploy Factory-001", href: "#automations" },
      { name: "Reels Pipeline", href: "#reels" },
      { name: "Live Telemetry", href: "#livefeed" },
      { name: "Rate Limiter Docs", href: "#" },
    ],
  },
  {
    title: "Platform",
    links: [
      { name: "clawdyclaw.com", href: "https://clawdyclaw.com" },
      { name: "open.clawdyclaw", href: "https://open.clawdyclaw.com" },
      { name: "agents.clawdyclaw", href: "https://agents.clawdyclaw.com" },
      { name: "demos.clawdyclaw", href: "https://demos.clawdyclaw.com" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "FB Reels Publishing", href: "https://developers.facebook.com/docs/video-api/guides/reels-publishing" },
      { name: "Graph API v26.0", href: "https://developers.facebook.com/docs/graph-api" },
      { name: "Creator Monetization", href: "https://www.facebook.com/legal/creator/monetization_terms" },
      { name: "GitHub Repos", href: "https://github.com" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy Policy", href: "#" },
      { name: "Terms of Service", href: "#" },
      { name: "Meta Platform Terms", href: "#" },
      { name: "Cookie Policy", href: "#" },
    ],
  },
];

export default function FacebookFooter() {
  return (
    <footer className="relative border-t border-white/[0.06]">
      {/* Large stroke text */}
      <div className="relative w-full flex justify-center items-end pt-16 md:pt-20 pb-0 overflow-hidden">
        <h1 className="text-[80px] sm:text-[120px] md:text-[160px] lg:text-[200px] font-bold text-transparent leading-[0.75] select-none -mb-2 md:-mb-4 opacity-[0.04]"
          style={{ WebkitTextStroke: "1px rgba(255,255,255,0.3)" }}
        >
          clawdyclaw
        </h1>
      </div>

      {/* Main footer content */}
      <div className="relative z-10 bg-[#0866FF]/[0.08] border-t border-[#0866FF]/[0.10]">
        <div className="mx-auto max-w-[1200px] px-6 md:px-8 py-16 md:py-20">
          <div className="grid grid-cols-2 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-10 md:gap-8">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#0866FF] text-sm shadow-[0_0_24px_rgba(8,102,255,0.45)]">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[14px] font-semibold text-white">facebook</span>
                  <span className="text-[14px] font-light text-white/50">.clawdyclaw</span>
                </div>
              </div>
              <p className="text-[13px] text-white/40 leading-relaxed max-w-[240px]">
                Autonomous Facebook Reels factory powered by HITL-gated
                subagent loops on Cloudflare Workers.
              </p>

              <div className="flex items-center gap-3 mt-6">
                <a
                  href="https://github.com"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white hover:bg-white/[0.08] transition"
                >
                  <Github className="h-4 w-4" />
                </a>
                <a
                  href="https://clawdyclaw.com"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white hover:bg-white/[0.08] transition"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Link columns */}
            {footerSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-[13px] font-semibold text-white/70 mb-4">
                  {section.title}
                </h3>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        className="text-[12px] text-white/35 hover:text-white/70 transition"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-14 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-white/25">
              © 2026 ClawdyClaw. All rights reserved. Not affiliated with Meta Platforms, Inc.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="/.well-known/mcp.json"
                className="text-[10px] font-mono text-white/20 hover:text-white/40 transition"
              >
                /.well-known/mcp.json
              </a>
              <a
                href="/api/ai-plugin.json"
                className="text-[10px] font-mono text-white/20 hover:text-white/40 transition"
              >
                /ai-plugin.json
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
