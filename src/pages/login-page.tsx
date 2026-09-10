"use client";

import { Bot } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import AuthCard from "@/components/auth/auth-card";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-obsidian text-porcelain">
      {/* Ambient glows + grid to match hero */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-ember/10 blur-[140px]" />
        <div className="absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-rust/20 blur-[130px]" />
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden [perspective:200px] opacity-30">
        <div className="absolute inset-0 [transform:rotateX(65deg)]">
          <div className="animate-grid [background-image:linear-gradient(to_right,theme(colors.silver)_1px,transparent_0),linear-gradient(to_bottom,theme(colors.silver)_1px,transparent_0)] [background-repeat:repeat] [background-size:56px_56px] [height:240vh] [inset:0%_0px] [margin-left:-200%] [transform-origin:100%_0_0] [width:600vw]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/80 to-transparent" />
      </div>

      <SiteHeader />

      {/* Content */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center justify-center gap-16 px-6 py-10">
        <div className="hidden max-w-sm flex-col gap-6 lg:flex">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-ember">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-beacon opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-beacon" />
            </span>
            identity bridge · online
          </div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-porcelain">
            Your session powers the <span className="text-ember">machine economy.</span>
          </h1>
          <p className="text-base leading-relaxed text-porcelain/70">
            One Google sign-in unlocks your operator console, the MCP bridge,
            and your agent settlement ledger — served by the same identity on
            clawdyclaw.com and agents.clawdyclaw.com.
          </p>
          <div className="rounded-2xl border border-silver/50 bg-rust p-5 font-mono text-xs text-porcelain">
            <div className="flex items-center gap-2 text-porcelain/80">
              <Bot className="size-4 text-ember" /> session contract
            </div>
            <pre className="mt-3 space-y-1 text-porcelain/70">
              <span className="text-green-500">"issuer"</span>: "accounts.google.com"{"\n"}
              <span className="text-green-500">"scope"</span>: openid email profile{"\n"}
              <span className="text-green-500">"aud"</span>: "clawdyclaw.<span className="text-ember">com</span>"
            </pre>
          </div>
        </div>

        <AuthCard />
      </main>

      <footer className="relative z-10 px-6 pb-6 text-center font-mono text-[11px] text-porcelain/40">
        © 2026 ClawdyClaw · OAuth 2.0 + PKCE · sessions in shared KV
      </footer>
    </div>
  );
}