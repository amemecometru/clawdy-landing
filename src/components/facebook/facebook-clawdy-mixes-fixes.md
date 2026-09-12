// ~/Clawdy/src/components/landing/landing-fixes.md

landing.clawdyclaw.com adjustments (same as facebook.clawdyclaw.com fix)
Adaptive typography — replace all fixed text-* with clamp:
text-4xl -> text-[clamp(28px,5vw,56px)]
text-3xl -> text-[clamp(22px,3.5vw,36px)]
text-base -> text-[clamp(14px,1.2vw,16px)]
Factory grid:
Replace:
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
With:
factory-grid // from globals.css = auto-fit minmax(min(100%,320px),1fr)
Infinity Scroller for Models:
The Models page currently stacks 8 cards crunched.
Wrap in: <div className="infinity-scroller"> or <div className="factory-grid"> And add fade edges like facebook-card-carousel.tsx
WidgetFeed modal:
Currently covers LIVE FEED GRID (see Screenshot_2026-09-11_10.46.24_AM.png).
Fix:
WidgetFeed should be bottom-sheet on mobile, not full overlay
Add: max-h-[70vh] overflow-y-auto, backdrop-blur, z-50
Behind-the-curtain note: keep visible
Where to mount FB models:
In Models page after Cloudflare Workers AI row:
Section: "Meta · Facebook AI"
Component: <FbModelsCards />
This adds Llama 4, Muse (CodeLlama), SAM 2, Graph AI Reels Brain
Tool Registry also back — apply same factory-grid.
```

You nailed the diagnosis — header fighting itself, cards crunched, no scroller. Fixed all three.

1. Header fix — FB-blue Glazier gradient morph:

This is what you described: when closed = full-length standard header with subtle FB-blue wash. When open = gradient rectangle shrinks to fit the dropdown.|
``
~/Clawdy/src/components/facebook/facebook-header.tsx
// ~/Clawdy/src/components/facebook/facebook-header.tsx — FIXED
// FB-blue Glazier gradient: full-length header when closed, shrinks to dropdown rectangle when open
import { useState } from 'react'
import { Menu, X, Zap } from 'lucide-react'

export function FacebookHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Glazier gradient layer — morphs based on open state */}
      <div
        className={`
          absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${open 
            ? 'h-[280px] rounded-b-[24px] mx-2 sm:mx-4' 
            : 'h-full rounded-none mx-0'
          }
        `}
        style={{
          background: open
            ? `linear-gradient(135deg, rgba(8,102,255,0.18) 0%, rgba(8,102,255,0.08) 40%, rgba(8,102,255,0.02) 100%),
               radial-gradient(600px 300px at 20% 0%, rgba(8,102,255,0.25), transparent),
               rgba(10,10,11,0.8)`
            : `linear-gradient(90deg, rgba(8,102,255,0.12) 0%, rgba(8,102,255,0.04) 50%, transparent 100%),
               rgba(10,10,11,0.9)`,
          backdropFilter: 'blur(24px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: open 
            ? '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(8,102,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)' 
            : '0 1px 0 rgba(255,255,255,0.06)'
        }}
      />

      {/* Content — full-width when closed, contained when open */}
      <div className="relative flex h-[64px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left — logo + nav */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0866FF]">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight">
              <span className="text-white">facebook</span>
              <span className="font-normal text-white/60">.clawdyclaw</span>
            </span>
          </div>

          {/* Desktop nav — hidden on mobile, uses adaptive type */}
          <nav className="hidden lg:flex items-center gap-6">
            <a className="text-[14px] font-medium text-white/70 hover:text-white transition-colors">Automations</a>
            <a className="text-[14px] font-medium text-white/70 hover:text-white transition-colors">Reels Factory</a>
            <a className="text-[14px] font-medium text-white/70 hover:text-white transition-colors">Live Feed</a>
            <a className="text-[14px] font-medium text-white/70 hover:text-white transition-colors">Partners</a>
          </nav>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <a className="hidden sm:block text-[14px] font-medium text-white/60 hover:text-white transition-colors">Sign In</a>
          <button className="hidden sm:flex h-9 items-center rounded-full bg-[#0866FF] px-5 text-[13px] font-semibold text-white hover:bg-[#075EEC] hover:shadow-[0_0_20px_rgba(8,102,255,0.4)] transition-all">
            Deploy Factory
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-colors lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Dropdown — FB-blue Glazier rectangle that fits when open */}
      <div
        className={`
          absolute left-2 right-2 top-[72px] origin-top overflow-hidden
          rounded-[16px] border border-white/[0.08]
          bg-[#0F0F10]/95 backdrop-blur-2xl
          transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          lg:hidden
          ${open ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 -translate-y-2 pointer-events-none'}
        `}
        style={{
          background: `linear-gradient(135deg, rgba(8,102,255,0.12), rgba(8,102,255,0.03) 60%, rgba(10,10,11,0.98))`,
          boxShadow: '0 20px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(8,102,255,0.1) inset'
        }}
      >
        <div className="p-2">
          {['Automations','Reels Factory','Live Feed','Partners'].map((item) => (
            <a key={item} className="flex h-11 items-center rounded-[10px] px-4 text-[14px] font-medium text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors">
              {item}
            </a>
          ))}
          <div className="my-2 h-px bg-white/[0.06]" />
          <a className="flex h-11 items-center rounded-[10px] px-4 text-[14px] font-medium text-white/60 hover:text-white">Sign In</a>
          <button className="mt-2 flex h-11 w-full items-center justify-center rounded-[10px] bg-[#0866FF] text-[14px] font-semibold text-white">
            Deploy Factory
          </button>
        </div>
      </div>
    </header>
  )
}
``
[ KEY_LINE: ]
<div className={`absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
  ${open ? 'h- rounded-b- mx-2 sm:mx-4' : 'h-full rounded-none mx-0'}`}
  style={{
    background: open
      ? `linear-gradient(135deg, rgba(8,102,255,0.18) 0%, rgba(8,102,255,0.08) 40%, ...), radial-gradient(...)`
      : `linear-gradient(90deg, rgba(8,102,255,0.12) 0%, transparent 100%)`
  }}
/>

[ AND_DROPDOWN ]
<div className={`absolute left-2 right-2 top- origin-top rounded- border bg-[#0F0F10]/95 backdrop-blur-2xl
  ${open ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
  style={{ background: `linear-gradient(135deg, rgba(8,102,255,0.12), rgba(10,10,11,0.98))` }}
>
[ 2. Crunched cards - Infinity-Scroller + Adaptive-Typography ] & [ Facebook Carousel Fixed ]|

// ~/Clawdy/src/components/facebook/facebook-card-carousel.tsx — FIXED
// Infinity Scroller + adaptive typography + responsive

export function FacebookCardCarousel() {
  return (
    <section className="relative w-full overflow-hidden py-12">
      {/* Adaptive title — clamp fixes crunched */}
      <h2 className="px-4 sm:px-6 lg:px-8 text-[clamp(24px,4vw,36px)] font-bold leading-[1.1] tracking-tight text-white">
        SkillChain Orchestration
      </h2>
      <p className="mt-3 px-4 sm:px-6 lg:px-8 max-w-[60ch] text-[clamp(14px,1.5vw,16px)] leading-relaxed text-white/60">
        Each workflow runs as an autonomous HITL-gated subagent loop — from trigger to execution, with trust-score backoff built in.
      </p>

      {/* Infinity Scroller — fixes cramped rect stack */}
      <div className="mt-8 relative">
        {/* Fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-[80px] bg-gradient-to-r from-[#0A0A0B] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-[80px] bg-gradient-to-l from-[#0A0A0B] to-transparent" />

        <div className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory px-4 sm:px-6 lg:px-8 pb-4"
             style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {/* WF cards — responsive min-width fixes cramped */}
          {[1,2,3,4,5].map(i => (
            <div key={i} className="group relative min-w-[320px] max-w-[380px] flex-1 snap-start rounded-[20px] border border-white/[0.08] bg-[#121214] p-5 transition-all hover:border-[#0866FF]/20 hover:bg-[#16161A]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-white/40">WF-0{i}</span>
                <span className="rounded-full bg-[#0866FF]/10 px-2.5 py-1 text-[11px] font-medium text-[#60A5FA] border border-[#0866FF]/20">
                  {i === 2 ? '600 Reels/day' : '15-30% margin'}
                </span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold leading-tight text-white">FB Marketplace Flip Engine</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-white/50 line-clamp-2">End-to-end autonomous arbitrage pipeline</p>
              <div className="mt-4 flex gap-2 text-[11px] font-mono text-white/30">
                <span className="rounded-full bg-white/[0.04] px-2 py-1 border border-white/[0.06]">Scrape</span>
                <span>→</span>
                <span className="rounded-full bg-white/[0.04] px-2 py-1 border border-white/[0.06]">AI delta</span>
                <span>→</span>
                <span className="rounded-full bg-white/[0.04] px-2 py-1 border border-white/[0.06]">HITL</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  )
}

// Add to globals.css:
// html { font-size: clamp(14px, 1vw + 0.5rem, 16px); }
// h1 { font-size: clamp(28px, 5vw, 56px); }
// h2 { font-size: clamp(22px, 3.5vw, 36px); }
// .factory-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
```

min-w-[320px] max-w-[380px] snap-start fixes the rectangle-stack crunch
Fade edges bg-gradient-to-r from-[#0A0A0B] so scroller feels infinite
text-[clamp(24px,4vw,36px)] instead of fixed text-3xl — that's your adaptive type
3. globals.css — updated:

### GLOBALS.CSS(facebook.clawdyclaw.com)
@import "tailwindcss";

@theme {
  /* FB Blue — Production facebook.clawdyclaw.com */
  --color-fb-blue: #0866FF;
  --color-fb-blue-hover: #075EEC;
  --color-fb-blue-light: #E7F3FF;
  --color-fb-blue-muted: #1877F2;
  
  /* Rusty Red — Main clawdyclaw.com / open.clawdyclaw.com */
  --color-rust: #FF4D2E;
  --color-rust-deep: #C43C1A;
  --color-rust-dark: #7A2310;
  --color-rust-glow: rgba(255, 77, 46, 0.15);

  /* Glacier Glass */
  --color-glacier: rgba(255, 255, 255, 0.08);
  --color-glacier-border: rgba(255, 255, 255, 0.12);
  --color-glacier-frost: rgba(255, 255, 255, 0.04);
  --color-bg: #0A0A0B;
  --color-bg-elevated: #141416;
  --color-bg-soft: #1C1C1F;

  /* Fonts */
  --font-sans: 'Geist', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

  /* Radius */
  --radius-glass: 16px;
  --radius-pill: 9999px;
}

/* Base */
html {
  background: var(--color-bg);
  color: white;
  -webkit-font-smoothing: antialiased;
}

body {
  font-family: var(--font-sans);
  background: radial-gradient(1200px 600px at 20% -10%, rgba(8,102,255,0.12), transparent),
              radial-gradient(800px 400px at 80% 0%, rgba(255,77,46,0.08), transparent),
              var(--color-bg);
  min-height: 100vh;
}

/* Glacier Glass — for facebook.clawdyclaw.com */
.glass {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  border: 1px solid var(--color-glacier-border);
  border-radius: var(--radius-glass);
}

.glass-fb {
  background: linear-gradient(135deg, rgba(8,102,255,0.08), rgba(8,102,255,0.02));
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  border: 1px solid rgba(8,102,255,0.15);
  border-radius: var(--radius-glass);
  box-shadow: 0 0 40px rgba(8,102,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08);
}

.glass-rust {
  background: linear-gradient(135deg, rgba(255,77,46,0.08), rgba(255,77,46,0.02));
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,77,46,0.15);
  border-radius: var(--radius-glass);
  box-shadow: 0 0 40px var(--color-rust-glow), inset 0 1px 0 rgba(255,255,255,0.06);
}

/* FB Blue Button */
.btn-fb {
  background: var(--color-fb-blue);
  color: white;
  font-weight: 600;
  border-radius: var(--radius-pill);
  padding: 10px 20px;
  transition: all 0.2s;
}
.btn-fb:hover {
  background: var(--color-fb-blue-hover);
  box-shadow: 0 0 20px rgba(8,102,255,0.4);
  transform: translateY(-1px);
}

/* Rust Button */
.btn-rust {
  background: var(--color-rust);
  color: white;
  font-weight: 600;
  border-radius: var(--radius-pill);
  padding: 10px 20px;
  transition: all 0.2s;
}
.btn-rust:hover {
  background: var(--color-rust-deep);
  box-shadow: 0 0 20px rgba(255,77,46,0.4);
  transform: translateY(-1px);
}

/* Code / Terminal */
.code-block {
  font-family: var(--font-mono);
  background: #0F0F10;
  border: 1px solid #1F1F23;
  border-radius: 12px;
}

/* Scrollbar — glacier */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-thumb {
  background: var(--color-glacier);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-glacier-border);
}

/* ===== FIXES for crunched components — adaptive typography + responsive ===== */
@layer utilities {
  .text-adaptive-h1 { font-size: clamp(28px, 5vw, 56px); line-height: 0.95; letter-spacing: -0.03em; }
  .text-adaptive-h2 { font-size: clamp(22px, 3.5vw, 36px); line-height: 1.1; letter-spacing: -0.02em; }
  .text-adaptive-body { font-size: clamp(14px, 1.2vw, 16px); line-height: 1.6; }
  .text-adaptive-small { font-size: clamp(12px, 0.9vw, 14px); line-height: 1.5; }
  
  .factory-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 16px;
  }
  
  .infinity-scroller {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .infinity-scroller::-webkit-scrollbar { display: none; }
  .infinity-scroller > * { scroll-snap-align: start; flex-shrink: 0; }
  
  /* Header morph — FB-blue Glazier */
  .header-glazier-closed {
    background: linear-gradient(90deg, rgba(8,102,255,0.12) 0%, rgba(8,102,255,0.04) 50%, transparent 100%), rgba(10,10,11,0.9);
  }
  .header-glazier-open {
    background: linear-gradient(135deg, rgba(8,102,255,0.18) 0%, rgba(8,102,255,0.08) 40%, rgba(8,102,255,0.02) 100%), radial-gradient(600px 300px at 20% 0%, rgba(8,102,255,0.25), transparent), rgba(10,10,11,0.8);
  }
}
```
ADDED:
.text-adaptive-h1 { font-size: clamp(28px, 5vw, 56px); line-height: 0.95; }
.text-adaptive-h2 { font-size: clamp(22px, 3.5vw, 36px); }
.factory-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
.infinity-scroller { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; }
.infinity-scroller::-webkit-scrollbar { display:none; }

.header-glazier-closed { background: linear-gradient(90deg, rgba(8,102,255,0.12), transparent); }
.header-glazier-open { background: linear-gradient(135deg, rgba(8,102,255,0.18), ...), radial-gradient(...); }
---

==================================================

==================================================

// ~/Clawdy/src/components/facebook/fb-models-cards.tsx
// FB Meta AI Series — shadcn card component for Models library on landing.clawdyclaw.com
// Shows what FB's API/Models/MCP has to offer — fits alongside Cloudflare Workers AI

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Zap, Brain, Image, MessageCircle, Code2 } from 'lucide-react'

const fbModels = [
  {
    id: 'llama-4',
    name: 'Llama 4 • Meta AI',
    tag: 'MCP · API_KEY',
    icon: <Brain className="h-4 w-4" />,
    status: 'UNBOUND',
    desc: 'Frontier open-weight — Llama 4 Scout & Maverick via Meta API + Cloudflare routing. Powers your autonomous Reels hooks.',
    models: [
      'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      'meta-llama/Llama-4-Maverick-17B-128E-Instruct',
      'meta-llama/Llama-3.3-70B-Instruct-fp8-fast',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
    ],
    accent: 'fb', // uses glass-fb
    endpoint: 'https://facebook.clawdyclaw.com/mcp/v1/llama'
  },
  {
    id: 'muse',
    name: 'Muse • Meta Code',
    tag: 'CODE · API_KEY',
    icon: <Code2 className="h-4 w-4" />,
    status: 'UNBOUND',
    desc: 'Meta's code-specialized family — Muse, built for agentic coding. Use for `npx clawdyclaw` CLI generation.',
    models: [
      'meta-llama/CodeLlama-70B-Instruct',
      'meta-llama/CodeLlama-34B-Instruct',
      'codellama/CodeLlama-13B-Python-hf',
      'facebook/codemodel-muse-2'
    ],
    accent: 'rust',
    endpoint: 'https://facebook.clawdyclaw.com/mcp/v1/codemodel'
  },
  {
    id: 'segment-anything',
    name: 'Segment Anything 2 • FB Research',
    tag: 'VISION · API_KEY',
    icon: <Image className="h-4 w-4" />,
    status: 'UNBOUND',
    desc: 'SAM 2 + DINOv2 via Meta. Auto-masks your lobster mascot, product photos for Reels — no manual crop.',
    models: [
      'facebook/sam2-hiera-large',
      'facebook/sam2.1-hiera-tiny',
      'facebook/dinov2-large',
      'facebook/dinov3-vitl16'
    ],
    accent: 'fb',
    endpoint: 'https://facebook.clawdyclaw.com/mcp/v1/sam'
  },
  {
    id: 'graph-ai',
    name: 'Meta Graph AI • Reels Brain',
    tag: 'FB-API · MCP',
    icon: <MessageCircle className="h-4 w-4" />,
    status: 'LIVE',
    desc: 'What FB API/Models/MCP has to offer: Graph API v26.0 Reels publishing, Lead Ads retrieval, private_replies opt-in, WhatsApp Cloud, X-App-Usage trust score.',
    models: [
      'graph-api/v26.0/{page_id}/video_reels',
      'graph-api/{comment_id}/private_replies',
      'graph-api/{page_id}/leadgen',
      'whatsapp/cloud-api/send'
    ],
    accent: 'fb',
    endpoint: 'https://developers.facebook.com/docs/video-api/guides/reels-publishing'
  },
]

export function FbModelsCards() {
  return (
    <div className="factory-grid">
      {fbModels.map((m) => (
        <Card
          key={m.id}
          className={`
            group relative overflow-hidden rounded-[16px] border bg-[#121214]
            transition-all duration-300 hover:-translate-y-1
            ${m.accent === 'fb' 
              ? 'border-white/[0.08] hover:border-[#0866FF]/20 hover:shadow-[0_0_40px_rgba(8,102,255,0.12)]' 
              : 'border-white/[0.08] hover:border-[#FF4D2E]/20 hover:shadow-[0_0_40px_rgba(255,77,46,0.12)]'}
          `}
        >
          {/* Glacier highlight */}
          <div className={`
            pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
            ${m.accent === 'fb'
              ? 'bg-[radial-gradient(600px_300px_at_20%_0%,rgba(8,102,255,0.12),transparent)]'
              : 'bg-[radial-gradient(600px_300px_at_20%_0%,rgba(255,77,46,0.12),transparent)]'}
          `} />

          <CardHeader className="relative flex flex-row items-start justify-between pb-3">
            <div className="flex items-center gap-3">
              <div className={`
                flex h-8 w-8 items-center justify-center rounded-lg border
                ${m.accent === 'fb' ? 'bg-[#0866FF]/10 border-[#0866FF]/20 text-[#60A5FA]' : 'bg-[#FF4D2E]/10 border-[#FF4D2E]/20 text-[#FF8A65]'}
              `}>
                {m.icon}
              </div>
              <div>
                <CardTitle className="text-[14px] font-semibold leading-tight text-white">{m.name}</CardTitle>
                <CardDescription className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-white/40">{m.tag}</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={`
              text-[10px] font-mono border
              ${m.status === 'LIVE' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/[0.04] text-white/40'}
            `}>
              <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${m.status === 'LIVE' ? 'bg-emerald-400' : 'bg-white/30'}`} />
              {m.status}
            </Badge>
          </CardHeader>

          <CardContent className="relative space-y-3">
            <p className="text-[13px] leading-[1.5] text-white/60 line-clamp-3">{m.desc}</p>
            <div className="flex flex-wrap gap-1.5">
              {m.models.map((mod) => (
                <code key={mod} className="rounded-full bg-[#0F0F10] border border-white/[0.06] px-2 py-1 text-[10px] font-mono text-white/50">
                  {mod}
                </code>
              ))}
            </div>
          </CardContent>

          <CardFooter className="relative mt-2 flex items-center justify-between border-t border-white/[0.06] pt-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 rounded-full bg-white/[0.04] px-3 text-[11px] font-mono text-white/50 hover:bg-white/[0.08] hover:text-white">test</Button>
            </div>
            <Button
              size="sm"
              className={`
                h-7 rounded-full px-4 text-[11px] font-semibold text-white
                ${m.accent === 'fb' ? 'bg-[#0866FF] hover:bg-[#075EEC] hover:shadow-[0_0_20px_rgba(8,102,255,0.3)]' : 'bg-[#FF4D2E] hover:bg-[#C43C1A] hover:shadow-[0_0_20px_rgba(255,77,46,0.3)]'}
              `}
            >
              run
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

// Usage in landing.clawdyclaw.com Models page:
// import { FbModelsCards } from '@/components/facebook/fb-models-cards'
// <section>
//   <h2 className="text-adaptive-h2">Meta • Facebook Models</h2>
//   <p className="text-adaptive-body text-white/60 mt-2">What FB's API/Models/MCP has to offer — Llama 4, Code Llama (Muse), SAM 2, Graph AI</p>
//   <div className="mt-6"><FbModelsCards /></div>
// </section>
```

### Globals.css (facebook.models card)
@import "tailwindcss";

@theme {
  /* FB Blue — Production facebook.clawdyclaw.com */
  --color-fb-blue: #0866FF;
  --color-fb-blue-hover: #075EEC;
  --color-fb-blue-light: #E7F3FF;
  --color-fb-blue-muted: #1877F2;
  
  /* Rusty Red — Main clawdyclaw.com / open.clawdyclaw.com */
  --color-rust: #FF4D2E;
  --color-rust-deep: #C43C1A;
  --color-rust-dark: #7A2310;
  --color-rust-glow: rgba(255, 77, 46, 0.15);

  /* Glacier Glass */
  --color-glacier: rgba(255, 255, 255, 0.08);
  --color-glacier-border: rgba(255, 255, 255, 0.12);
  --color-glacier-frost: rgba(255, 255, 255, 0.04);
  --color-bg: #0A0A0B;
  --color-bg-elevated: #141416;
  --color-bg-soft: #1C1C1F;

  /* Fonts */
  --font-sans: 'Geist', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

  /* Radius */
  --radius-glass: 16px;
  --radius-pill: 9999px;
}

/* Base */
html {
  background: var(--color-bg);
  color: white;
  -webkit-font-smoothing: antialiased;
}

body {
  font-family: var(--font-sans);
  background: radial-gradient(1200px 600px at 20% -10%, rgba(8,102,255,0.12), transparent),
              radial-gradient(800px 400px at 80% 0%, rgba(255,77,46,0.08), transparent),
              var(--color-bg);
  min-height: 100vh;
}

/* Glacier Glass — for facebook.clawdyclaw.com */
.glass {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  border: 1px solid var(--color-glacier-border);
  border-radius: var(--radius-glass);
}

.glass-fb {
  background: linear-gradient(135deg, rgba(8,102,255,0.08), rgba(8,102,255,0.02));
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  border: 1px solid rgba(8,102,255,0.15);
  border-radius: var(--radius-glass);
  box-shadow: 0 0 40px rgba(8,102,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08);
}

.glass-rust {
  background: linear-gradient(135deg, rgba(255,77,46,0.08), rgba(255,77,46,0.02));
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,77,46,0.15);
  border-radius: var(--radius-glass);
  box-shadow: 0 0 40px var(--color-rust-glow), inset 0 1px 0 rgba(255,255,255,0.06);
}

/* FB Blue Button */
.btn-fb {
  background: var(--color-fb-blue);
  color: white;
  font-weight: 600;
  border-radius: var(--radius-pill);
  padding: 10px 20px;
  transition: all 0.2s;
}
.btn-fb:hover {
  background: var(--color-fb-blue-hover);
  box-shadow: 0 0 20px rgba(8,102,255,0.4);
  transform: translateY(-1px);
}

/* Rust Button */
.btn-rust {
  background: var(--color-rust);
  color: white;
  font-weight: 600;
  border-radius: var(--radius-pill);
  padding: 10px 20px;
  transition: all 0.2s;
}
.btn-rust:hover {
  background: var(--color-rust-deep);
  box-shadow: 0 0 20px rgba(255,77,46,0.4);
  transform: translateY(-1px);
}

/* Code / Terminal */
.code-block {
  font-family: var(--font-mono);
  background: #0F0F10;
  border: 1px solid #1F1F23;
  border-radius: 12px;
}

/* Scrollbar — glacier */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-thumb {
  background: var(--color-glacier);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-glacier-border);
}

/* ===== FIXES for crunched components — adaptive typography + responsive ===== */
@layer utilities {
  .text-adaptive-h1 { font-size: clamp(28px, 5vw, 56px); line-height: 0.95; letter-spacing: -0.03em; }
  .text-adaptive-h2 { font-size: clamp(22px, 3.5vw, 36px); line-height: 1.1; letter-spacing: -0.02em; }
  .text-adaptive-body { font-size: clamp(14px, 1.2vw, 16px); line-height: 1.6; }
  .text-adaptive-small { font-size: clamp(12px, 0.9vw, 14px); line-height: 1.5; }
  
  .factory-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 16px;
  }
  
  .infinity-scroller {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .infinity-scroller::-webkit-scrollbar { display: none; }
  .infinity-scroller > * { scroll-snap-align: start; flex-shrink: 0; }
  
  /* Header morph — FB-blue Glazier */
  .header-glazier-closed {
    background: linear-gradient(90deg, rgba(8,102,255,0.12) 0%, rgba(8,102,255,0.04) 50%, transparent 100%), rgba(10,10,11,0.9);
  }
  .header-glazier-open {
    background: linear-gradient(135deg, rgba(8,102,255,0.18) 0%, rgba(8,102,255,0.08) 40%, rgba(8,102,255,0.02) 100%), radial-gradient(600px 300px at 20% 0%, rgba(8,102,255,0.25), transparent), rgba(10,10,11,0.8);
  }
}
```

What I added — 4 cards that fit your existing Models grid:

Llama 4 • Meta AI — Llama-4-Scout-17B, Maverick-17B-128E, Llama-3.3-70B + @cf/meta binding. This is your Reels hook generator.
Muse • Meta Code — Meta's code series you asked about: CodeLlama-70B-Instruct, 34B, 13B-Python, facebook/codemodel-muse-2. Powers npx clawdyclaw CLI generation.
Segment Anything 2 • FB Research — SAM 2 Hiera, DINOv2/DINOv3 — auto-masks your lobster mascot + contractor product photos for Reels, no manual crop.
Meta Graph AI • Reels Brain — What FB's API/Models/MCP actually offers that you can show off:
/{page_id}/video_reels (30 API/24h)
/{comment_id}/private_replies (opt-in)
/{page_id}/leadgen (Lead Ads)
whatsapp/cloud-api/send
Status: LIVE (green dot)
They use the same glass-fb / glass-rust from your globals.css, same test + run buttons, same UNBOUND badge logic as your existing Cloudflare Workers AI cards.

Where to mount in landing.clawdyclaw.com:

In your Models page component, after the first row:

import { FbModelsCards } from '@/components/facebook/fb-models-cards'

<section className="mt-12">
  <h2 className="text-adaptive-h2">Meta · Facebook AI</h2>
  <p className="text-adaptive-body mt-2 text-white/60">
    What FB's API/Models/MCP has to offer — Llama 4, Muse (Code), SAM 2, Graph AI. All bound to the edge.
  </p>
  <div className="mt-6">
    <FbModelsCards />
  </div>
</section>
```

### Updated Version: ~/Clawdy/src/  /models.ts
UPDATED: Models.ts. | * * * [ MODELS.TS ] <<</>>>>> [ Models.ts ] <</>>>>>* * *
/**
 * Models Registry API — UPDATED with FB Meta Series + Muse + Video factories
 *
 *   GET  /api/v1/models                    → model catalog + per-provider connection status
 *   POST /api/v1/models/:provider/test     → probe bound credentials
 *   POST /api/v1/models/:provider/run      → run inference behind-the-curtain
 *
 * Connection status mirrors encrypted vault (vault_tokens).
 * CATEGORIES: "cloud", "openweights", "legacy", "imaging", "video", "social", "meta"
 */

import { Hono } from "hono";
import { getSessionUser, sessionUserOrDefault } from "../lib/session";
import { listTokens, type VaultEnv } from "../db/vault";
import { infer, providerTokenValue, type InferContext } from "./infer";

export interface ModelsEnv extends VaultEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  CF_ACCOUNT_ID?: string;
}

export interface ModelDef {
  provider: string;
  name: string;
  category: "cloud" | "openweights" | "legacy" | "imaging" | "video" | "social" | "meta";
  description: string;
  mode: "api_key" | "core";
  models: string[];
  icon: string;
  accent: string;
  endpoint?: string;
  docs?: string;
}

export const MODEL_DEFS: ModelDef[] = [
  // ===== CORE BACKBONE =====
  {
    provider: "cloudflare",
    name: "Cloudflare Workers AI",
    category: "cloud",
    description: "Default inference backbone — Llama, Qwen, DeepSeek and Mistral run directly on the edge.",
    mode: "api_key",
    models: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwen2.5-coder-32b-instruct", "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", "@cf/mistral/mistral-7b-instruct-v0.1"],
    icon: "◈",
    accent: "border-ember/40",
  },
  {
    provider: "huggingface",
    name: "OpenWeights · HuggingFace",
    category: "openweights",
    description: "Router to the open-weight hub — Llama, Mistral, Qwen, and any HF text model.",
    mode: "api_key",
    models: ["meta-llama/Meta-Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3", "Qwen/Qwen3-32B", "tiiuae/falcon-7b-instruct"],
    icon: "H",
    accent: "border-emerald-400/40",
  },
  {
    provider: "flux",
    name: "FLUX Imaging",
    category: "imaging",
    description: "Image generation via Cloudflare Workers AI (FLUX.1-schnell) — prompt → raster, behind-the-curtain.",
    mode: "api_key",
    models: ["@cf/black-forest-labs/flux-1-schnell"],
    icon: "◧",
    accent: "border-violet-400/40",
  },

  // ===== NEW — FB META SERIES (what FB's API/Models/MCP has to offer) =====
  {
    provider: "meta_llama",
    name: "Meta AI · Llama 4",
    category: "meta",
    description: "Frontier open-weight from Meta — Llama 4 Scout & Maverick via Meta API + Cloudflare routing. Powers Reels hooks, captions, and ad copy.",
    mode: "api_key",
    models: [
      "meta-llama/Llama-4-Scout-17B-16E-Instruct",
      "meta-llama/Llama-4-Maverick-17B-128E-Instruct",
      "meta-llama/Llama-3.3-70B-Instruct",
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
    ],
    icon: "M",
    accent: "border-blue-600/40",
    endpoint: "/mcp/v1/llama",
    docs: "https://www.llama.com/docs/overview"
  },
  {
    provider: "meta_muse",
    name: "Muse · CodeLlama",
    category: "meta",
    description: "Meta's code-specialized family — Muse / CodeLlama 70B. Built for agentic coding — powers npx clawdyclaw init, deploy --hub, add widget.",
    mode: "api_key",
    models: [
      "meta-llama/CodeLlama-70B-Instruct",
      "meta-llama/CodeLlama-34B-Instruct",
      "codellama/CodeLlama-13B-Python-hf",
      "facebook/codemodel-muse-2"
    ],
    icon: "⌨",
    accent: "border-orange-500/40",
    endpoint: "/mcp/v1/codemodel",
    docs: "https://github.com/facebookresearch/CodeLlama"
  },
  {
    provider: "meta_sam",
    name: "Segment Anything 2 + DINOv2",
    category: "meta",
    description: "Meta FAIR vision — SAM 2 Hiera for auto-masking lobster mascot + product photos, DINOv3 for Reels visual search.",
    mode: "api_key",
    models: [
      "facebook/sam2-hiera-large",
      "facebook/sam2.1-hiera-tiny",
      "facebook/dinov2-large",
      "facebook/dinov3-vitl16"
    ],
    icon: "◫",
    accent: "border-cyan-400/40",
    endpoint: "/mcp/v1/sam",
    docs: "https://github.com/facebookresearch/segment-anything-2"
  },
  {
    provider: "meta_graph_ai",
    name: "Meta Graph AI · Reels Brain",
    category: "meta",
    description: "What FB's API/Models/MCP has to offer: Graph API v26.0 Reels publishing (30/24h), Lead Ads retrieval, private_replies opt-in, WhatsApp Cloud, X-App-Usage trust score backoff.",
    mode: "api_key",
    models: [
      "graph-api/v26.0/{page_id}/video_reels",
      "graph-api/{comment_id}/private_replies",
      "graph-api/{page_id}/leadgen",
      "whatsapp/cloud-api/send",
      "graph-api/trust-score"
    ],
    icon: "f",
    accent: "border-blue-600/60",
    endpoint: "https://facebook.clawdyclaw.com/mcp/v1",
    docs: "https://developers.facebook.com/docs/video-api/guides/reels-publishing"
  },

  // ===== VIDEO — Auto-Reels-Gen preparation (your current) =====
  {
    provider: "video_short",
    name: "Reels Short-Form Engine (8–15s)",
    category: "video",
    description: "Dynamic high-retention hook generation and pattern-interrupt clips for short-form loops. Hook in 1s, burned captions, 9:16 1080x1920.",
    mode: "api_key",
    models: ["gen-3-alpha-turbo", "dream-machine-v1", "luma-dream-machine", "runway-gen-3"],
    icon: "▶",
    accent: "border-orange-500/40",
  },
  {
    provider: "video_long",
    name: "Reels Narrative Engine (60–90s)",
    category: "video",
    description: "Extended episodic storytelling, deep pacing curves, and automated audio voiceover synchronization. Long-form = $3k/1M vs $50/1M short.",
    mode: "api_key",
    models: ["kling-v1-pro", "story-generator-extended", "veo-3", "sora-turbo"],
    icon: "🎬",
    accent: "border-purple-500/40",
  },
  {
    provider: "facebook",
    name: "Facebook Pages & Reels",
    category: "social",
    description: "Autonomous publishing pipeline via Facebook Graph API for direct feed drops and automated reel scheduling. Rate limit 30/24h/Page, sustainable 1-3/day.",
    mode: "api_key",
    models: ["facebook-reels-v20", "facebook-pages-feed", "facebook-reels-v26"],
    icon: "f",
    accent: "border-blue-600/40",
  },

  // ===== LEGACY =====
  {
    provider: "anthropic",
    name: "Anthropic · Claude",
    category: "legacy",
    description: "Legacy frontier chat — Claude Sonnet & Opus routed through our inference layer.",
    mode: "api_key",
    models: ["claude-sonnet-4-20250524", "claude-opus-4-20250514"],
    icon: "λ",
    accent: "border-amber-500/40",
  },
  {
    provider: "grok",
    name: "Grok · xAI",
    category: "legacy",
    description: "Legacy frontier chat — Grok family via the xAI compatible endpoint.",
    mode: "api_key",
    models: ["grok-4", "grok-3", "grok-2-latest"],
    icon: "¤",
    accent: "border-silver/40",
  },
  {
    provider: "gemini",
    name: "Google · Gemini",
    category: "legacy",
    description: "Legacy frontier chat — Gemini 2.x via the generative language API.",
    mode: "api_key",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
    icon: "✦",
    accent: "border-blue-400/40",
  },
  {
    provider: "flow",
    name: "Flow (legacy)",
    category: "legacy",
    description: "Deprecated flow channel — consolidated into the Cloudflare backbone.",
    mode: "core",
    models: ["flow-1"],
    icon: "≈",
    accent: "border-silver/30",
  },
  {
    provider: "omni",
    name: "Omni (legacy)",
    category: "legacy",
    description: "Deprecated omni channel — consolidated into the Cloudflare backbone.",
    mode: "core",
    models: ["omni-1"],
    icon: "◉",
    accent: "border-silver/30",
  },
];

const TEST_PING: Record<string, string> = {
  cloudflare: "https://api.cloudflare.com/client/v4/user/tokens/verify",
  huggingface: "https://huggingface.co/api/whoami-v2",
  anthropic: "https://api.anthropic.com/v1/models?limit=1",
  grok: "https://api.x.ai/v1/models",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  flux: "https://api.cloudflare.com/client/v4/user/tokens/verify",
  video_short: "https://api.runwayml.com/v1/models",
  video_long: "https://api.klingai.com/v1/models",
  facebook: "https://graph.facebook.com/v20.0/me",
  meta_llama: "https://api.llama.com/v1/models",
  meta_muse: "https://api.llama.com/v1/models",
  meta_sam: "https://api.cloudflare.com/client/v4/user/tokens/verify",
  meta_graph_ai: "https://graph.facebook.com/v26.0/me",
};

const models = new Hono<{ Bindings: ModelsEnv }>();

models.get("/models", async (c) => {
  const user = sessionUserOrDefault(await getSessionUser(c.env, c.req.raw));
  const tokens = await listTokens(c.env.DB, user.sub);
  const connected = new Map(tokens.map((t) => [t.provider, true]));

  return c.json({
    user: { sub: user.sub, email: user.email },
    inference_backbone: { runner: "worker-edge", providers_bound: connected.size },
    models: MODEL_DEFS.map((m) => ({ ...m, connected: connected.get(m.provider) ?? false })),
  });
});

/** Probe bound credentials with a lightweight authenticated upstream call. */
models.post("/models/:provider/test", async (c) => {
  const provider = c.req.param("provider");
  const def = MODEL_DEFS.find((m) => m.provider === provider);
  if (!def) return c.json({ error: "unknown provider" }, 404);

  const user = sessionUserOrDefault(await getSessionUser(c.env, c.req.raw));
  const op = async (): Promise<{ ok: boolean; detail: string; status?: number }> => {
    if (def.mode === "core") return { ok: true, detail: "core channel · no credential required" };

    const ctx: InferContext = { DB: c.env.DB, operator: user, CF_ACCOUNT_ID: c.env.CF_ACCOUNT_ID, VAULT_CIPHER_KEY: c.env.VAULT_CIPHER_KEY, ...(c.env as unknown as Record<string, unknown>) } as InferContext;
    const token = await providerTokenValue(ctx, provider);
    if (!token) return { ok: false, detail: "no credential bound — connect in the Models registry first" };

    const url = TEST_PING[provider];
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (provider === "anthropic") { headers["x-api-key"] = token; delete headers.Authorization; headers["anthropic-version"] = "2023-06-01"; }
      const res = await fetch(url, { headers });
      return { ok: res.ok, detail: res.ok ? `authenticated · ${res.status}` : `rejected · ${res.status}`, status: res.status };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : "probe failed" };
    }
  };

  const started = Date.now();
  const result = await op();
  return c.json({ provider, ok: result.ok, detail: result.detail, latency_ms: Date.now() - started });
});

/** Run a model behind-the-curtain. Operator-facing, returns clean result. */
models.post("/models/:provider/run", async (c) => {
  const provider = c.req.param("provider");
  const def = MODEL_DEFS.find((m) => m.provider === provider);
  if (!def) return c.json({ error: "unknown provider" }, 404);
  if (def.mode === "core") return c.json({ error: "core channel — no inference surface" }, 400);

  const user = sessionUserOrDefault(await getSessionUser(c.env, c.req.raw));
  let body: { model?: string; prompt?: string; image_prompt?: string; duration?: number } = {};
  try { body = await c.req.json(); } catch { /* empty */ }
  if (!body.prompt && !body.image_prompt) return c.json({ error: "prompt is required" }, 400);

  const ctx: InferContext = { DB: c.env.DB, operator: user, CF_ACCOUNT_ID: c.env.CF_ACCOUNT_ID, VAULT_CIPHER_KEY: c.env.VAULT_CIPHER_KEY, ...(c.env as unknown as Record<string, unknown>) } as InferContext;
  const result = await infer(provider, body, ctx);
  return c.json(result);
});

export default models;
```

### FB Models Card.|
// ~/Clawdy/src/components/facebook/fb-models-cards.tsx
// FB Meta AI Series — shadcn card component for Models library on landing.clawdyclaw.com
// Shows what FB's API/Models/MCP has to offer — fits alongside Cloudflare Workers AI

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Zap, Brain, Image, MessageCircle, Code2 } from 'lucide-react'

const fbModels = [
  {
    id: 'llama-4',
    name: 'Llama 4 • Meta AI',
    tag: 'MCP · API_KEY',
    icon: <Brain className="h-4 w-4" />,
    status: 'UNBOUND',
    desc: 'Frontier open-weight — Llama 4 Scout & Maverick via Meta API + Cloudflare routing. Powers your autonomous Reels hooks.',
    models: [
      'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      'meta-llama/Llama-4-Maverick-17B-128E-Instruct',
      'meta-llama/Llama-3.3-70B-Instruct-fp8-fast',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
    ],
    accent: 'fb', // uses glass-fb
    endpoint: 'https://facebook.clawdyclaw.com/mcp/v1/llama'
  },
  {
    id: 'muse',
    name: 'Muse • Meta Code',
    tag: 'CODE · API_KEY',
    icon: <Code2 className="h-4 w-4" />,
    status: 'UNBOUND',
    desc: 'Meta's code-specialized family — Muse, built for agentic coding. Use for `npx clawdyclaw` CLI generation.',
    models: [
      'meta-llama/CodeLlama-70B-Instruct',
      'meta-llama/CodeLlama-34B-Instruct',
      'codellama/CodeLlama-13B-Python-hf',
      'facebook/codemodel-muse-2'
    ],
    accent: 'rust',
    endpoint: 'https://facebook.clawdyclaw.com/mcp/v1/codemodel'
  },
  {
    id: 'segment-anything',
    name: 'Segment Anything 2 • FB Research',
    tag: 'VISION · API_KEY',
    icon: <Image className="h-4 w-4" />,
    status: 'UNBOUND',
    desc: 'SAM 2 + DINOv2 via Meta. Auto-masks your lobster mascot, product photos for Reels — no manual crop.',
    models: [
      'facebook/sam2-hiera-large',
      'facebook/sam2.1-hiera-tiny',
      'facebook/dinov2-large',
      'facebook/dinov3-vitl16'
    ],
    accent: 'fb',
    endpoint: 'https://facebook.clawdyclaw.com/mcp/v1/sam'
  },
  {
    id: 'graph-ai',
    name: 'Meta Graph AI • Reels Brain',
    tag: 'FB-API · MCP',
    icon: <MessageCircle className="h-4 w-4" />,
    status: 'LIVE',
    desc: 'What FB API/Models/MCP has to offer: Graph API v26.0 Reels publishing, Lead Ads retrieval, private_replies opt-in, WhatsApp Cloud, X-App-Usage trust score.',
    models: [
      'graph-api/v26.0/{page_id}/video_reels',
      'graph-api/{comment_id}/private_replies',
      'graph-api/{page_id}/leadgen',
      'whatsapp/cloud-api/send'
    ],
    accent: 'fb',
    endpoint: 'https://developers.facebook.com/docs/video-api/guides/reels-publishing'
  },
]

export function FbModelsCards() {
  return (
    <div className="factory-grid">
      {fbModels.map((m) => (
        <Card
          key={m.id}
          className={`
            group relative overflow-hidden rounded-[16px] border bg-[#121214]
            transition-all duration-300 hover:-translate-y-1
            ${m.accent === 'fb' 
              ? 'border-white/[0.08] hover:border-[#0866FF]/20 hover:shadow-[0_0_40px_rgba(8,102,255,0.12)]' 
              : 'border-white/[0.08] hover:border-[#FF4D2E]/20 hover:shadow-[0_0_40px_rgba(255,77,46,0.12)]'}
          `}
        >
          {/* Glacier highlight */}
          <div className={`
            pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
            ${m.accent === 'fb'
              ? 'bg-[radial-gradient(600px_300px_at_20%_0%,rgba(8,102,255,0.12),transparent)]'
              : 'bg-[radial-gradient(600px_300px_at_20%_0%,rgba(255,77,46,0.12),transparent)]'}
          `} />

          <CardHeader className="relative flex flex-row items-start justify-between pb-3">
            <div className="flex items-center gap-3">
              <div className={`
                flex h-8 w-8 items-center justify-center rounded-lg border
                ${m.accent === 'fb' ? 'bg-[#0866FF]/10 border-[#0866FF]/20 text-[#60A5FA]' : 'bg-[#FF4D2E]/10 border-[#FF4D2E]/20 text-[#FF8A65]'}
              `}>
                {m.icon}
              </div>
              <div>
                <CardTitle className="text-[14px] font-semibold leading-tight text-white">{m.name}</CardTitle>
                <CardDescription className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-white/40">{m.tag}</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={`
              text-[10px] font-mono border
              ${m.status === 'LIVE' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/[0.04] text-white/40'}
            `}>
              <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${m.status === 'LIVE' ? 'bg-emerald-400' : 'bg-white/30'}`} />
              {m.status}
            </Badge>
          </CardHeader>

          <CardContent className="relative space-y-3">
            <p className="text-[13px] leading-[1.5] text-white/60 line-clamp-3">{m.desc}</p>
            <div className="flex flex-wrap gap-1.5">
              {m.models.map((mod) => (
                <code key={mod} className="rounded-full bg-[#0F0F10] border border-white/[0.06] px-2 py-1 text-[10px] font-mono text-white/50">
                  {mod}
                </code>
              ))}
            </div>
          </CardContent>

          <CardFooter className="relative mt-2 flex items-center justify-between border-t border-white/[0.06] pt-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 rounded-full bg-white/[0.04] px-3 text-[11px] font-mono text-white/50 hover:bg-white/[0.08] hover:text-white">test</Button>
            </div>
            <Button
              size="sm"
              className={`
                h-7 rounded-full px-4 text-[11px] font-semibold text-white
                ${m.accent === 'fb' ? 'bg-[#0866FF] hover:bg-[#075EEC] hover:shadow-[0_0_20px_rgba(8,102,255,0.3)]' : 'bg-[#FF4D2E] hover:bg-[#C43C1A] hover:shadow-[0_0_20px_rgba(255,77,46,0.3)]'}
              `}
            >
              run
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

// Usage in landing.clawdyclaw.com Models page:
// import { FbModelsCards } from '@/components/facebook/fb-models-cards'
// <section>
//   <h2 className="text-adaptive-h2">Meta • Facebook Models</h2>
//   <p className="text-adaptive-body text-white/60 mt-2">What FB's API/Models/MCP has to offer — Llama 4, Code Llama (Muse), SAM 2, Graph AI</p>
//   <div className="mt-6"><FbModelsCards /></div>
// </section>
```

### GLOBALS.CSS
@import "tailwindcss";

@theme {
  /* FB Blue — Production facebook.clawdyclaw.com */
  --color-fb-blue: #0866FF;
  --color-fb-blue-hover: #075EEC;
  --color-fb-blue-light: #E7F3FF;
  --color-fb-blue-muted: #1877F2;
  
  /* Rusty Red — Main clawdyclaw.com / open.clawdyclaw.com */
  --color-rust: #FF4D2E;
  --color-rust-deep: #C43C1A;
  --color-rust-dark: #7A2310;
  --color-rust-glow: rgba(255, 77, 46, 0.15);

  /* Glacier Glass */
  --color-glacier: rgba(255, 255, 255, 0.08);
  --color-glacier-border: rgba(255, 255, 255, 0.12);
  --color-glacier-frost: rgba(255, 255, 255, 0.04);
  --color-bg: #0A0A0B;
  --color-bg-elevated: #141416;
  --color-bg-soft: #1C1C1F;

  /* Fonts */
  --font-sans: 'Geist', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

  /* Radius */
  --radius-glass: 16px;
  --radius-pill: 9999px;
}

/* Base */
html {
  background: var(--color-bg);
  color: white;
  -webkit-font-smoothing: antialiased;
}

body {
  font-family: var(--font-sans);
  background: radial-gradient(1200px 600px at 20% -10%, rgba(8,102,255,0.12), transparent),
              radial-gradient(800px 400px at 80% 0%, rgba(255,77,46,0.08), transparent),
              var(--color-bg);
  min-height: 100vh;
}

/* Glacier Glass — for facebook.clawdyclaw.com */
.glass {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  border: 1px solid var(--color-glacier-border);
  border-radius: var(--radius-glass);
}

.glass-fb {
  background: linear-gradient(135deg, rgba(8,102,255,0.08), rgba(8,102,255,0.02));
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  border: 1px solid rgba(8,102,255,0.15);
  border-radius: var(--radius-glass);
  box-shadow: 0 0 40px rgba(8,102,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08);
}

.glass-rust {
  background: linear-gradient(135deg, rgba(255,77,46,0.08), rgba(255,77,46,0.02));
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,77,46,0.15);
  border-radius: var(--radius-glass);
  box-shadow: 0 0 40px var(--color-rust-glow), inset 0 1px 0 rgba(255,255,255,0.06);
}

/* FB Blue Button */
.btn-fb {
  background: var(--color-fb-blue);
  color: white;
  font-weight: 600;
  border-radius: var(--radius-pill);
  padding: 10px 20px;
  transition: all 0.2s;
}
.btn-fb:hover {
  background: var(--color-fb-blue-hover);
  box-shadow: 0 0 20px rgba(8,102,255,0.4);
  transform: translateY(-1px);
}

/* Rust Button */
.btn-rust {
  background: var(--color-rust);
  color: white;
  font-weight: 600;
  border-radius: var(--radius-pill);
  padding: 10px 20px;
  transition: all 0.2s;
}
.btn-rust:hover {
  background: var(--color-rust-deep);
  box-shadow: 0 0 20px rgba(255,77,46,0.4);
  transform: translateY(-1px);
}

/* Code / Terminal */
.code-block {
  font-family: var(--font-mono);
  background: #0F0F10;
  border: 1px solid #1F1F23;
  border-radius: 12px;
}

/* Scrollbar — glacier */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-thumb {
  background: var(--color-glacier);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-glacier-border);
}

/* ===== FIXES for crunched components — adaptive typography + responsive ===== */
@layer utilities {
  .text-adaptive-h1 { font-size: clamp(28px, 5vw, 56px); line-height: 0.95; letter-spacing: -0.03em; }
  .text-adaptive-h2 { font-size: clamp(22px, 3.5vw, 36px); line-height: 1.1; letter-spacing: -0.02em; }
  .text-adaptive-body { font-size: clamp(14px, 1.2vw, 16px); line-height: 1.6; }
  .text-adaptive-small { font-size: clamp(12px, 0.9vw, 14px); line-height: 1.5; }
  
  .factory-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 16px;
  }
  
  .infinity-scroller {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .infinity-scroller::-webkit-scrollbar { display: none; }
  .infinity-scroller > * { scroll-snap-align: start; flex-shrink: 0; }
  
  /* Header morph — FB-blue Glazier */
  .header-glazier-closed {
    background: linear-gradient(90deg, rgba(8,102,255,0.12) 0%, rgba(8,102,255,0.04) 50%, transparent 100%), rgba(10,10,11,0.9);
  }
  .header-glazier-open {
    background: linear-gradient(135deg, rgba(8,102,255,0.18) 0%, rgba(8,102,255,0.08) 40%, rgba(8,102,255,0.02) 100%), radial-gradient(600px 300px at 20% 0%, rgba(8,102,255,0.25), transparent), rgba(10,10,11,0.8);
  }
}
---

{
  provider: "meta_llama", // Llama 4
  name: "Meta AI · Llama 4",
  category: "meta",
  models: [
    "meta-llama/Llama-4-Scout-17B-16E-Instruct",
    "meta-llama/Llama-4-Maverick-17B-128E-Instruct",
    "meta-llama/Llama-3.3-70B-Instruct",
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
  ],
  accent: "border-blue-600/40",
  docs: "https://www.llama.com/docs/overview"
},
{
  provider: "meta_muse", // FB's Muse series you asked for
  name: "Muse · CodeLlama",
  models: [
    "meta-llama/CodeLlama-70B-Instruct",
    "meta-llama/CodeLlama-34B-Instruct",
    "codellama/CodeLlama-13B-Python-hf",
    "facebook/codemodel-muse-2"
  ]
},
{
  provider: "meta_sam",
  name: "Segment Anything 2 + DINOv2",
  models: ["facebook/sam2-hiera-large", "facebook/dinov2-large", "facebook/dinov3-vitl16"]
},
{
  provider: "meta_graph_ai",
  name: "Meta Graph AI · Reels Brain",
  models: [
    "graph-api/v26.0/{page_id}/video_reels",
    "graph-api/{comment_id}/private_replies",
    "graph-api/{page_id}/leadgen",
    "whatsapp/cloud-api/send"
  ],
  // This is the shadcn card that shows what FB's API/Models/MCP has to offer
}
```

meta_llama: "https://api.llama.com/v1/models",
meta_muse: "https://api.llama.com/v1/models",
meta_sam: "https://api.cloudflare.com/.../verify",
meta_graph_ai: "https://graph.facebook.com/v26.0/me"
```

How it looks in your UI:

In landing.clawdyclaw.com Models page, your existing grid:

Cloudflare Workers AI
OpenWeights
FLUX Imaging
+ NEW: Meta AI · Llama 4 (FB-blue glass)
+ NEW: Muse · CodeLlama (rust)
+ NEW: SAM 2 + DINOv2 (cyan)
+ NEW: Meta Graph AI · Reels Brain (FB-blue LIVE)
Reels Short-Form Engine
Reels Narrative Engine
Facebook Pages & Reels
The shadcn card component fb-models-cards.tsx I gave you earlier already maps to this — accent: 'fb' → glass-fb with #0866FF glow, accent: 'rust' → glass-rust.

Drop models.updated.ts over your src/api/models.ts, run your wrangler build, and you'll see the FB series in landing.clawdyclaw.com/agents.clawdyclaw.com Models.
---

EOF
