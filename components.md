ai-thinking orb
You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
ai-thiking-orb-and-input.tsx
// component.tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import "../../index.css";

/* ───────────────────────────── copy ───────────────────────────── */
const COPY = {
  placeholder: "Ask anything…",
  labels: ["Thinking", "Searching", "Analyzing", "Composing"],
  done: "Done",
  answerTitle: "Answer",
  answerBody: "The answer goes here",
  reset: "New question",
  send: "Send",
};

type Phase = "idle" | "launch" | "assemble" | "think" | "resolve" | "condense" | "unfold" | "answered" | "reset";

export interface MorphOrbProps {
  onSubmit?: (text: string) => Promise<string> | string;
  minThinkMs?: number;
  speed?: number;
}

/* ─────────────────────────── geometry ─────────────────────────── */
const PILL_H = 60, BALL_SMALL = 60, ORB_D = 132, ORB_R = 66, CANVAS = 220;
const CARD_H = 108;
const FLY_D = 138;
const pillW = () => Math.min(560, window.innerWidth - 32);
const cardW = () => Math.min(320, window.innerWidth - 32);
const homeDy = () => window.innerHeight * 0.54 - 96; // pill centre is 96px above the viewport bottom; stage centre is at top:46%

/* ───────────────────────── math + easing ───────────────────────── */
type Ease = (t: number) => number;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4);
const TAU = Math.PI * 2;

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const e = sx(t);
      if (Math.abs(e - x) < 1e-6) break;
      if (x > e) lo = t; else hi = t;
      t = (hi - lo) / 2 + lo;
    }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

const E = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  io: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.4, 0, 1, 1),
  fly: cubicBezier(0.5, 0, 0.1, 1),
  grow: cubicBezier(0.3, 0, 0.2, 1),
  vortex: cubicBezier(0.6, 0, 0.2, 1),
  spring: cubicBezier(0.34, 1.4, 0.64, 1),
  card: cubicBezier(0.65, 0, 0.2, 1),
  lin: (t: number) => t,
};

const bez = (t: number, p0: number, c: number, p2: number) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * c + t * t * p2;

/* ───────────────────────── timeline data ───────────────────────── */
interface Track { ch: string; from: number; to: number; t0: number; t1: number; ease?: Ease }
const T = (ch: string, from: number, to: number, t0: number, t1: number, ease: Ease = E.io): Track => ({ ch, from, to, t0, t1, ease });

interface Geo { pw: number; cw: number; H: number; dir: number }

const launchTracks = (g: Geo): Track[] => [
  T("w", g.pw, g.pw - 12, 0, 100, E.out),
  T("oInput", 1, 0, 0, 160, E.in),
  T("inScale", 1, 0.6, 0, 160, E.in),
  T("oGlow", 1, 0, 0, 300, E.out),
  T("oAur", 1, 0, 0, 300, E.out),
  T("w", g.pw - 12, BALL_SMALL, 100, 560, E.io),
  T("h", PILL_H, PILL_H + 6, 380, 500, E.out),
  T("h", PILL_H + 6, BALL_SMALL, 500, 620, E.out),
  T("oPill", 1, 0, 300, 560, E.out),
  T("oBall", 0, 1, 300, 560, E.out),
  T("u", 0, 1, 620, 1500, E.fly),
  T("w", BALL_SMALL, FLY_D, 620, 1300, E.grow),
  T("h", BALL_SMALL, FLY_D, 620, 1300, E.grow),
  T("w", FLY_D, ORB_D, 1300, 1500, E.out),
  T("h", FLY_D, ORB_D, 1300, 1500, E.out),
  T("cHalo", 0, 0.6, 620, 1500, E.out),
  T("trail", 0, 1, 700, 800, E.out),
  T("trail", 1, 0, 1300, 1500, E.in),
];

const ASSEMBLE: Track[] = [
  T("oRing", 1, 0, 0, 300, E.out),
  T("oBall", 1, 0, 0, 260, E.out),
  T("orb.k", 0, 1, 0, 800, E.out),
  T("orb.alpha", 0, 1, 0, 800, E.out),
  T("orb.spin", 0, 0.9, 0, 800, E.out),
  T("orb.pop", 1, 1.05, 0, 420, E.out),
  T("orb.pop", 1.05, 1, 420, 800, E.io),
  T("sOp", 0, 1, 300, 620, E.out),
  T("sTy", 6, 0, 300, 620, E.out),
];

const RESOLVE: Track[] = [
  T("orb.sweep", 0, 1, 0, 700, E.io),
  T("orb.spin", 0.9, 0.3, 0, 700, E.out),
  T("orb.gain", 1, 0, 0, 700, E.out),
  T("orb.floor", 0, 0.95, 400, 900, E.out),
  T("orb.rad", 0, 0.15, 400, 900, E.out),
  T("orb.pop", 1, 1.04, 600, 800, E.out),
  T("orb.pop", 1.04, 1, 800, 900, E.out),
];

const CONDENSE: Track[] = [
  T("orb.pop", 1, 1.06, 0, 120, E.out),
  T("sOp", 1, 0, 0, 160, E.in),
  T("sTy", 0, -6, 0, 160, E.in),
  T("orb.k", 1, 0, 120, 640, E.vortex),
  T("orb.vortex", 0, 1.6, 120, 640, E.vortex),
  T("oGreen", 0, 1, 260, 700, E.spring),
  T("gs", 0.55, 1, 260, 700, E.spring),
  T("pulse", 0, 1, 320, 760, E.out),
  T("oHalo", 0, 0.35, 380, 700, E.out),
  T("orb.alpha", 1, 0, 500, 800, E.out),
];

const unfoldTracks = (g: Geo, tw: number): Track[] => [
  T("w", ORB_D, 124, 0, 90, E.in),
  T("h", ORB_D, 124, 0, 90, E.in),
  T("w", 124, g.cw, 90, 700, E.card),
  T("h", 124, CARD_H, 90, 700, E.out),
  T("r", ORB_D / 2, 20, 90, 700, E.io),
  T("oGreen", 1, 0, 200, 560, E.out),
  T("oCard", 0, 1, 200, 560, E.out),
  T("oHalo", 0.35, 0, 300, 700, E.out),
  T("cHalo", 0.6, 0.22, 300, 700, E.out),
  T("hOp", 0, 1, 520, 840, E.out),
  T("dotS", 0, 1, 520, 840, E.spring),
  T("wp", 0, 1, 600, 600 + tw, E.lin),
  T("bloom", 1, 0.625, 700, 1200, E.io),
];

/* reduced-motion: pure cross-fades */
const R_OUT: Track[] = [
  T("oInput", 1, 0, 0, 140, E.out),
  T("oPill", 1, 0, 0, 200, E.out),
  T("oGlow", 1, 0, 0, 200, E.out),
  T("oAur", 1, 0, 0, 200, E.out),
  T("oRing", 1, 0, 0, 200, E.out),
];
const R_IN: Track[] = [
  T("orb.alpha", 0, 1, 0, 200, E.out),
  T("sOp", 0, 1, 0, 200, E.out),
  T("cHalo", 0, 0.6, 0, 200, E.out),
];
const R_RESOLVE: Track[] = [T("orb.sweep", 0, 1, 0, 250, E.io), T("orb.floor", 0, 0.95, 0, 250, E.out)];
const R_CONDENSE: Track[] = [
  T("oGreen", 0, 1, 0, 250, E.out),
  T("orb.alpha", 1, 0, 0, 250, E.out),
  T("sOp", 1, 0, 0, 250, E.out),
];
const R_GREEN_OUT: Track[] = [T("oGreen", 1, 0, 0, 120, E.out)];
const rCardIn = (tw: number): Track[] => [
  T("oCard", 0, 1, 0, 250, E.out),
  T("hOp", 0, 1, 0, 250, E.out),
  T("wp", 0, 1, 0, tw, E.lin),
  T("bloom", 1, 0.625, 0, 250, E.out),
];

const FADE = ["oGlow", "oAur", "oPill", "oBall", "oGreen", "oCard", "oRing", "oInput", "oHalo", "sOp", "orb.alpha", "trail"];

const INIT: Record<string, number> = {
  h: PILL_H, r: 999, oGlow: 1, oHalo: 0, oPill: 1, oBall: 0, oGreen: 0, oCard: 0, oRing: 1, oInput: 1, inScale: 1, oAur: 1,
  gs: 0.55, cs: 1, hOp: 0, dotS: 0, bloom: 1, u: 0, yOff: 0, trail: 0, pulse: -1, sOp: 0, sTy: 6, cHalo: 0, wp: 0,
  "orb.k": 0, "orb.alpha": 0, "orb.spin": 0, "orb.pop": 1, "orb.sweep": 0, "orb.vortex": 0, "orb.gain": 1, "orb.floor": 0, "orb.rad": 0,
};

/* ─────────────────────────── async utils ─────────────────────────── */
const ABORT = Symbol("abort");

function sleep(ms: number, sig: AbortSignal) {
  return new Promise<void>((res) => {
    if (sig.aborted) return res();
    let id = 0;
    const onAbort = () => { window.clearTimeout(id); res(); };
    id = window.setTimeout(() => { sig.removeEventListener("abort", onAbort); res(); }, Math.max(0, ms));
    sig.addEventListener("abort", onAbort, { once: true });
  });
}

function abortable<V>(p: Promise<V>, sig: AbortSignal) {
  return new Promise<V | undefined>((res) => {
    if (sig.aborted) return res(undefined);
    const onAbort = () => res(undefined);
    sig.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => { sig.removeEventListener("abort", onAbort); res(v); },
      () => { sig.removeEventListener("abort", onAbort); res(undefined); }
    );
  });
}

/* ───────────────────────────── dotted orb ───────────────────────────── */
const RINGS = 16;
const DOT_LIST = (() => {
  const rand = mulberry32(7);
  const out: { x: number; y: number; z: number; u: number; seed: number }[] = [];
  for (let k = 0; k < RINGS; k++) {
    const y = 1 - ((k + 0.5) / RINGS) * 2;
    const r = Math.sqrt(1 - y * y);
    const m = Math.max(4, Math.round(30 * r));
    for (let j = 0; j < m; j++) {
      const a = (j / m) * TAU + k * 0.35;
      out.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, u: (1 - y) / 2, seed: rand() * 6.283 });
    }
  }
  return out;
})();
const N = DOT_LIST.length;
const DX = Float32Array.from(DOT_LIST, (d) => d.x);
const DY = Float32Array.from(DOT_LIST, (d) => d.y);
const DZ = Float32Array.from(DOT_LIST, (d) => d.z);
const DU = Float32Array.from(DOT_LIST, (d) => d.u);
const DS = Float32Array.from(DOT_LIST, (d) => d.seed);

const G_STEPS = 24, A_STEPS = 48;
const COLORS: string[] = (() => {
  const out: string[] = [];
  for (let gi = 0; gi <= G_STEPS; gi++) {
    const g = gi / G_STEPS;
    const r = Math.round(lerp(235, 52, g)), gg = Math.round(lerp(235, 211, g)), b = Math.round(lerp(235, 153, g));
    for (let ai = 0; ai <= A_STEPS; ai++) out.push(`rgba(${r},${gg},${b},${(ai / A_STEPS).toFixed(3)})`);
  }
  return out;
})();

interface OrbParams {
  k: number; alpha: number; spin: number; rot: number; sweep: number; pop: number;
  vortex: number; gain: number; floor: number; rad: number; prog: number;
}
const ORB_KEYS = ["k", "alpha", "spin", "sweep", "pop", "vortex", "gain", "floor", "rad"] as const;

function createOrb(canvas: HTMLCanvasElement, getSpeed: () => number, isReduced: () => boolean) {
  const P: OrbParams = { k: 0, alpha: 0, spin: 0, rot: 0, sweep: 0, pop: 1, vortex: 0, gain: 1, floor: 0, rad: 0, prog: 0 };
  const ctx = canvas.getContext("2d");
  const lit = new Float32Array(N);
  const SX = new Float32Array(N), SY = new Float32Array(N), SR = new Float32Array(N), SD = new Float32Array(N);
  const SC = new Int16Array(N);
  const pw = [1, 0, 0, 0];
  let time = 0, raf = 0, last = 0, dead = false;

  const reset = () => {
    P.k = 0; P.alpha = 0; P.spin = 0; P.rot = 0; P.sweep = 0; P.pop = 1; P.vortex = 0; P.gain = 1; P.floor = 0; P.rad = 0; P.prog = 0;
    lit.fill(0);
    pw[0] = 1; pw[1] = 0; pw[2] = 0; pw[3] = 0;
    time = isReduced() ? 1.2 : 0;
  };
  reset();

  if (!ctx) return { P, ensure() {}, reset, destroy() {} };

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(CANVAS * dpr);
  canvas.height = Math.round(CANVAS * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const S = 0.6, CP = Math.cos(0.35), SP = Math.sin(0.35), C0 = CANVAS / 2;

  const draw = (dt: number) => {
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    time += dt;
    P.rot += P.spin * dt;
    const yaw = P.rot + P.vortex, cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const stepW = dt / 0.35;
    for (let q = 0; q < 4; q++) {
      const d = (q === P.prog ? 1 : 0) - pw[q];
      pw[q] += Math.abs(d) <= stepW ? d : d > 0 ? stepW : -stepW;
    }
    const decay = Math.exp(-dt / 0.5);
    const h0 = (time * 300) % N, h3 = (time * 480) % N;
    const a1 = time * 0.8, b1 = Math.sin(time * 0.5) * 0.9;
    const f1x = Math.cos(b1) * Math.cos(a1), f1y = Math.sin(b1), f1z = Math.cos(b1) * Math.sin(a1);
    const a2 = time * 0.55 + 2.1, b2 = Math.cos(time * 0.42) * 0.9;
    const f2x = Math.cos(b2) * Math.cos(a2), f2y = Math.sin(b2), f2z = Math.cos(b2) * Math.sin(a2);
    const lat = Math.sin(time * 2.2);
    const swirlK = P.vortex * 1.5;

    for (let n = 0; n < N; n++) {
      const dx = DX[n], dy = DY[n], dz = DZ[n], u = DU[n];

      /* light programs: dots are lit in turn */
      let pulse = 0;
      if (pw[0] > 0.001) {
        let dd = Math.abs(n - h0); if (dd > N - dd) dd = N - dd;
        const v = Math.max(0, 1 - dd / 16);
        pulse = Math.max(pulse, v * v * pw[0]);
      }
      if (pw[1] > 0.001) {
        const v1 = Math.max(0, (dx * f1x + dy * f1y + dz * f1z - 0.72) / 0.28);
        const v2 = Math.max(0, (dx * f2x + dy * f2y + dz * f2z - 0.72) / 0.28);
        const v = Math.max(v1, v2);
        pulse = Math.max(pulse, v * v * pw[1]);
      }
      if (pw[2] > 0.001) {
        const e = dy - lat;
        const v = Math.max(0, 1 - (e * e) / 0.02);
        pulse = Math.max(pulse, v * v * pw[2]);
      }
      if (pw[3] > 0.001) {
        let dd = Math.abs(n - h3); if (dd > N - dd) dd = N - dd;
        const v = Math.max(0, 1 - dd / 22);
        pulse = Math.max(pulse, v * v * pw[3]);
      }
      const l = Math.max(lit[n] * decay, pulse * P.gain);
      lit[n] = l;

      /* per-dot appearance: top dots first, bottom collapse first */
      const ki = clamp01(P.k * (1 + S) - S * u);
      if (ki <= 0.001) { SC[n] = -1; continue; }
      const eo = E.out(ki), kk = eo * P.pop;

      const x1 = dx * cyw + dz * syw, z1 = -dx * syw + dz * cyw;
      const y2 = dy * CP - z1 * SP, z2 = dy * SP + z1 * CP;
      const f = 2.8 / (2.8 - z2), depth = (z2 + 1) / 2;
      let ox = x1 * ORB_R * kk * f, oy = -y2 * ORB_R * kk * f;
      if (swirlK > 0.001) {
        const sw = (1 - ki) * swirlK, cc = Math.cos(sw), ss = Math.sin(sw);
        const tx = ox * cc - oy * ss;
        oy = ox * ss + oy * cc;
        ox = tx;
      }

      const g = clamp01((P.sweep * 1.4 - u) / 0.4);
      let a = 0.1 + 0.035 * Math.sin(DS[n] + time * 1.6) * (1 - g) + 0.32 * depth * depth + 0.75 * l * (1 - g) + g * (0.55 + 0.4 * depth) + 2 * g * (1 - g);
      a = Math.max(a, P.floor * (0.7 + 0.3 * depth));
      if (a > 1) a = 1;
      a *= eo * P.alpha;

      SX[n] = C0 + ox;
      SY[n] = C0 + oy;
      SD[n] = depth;
      SR[n] = (1.15 * (0.45 + 0.75 * depth) * f + 0.9 * l + g * 0.25) * (1 + P.rad) * (0.4 + 0.6 * eo);
      const ai = Math.round(a * A_STEPS), gi = Math.round(g * G_STEPS);
      SC[n] = ai <= 0 ? -1 : gi * (A_STEPS + 1) + ai;
    }

    /* two passes: back half first, then front half */
    for (let pass = 0; pass < 2; pass++) {
      for (let n = 0; n < N; n++) {
        const c = SC[n];
        if (c < 0) continue;
        if ((SD[n] >= 0.5) !== (pass === 1)) continue;
        ctx.fillStyle = COLORS[c];
        ctx.beginPath();
        ctx.arc(SX[n], SY[n], SR[n], 0, TAU);
        ctx.fill();
      }
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (dead) return;
    const dt = isReduced() ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000)) * getSpeed();
    last = now;
    draw(dt);
    if (P.alpha > 0.002) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, CANVAS, CANVAS);
  };

  const ensure = () => {
    if (raf || dead || P.alpha <= 0.002) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const destroy = () => {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  return { P, ensure, reset, destroy };
}

/* ───────────────────────────── runtime ───────────────────────────── */
interface UI {
  setPhase(p: Phase): void;
  swapLabel(name: string): void;
  resetLabel(): void;
  setAnswer(s: string): void;
  clearInput(): void;
  live(s: string): void;
  lock(on: boolean): void;
  idleReady(): void;
  focusAnswer(): void;
}
interface Env {
  root: HTMLElement; mover: HTMLElement; actor: HTMLElement; form: HTMLElement; ghosts: HTMLElement[];
  canvas: HTMLCanvasElement; pulse: HTMLElement; status: HTMLElement;
  getBody: () => HTMLElement | null;
  ui: UI; getSpeed: () => number; isReduced: () => boolean;
}
interface RunCfg { onSubmit: (text: string) => Promise<string> | string; minThink: number }
interface Runtime {
  start(text: string, cfg: RunCfg): boolean;
  escape(): void;
  reset(): void;
  hard(): void;
  home(): void;
  busy(): boolean;
  destroy(): void;
}
interface Sample { t: number; x: number; y: number; d: number }

function sampleAt(h: Sample[], t: number, out: Sample) {
  const n = h.length;
  const copy = (s: Sample) => { out.x = s.x; out.y = s.y; out.d = s.d; };
  if (n === 0) { out.x = 0; out.y = 0; out.d = 0; return; }
  if (t <= h[0].t) return copy(h[0]);
  for (let i = n - 1; i > 0; i--) {
    const a = h[i - 1], b = h[i];
    if (t >= a.t) {
      if (t >= b.t) return copy(b);
      const k = (t - a.t) / (b.t - a.t || 1);
      out.x = lerp(a.x, b.x, k); out.y = lerp(a.y, b.y, k); out.d = lerp(a.d, b.d, k);
      return;
    }
  }
  copy(h[n - 1]);
}

function createRuntime(env: Env): Runtime {
  const { actor, mover, root, status, pulse, ghosts, form } = env;
  const life = new AbortController();
  const geo: Geo = { pw: pillW(), cw: cardW(), H: homeDy(), dir: -1 };
  const orb = createOrb(env.canvas, env.getSpeed, env.isReduced);
  const vals: Record<string, number> = {};
  const dirty = new Set<string>();
  const CH: Record<string, (v: number) => void> = {};

  let current: AbortController | null = null;
  let idleCtl: AbortController | null = null;
  let busy = false, idling = false, epoch = 0;
  let curX = 0, curY = 0, curD = BALL_SMALL, trailVis = 0, ghostsShown = false;
  let wStagger = 45, wDur = 320;
  const hist: Sample[] = [];
  const tmp: Sample = { t: 0, x: 0, y: 0, d: 0 };

  const child = () => {
    const ac = new AbortController();
    if (life.signal.aborted) ac.abort();
    else life.signal.addEventListener("abort", () => ac.abort(), { once: true });
    return ac;
  };

  /* ── flight path + comet trail ── */
  const renderTrail = () => {
    if (trailVis <= 0.001) {
      if (ghostsShown) { ghosts.forEach((g) => (g.style.opacity = "0")); ghostsShown = false; }
      return;
    }
    ghostsShown = true;
    const now = performance.now();
    for (let i = 0; i < ghosts.length; i++) {
      sampleAt(hist, now - (i + 1) * 45, tmp);
      const k = (tmp.d * (1 - 0.08 * (i + 1))) / 100;
      const g = ghosts[i];
      g.style.transform = `translate3d(${(tmp.x - curX).toFixed(2)}px,${(tmp.y - curY).toFixed(2)}px,0) translate(-50%,-50%) scale(${k.toFixed(3)})`;
      g.style.opacity = (0.28 * Math.pow(1 - i / 6, 1.5) * trailVis).toFixed(3);
    }
  };

  const applyPath = () => {
    const u = vals.u ?? 0, H = geo.H;
    curX = bez(u, 0, geo.dir * 0.3 * H, 0);
    curY = bez(u, H, 0.6 * H, 0) + (vals.yOff ?? 0);
    mover.style.transform = `translate3d(${curX.toFixed(2)}px,${curY.toFixed(2)}px,0)`;
    const now = performance.now();
    hist.push({ t: now, x: curX, y: curY, d: curD });
    while (hist.length > 2 && hist[0].t < now - 500) hist.shift();
    renderTrail();
  };

  /* ── answer words ── */
  const applyWords = (v: number) => {
    const body = env.getBody();
    if (!body) return;
    const nodes = body.querySelectorAll<HTMLElement>(".mo-w");
    const total = (nodes.length - 1) * wStagger + wDur;
    const time = v * total;
    const reduced = env.isReduced();
    nodes.forEach((el, i) => {
      const p = E.out(clamp01((time - i * wStagger) / wDur));
      el.style.opacity = fmt(p);
      el.style.transform = p >= 0.999 || reduced ? "none" : `translateY(${fmt((1 - p) * 4)}px)`;
      el.style.filter = p >= 0.999 || reduced ? "none" : `blur(${fmt((1 - p) * 4)}px)`;
    });
  };

  /* ── channels ── */
  ["oGlow", "oHalo", "oPill", "oBall", "oGreen", "oCard", "oRing", "oInput", "oAur", "gs", "cs", "hOp", "dotS", "bloom"].forEach((n) => {
    CH[n] = (v) => actor.style.setProperty("--" + n, fmt(v));
  });
  ["w", "h", "r"].forEach((n) => {
    CH[n] = (v) => {
      actor.style.setProperty("--" + n, fmt(v) + "px");
      if (n === "w") curD = v;
    };
  });
  CH.inScale = (v) => {
    actor.style.setProperty("--inScale", fmt(v));
    form.style.filter = v >= 0.999 ? "none" : `blur(${fmt((1 - v) * 15)}px)`;
  };
  CH.sOp = (v) => status.style.setProperty("--sOp", fmt(v));
  CH.sTy = (v) => status.style.setProperty("--sTy", fmt(v));
  CH.cHalo = (v) => root.style.setProperty("--oCenter", fmt(v));
  CH.u = () => applyPath();
  CH.yOff = () => applyPath();
  CH.trail = (v) => { trailVis = v; renderTrail(); };
  CH.pulse = (v) => {
    if (v < 0) { pulse.style.opacity = "0"; return; }
    pulse.style.opacity = fmt(0.5 * (1 - v));
    pulse.style.transform = `scale(${fmt(1 + v)})`;
  };
  CH.wp = applyWords;
  ORB_KEYS.forEach((name) => {
    CH["orb." + name] = (v) => {
      orb.P[name] = v;
      if (name === "alpha") orb.ensure();
    };
  });

  const set = (ch: string, v: number) => { vals[ch] = v; dirty.add(ch); };
  const flush = () => { dirty.forEach((ch) => CH[ch]?.(vals[ch])); dirty.clear(); };
  const setNow = (ch: string, v: number) => { vals[ch] = v; CH[ch]?.(v); };
  const resetChannels = () => {
    setNow("w", geo.pw);
    for (const ch of Object.keys(INIT)) setNow(ch, INIT[ch]);
  };

  /* ── timeline engine ── */
  const play = (tracks: Track[], sig: AbortSignal) =>
    new Promise<void>((res) => {
      if (sig.aborted) return res();
      const end = tracks.reduce((m, k) => Math.max(m, k.t1), 0);
      const done = new Set<Track>();
      let raf = 0, t = 0, last = performance.now();
      const onAbort = () => { cancelAnimationFrame(raf); res(); };
      const finish = () => { sig.removeEventListener("abort", onAbort); res(); };
      const step = (now: number) => {
        const dt = Math.max(0, Math.min(100, now - last));
        last = now;
        t += dt * env.getSpeed();
        for (const k of tracks) {
          if (done.has(k) || t < k.t0) continue;
          const p = Math.min(1, (t - k.t0) / Math.max(1, k.t1 - k.t0));
          set(k.ch, k.from + (k.to - k.from) * (k.ease ?? E.io)(p));
          if (p === 1) done.add(k);
        }
        flush(); // one DOM write pass per frame
        if (t >= end) finish(); else raf = requestAnimationFrame(step);
      };
      sig.addEventListener("abort", onAbort, { once: true });
      raf = requestAnimationFrame(step);
    });

  /* ── thinking labels ── */
  const labelLoop = async (sig: AbortSignal, ctl: { stop: boolean }) => {
    let i = 0;
    for (;;) {
      await sleep(1150 / env.getSpeed(), sig);
      if (sig.aborted || ctl.stop) return;
      i = (i + 1) % COPY.labels.length;
      orb.P.prog = i % 4;
      env.ui.swapLabel(COPY.labels[i]);
    }
  };

  /* ── orchestrator ── */
  const run = async (text: string, sig: AbortSignal, cfg: RunCfg) => {
    const reduced = env.isReduced();
    const go = async (tracks: Track[]) => {
      await play(tracks, sig);
      if (sig.aborted) throw ABORT;
    };
    try {
      env.ui.setPhase("launch");
      hist.length = 0;
      if (!reduced) {
        await go(launchTracks(geo));
        setNow("r", ORB_D / 2);
        env.ui.setPhase("assemble");
        await go(ASSEMBLE);
      } else {
        await go(R_OUT);
        setNow("u", 1); setNow("w", ORB_D); setNow("h", ORB_D); setNow("r", ORB_D / 2);
        setNow("sTy", 0); setNow("orb.k", 1); setNow("orb.spin", 0);
        env.ui.setPhase("assemble");
        await go(R_IN);
      }

      /* think — until the answer settled AND the minimum time elapsed */
      env.ui.setPhase("think");
      env.ui.live(COPY.labels[0]);
      const ctl = { stop: false };
      void labelLoop(sig, ctl);
      const t0 = performance.now();
      const pending = Promise.resolve()
        .then(() => cfg.onSubmit(text))
        .then((b) => (typeof b === "string" && b.trim() ? b : COPY.answerBody), () => COPY.answerBody);
      const got = await abortable(pending, sig);
      if (sig.aborted) throw ABORT;
      const body = got ?? COPY.answerBody;
      await sleep(cfg.minThink / env.getSpeed() - (performance.now() - t0), sig);
      ctl.stop = true;
      if (sig.aborted) throw ABORT;

      const words = body.split(/\s+/).filter(Boolean);
      const n = Math.max(1, words.length);

      if (!reduced) {
        env.ui.setPhase("resolve");
        env.ui.swapLabel(COPY.done);
        await go(RESOLVE);

        env.ui.setPhase("condense");
        await go(CONDENSE);

        env.ui.setPhase("unfold");
        wDur = 320;
        wStagger = n > 1 ? Math.min(45, 280 / (n - 1)) : 0;
        env.ui.setAnswer(body);
        await go(unfoldTracks(geo, (n - 1) * wStagger + wDur));
      } else {
        env.ui.setPhase("resolve");
        env.ui.swapLabel(COPY.done);
        await go(R_RESOLVE);
        await sleep(350 / env.getSpeed(), sig);
        if (sig.aborted) throw ABORT;

        env.ui.setPhase("condense");
        setNow("gs", 1);
        await go(R_CONDENSE);

        env.ui.setPhase("unfold");
        wDur = 250;
        wStagger = 0;
        env.ui.setAnswer(body);
        await go(R_GREEN_OUT);
        setNow("w", geo.cw); setNow("h", CARD_H); setNow("r", 20); setNow("dotS", 1);
        await go(rCardIn(wDur));
      }

      env.ui.setPhase("answered");
      env.ui.live("Answer ready: " + body);
      env.ui.focusAnswer();
    } catch (e) {
      if (e === ABORT) return;
      hard();
    }
  };

  /* ── return to the idle pill ── */
  const toIdle = async (kind: "reset" | "esc") => {
    if (idling) return;
    idling = true;
    const my = ++epoch;
    const ac = child();
    idleCtl = ac;
    const sig = ac.signal;
    const outMs = kind === "reset" ? 240 : 200;
    const inMs = kind === "reset" ? 420 : 200;
    env.ui.setPhase("reset");

    const out: Track[] = [T("cHalo", vals.cHalo ?? 0, 0, 0, outMs, E.out)];
    for (const ch of FADE) {
      const v = vals[ch] ?? 0;
      if (v > 0.001) out.push(T(ch, v, 0, 0, outMs, E.out));
    }
    if (kind === "reset") out.push(T("cs", 1, 0.98, 0, outMs, E.out));
    await play(out, sig);
    if (sig.aborted || my !== epoch) return;

    setNow("pulse", -1);
    env.ui.setAnswer("");
    env.ui.resetLabel();
    env.ui.clearInput();
    orb.reset();
    hist.length = 0;
    geo.pw = pillW(); geo.cw = cardW(); geo.H = homeDy();
    resetChannels();
    const pillCh = ["oPill", "oInput", "oGlow", "oAur", "oRing"];
    pillCh.forEach((ch) => setNow(ch, 0));
    setNow("yOff", kind === "reset" ? 8 : 0);
    const inn: Track[] = pillCh.map((ch) => T(ch, 0, 1, 0, inMs, E.out));
    if (kind === "reset") inn.push(T("yOff", 8, 0, 0, inMs, E.out));
    await play(inn, sig);
    if (sig.aborted || my !== epoch) return;

    resetChannels();
    current = null; idleCtl = null; busy = false; idling = false;
    env.ui.lock(false);
    env.ui.setPhase("idle");
    env.ui.idleReady();
  };

  function hard() {
    epoch++;
    current?.abort(); current = null;
    idleCtl?.abort(); idleCtl = null;
    orb.reset();
    hist.length = 0;
    env.ui.setAnswer("");
    env.ui.resetLabel();
    geo.pw = pillW(); geo.cw = cardW(); geo.H = homeDy();
    resetChannels();
    setNow("pulse", -1);
    busy = false; idling = false;
    env.ui.lock(false);
    env.ui.setPhase("idle");
    env.ui.idleReady();
  }

  resetChannels();

  return {
    start(text, cfg) {
      if (busy) return false;
      busy = true;
      geo.pw = pillW(); geo.cw = cardW(); geo.H = homeDy(); // snapshot once, never read layout in frames
      geo.dir = -geo.dir;
      orb.reset();
      setNow("u", 0);
      const ac = child();
      current = ac;
      env.ui.lock(true);
      void run(text, ac.signal, cfg);
      return true;
    },
    escape() {
      if (!busy || idling) return;
      current?.abort();
      void toIdle("esc");
    },
    reset() {
      if (!busy || idling) return;
      void toIdle("reset");
    },
    hard,
    home() {
      if (busy) return;
      geo.pw = pillW(); geo.cw = cardW(); geo.H = homeDy();
      setNow("w", geo.pw);
      setNow("u", 0);
    },
    busy: () => busy,
    destroy() {
      life.abort();
      orb.destroy();
    },
  };
}

/* ───────────────────────────── component ───────────────────────────── */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function MorphOrb(props: MorphOrbProps) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [value, setValue] = useState("");
  const [lbl, setLbl] = useState<{ cur: string; prev: string | null; n: number }>({ cur: COPY.labels[0], prev: null, n: 0 });
  const [answer, setAnswer] = useState("");
  const [dbgSpeed, setDbgSpeed] = useState(1);
  const [debug] = useState(() => typeof window !== "undefined" && /[?&]debug(?:[=&]|$)/.test(window.location.search));

  const rootRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const propsRef = useRef(props);
  propsRef.current = props;
  const speedRef = useRef(1);
  speedRef.current = Math.max(0.05, (props.speed ?? 1) * dbgSpeed);
  const phaseRef = useRef<Phase>("idle");
  const reducedRef = useRef(false);
  const rtRef = useRef<Runtime | null>(null);
  const lastTextRef = useRef("");
  const timers = useRef<{ typing?: number; shake?: number; flash?: number }>({});

  useIsoLayoutEffect(() => {
    const root = rootRef.current, mover = moverRef.current, actor = actorRef.current, canvas = canvasRef.current;
    const pulse = pulseRef.current, status = statusRef.current, form = formRef.current;
    const ghosts = ghostRefs.current.filter((g): g is HTMLSpanElement => !!g);
    if (!root || !mover || !actor || !canvas || !pulse || !status || !form) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMq = (e: MediaQueryListEvent) => { reducedRef.current = e.matches; };
    mq.addEventListener("change", onMq);

    const rt = createRuntime({
      root, mover, actor, form, ghosts, canvas, pulse, status,
      getBody: () => bodyRef.current,
      getSpeed: () => speedRef.current,
      isReduced: () => reducedRef.current,
      ui: {
        setPhase: (p) => { phaseRef.current = p; setPhaseState(p); },
        swapLabel: (name) => setLbl((l) => (l.cur === name ? l : { cur: name, prev: l.cur, n: l.n + 1 })),
        resetLabel: () => setLbl((l) => ({ cur: COPY.labels[0], prev: null, n: l.n + 1 })),
        setAnswer: (s) => setAnswer(s),
        clearInput: () => setValue(""),
        live: (s) => { if (liveRef.current) liveRef.current.textContent = s; },
        lock: (on) => { form.toggleAttribute("inert", on); },
        idleReady: () => { inputRef.current?.focus({ preventScroll: true }); },
        focusAnswer: () => { answerRef.current?.focus({ preventScroll: true }); },
      },
    });
    rtRef.current = rt;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phaseRef.current !== "idle" && phaseRef.current !== "reset") {
        e.preventDefault();
        rt.escape();
      }
    };
    const onResize = () => {
      if (phaseRef.current === "idle" && !rt.busy()) rt.home();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    inputRef.current?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onMq);
      window.clearTimeout(timers.current.typing);
      window.clearTimeout(timers.current.shake);
      window.clearTimeout(timers.current.flash);
      rt.destroy();
      rtRef.current = null;
    };
  }, []);

  const defaultSubmit = () =>
    new Promise<string>((res) => {
      window.setTimeout(() => res(COPY.answerBody), 4600 / speedRef.current);
    });
  const makeCfg = (): RunCfg => ({
    onSubmit: propsRef.current.onSubmit ?? defaultSubmit,
    minThink: propsRef.current.minThinkMs ?? 3450,
  });

  const shake = () => {
    const a = actorRef.current;
    if (!a) return;
    a.removeAttribute("data-shake");
    void a.offsetWidth;
    a.setAttribute("data-shake", "");
    a.setAttribute("data-flash", "");
    window.clearTimeout(timers.current.shake);
    window.clearTimeout(timers.current.flash);
    timers.current.shake = window.setTimeout(() => a.removeAttribute("data-shake"), 260);
    timers.current.flash = window.setTimeout(() => a.removeAttribute("data-flash"), 200);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    const a = actorRef.current;
    if (!a) return;
    a.setAttribute("data-typing", "");
    window.clearTimeout(timers.current.typing);
    timers.current.typing = window.setTimeout(() => a.removeAttribute("data-typing"), 300);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.shiftKey || e.nativeEvent.isComposing)) e.preventDefault();
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rt = rtRef.current;
    if (!rt || rt.busy() || phaseRef.current !== "idle") return;
    const text = value.trim();
    if (!text) { shake(); return; }
    lastTextRef.current = text;
    rt.start(text, makeCfg());
  };

  const onReset = () => {
    if (phaseRef.current === "answered") rtRef.current?.reset();
  };

  const replay = () => {
    const rt = rtRef.current;
    if (!rt) return;
    const text = lastTextRef.current || "hello";
    lastTextRef.current = text;
    rt.hard();
    setValue(text);
    window.requestAnimationFrame(() => { rt.start(text, makeCfg()); });
  };

  const ready = value.trim().length > 0;
  const words = answer.split(/\s+/).filter(Boolean);

  const labelInner = (name: string) =>
    name === COPY.done ? (
      <span className="mo-lab-done">{name}</span>
    ) : (
      <>
        <span className="mo-lab-t">{name}</span>
        <span className="mo-dots" aria-hidden="true"><i /><i /><i /></span>
      </>
    );

  return (
    <div className="mo-root" data-phase={phase} ref={rootRef}>
      <div className="mo-bg" aria-hidden="true" />
      <div className="mo-halo" aria-hidden="true" />

      <div className="mo-mover" ref={moverRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="mo-trail" aria-hidden="true" ref={(el) => { ghostRefs.current[i] = el; }} />
        ))}

        <div className="mo-actor" ref={actorRef}>
          <div className="mo-underglow" aria-hidden="true" />
          <div className="mo-halo-green" aria-hidden="true" />
          <div className="mo-surface" aria-hidden="true">
            <div className="mo-aurora"><i /><i /><i /><i /></div>
          </div>
          <div className="mo-ball" aria-hidden="true" />
          <div className="mo-green" aria-hidden="true" />
          <div className="mo-card" aria-hidden="true" />
          <div className="mo-ring" aria-hidden="true" />

          <form className="mo-input" ref={formRef} onSubmit={onFormSubmit} autoComplete="off">
            <svg className="mo-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3.5l1.7 4.8 4.8 1.7-4.8 1.7L10 16.5l-1.7-4.8L3.5 10l4.8-1.7L10 3.5z" />
              <path d="M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
            </svg>
            <input
              ref={inputRef}
              className="mo-field"
              type="text"
              value={value}
              maxLength={200}
              placeholder={COPY.placeholder}
              aria-label="Ask anything"
              spellCheck={false}
              onChange={onChange}
              onKeyDown={onKeyDown}
            />
            <button type="submit" className="mo-send" aria-label={COPY.send} data-ready={ready ? "" : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5" />
                <path d="M5.5 11.5L12 5l6.5 6.5" />
              </svg>
            </button>
          </form>

          <canvas className="mo-orb" ref={canvasRef} aria-hidden="true" />
          <div className="mo-pulse" ref={pulseRef} aria-hidden="true" />

          <div className="mo-answer" ref={answerRef} tabIndex={-1} role="group" aria-label={COPY.answerTitle}>
            <div className="mo-a-head">
              <i className="mo-a-dot" aria-hidden="true" />
              <span>{COPY.answerTitle}</span>
            </div>
            <p className="mo-a-body" ref={bodyRef}>
              {words.map((w, i) => (
                <React.Fragment key={i}>
                  <span className="mo-w">{w}</span>{" "}
                </React.Fragment>
              ))}
            </p>
          </div>
        </div>
      </div>

      <div className="mo-status" ref={statusRef} aria-hidden="true">
        {lbl.prev !== null && (
          <span key={"p" + lbl.n} className="mo-lab mo-out">{labelInner(lbl.prev)}</span>
        )}
        <span key={"c" + lbl.n} className="mo-lab mo-in">{labelInner(lbl.cur)}</span>
      </div>

      <button type="button" className="mo-reset" onClick={onReset}>{COPY.reset}</button>

      <div className="mo-live" ref={liveRef} role="status" aria-live="polite" />

      {debug && (
        <div className="mo-debug">
          <span className="mo-chip">{phase}</span>
          <label>
            <span>{dbgSpeed.toFixed(2)}×</span>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={dbgSpeed}
              aria-label="Speed"
              onChange={(e) => setDbgSpeed(parseFloat(e.target.value))}
            />
          </label>
          <button type="button" onClick={replay}>Replay</button>
        </div>
      )}
    </div>
  );
}

demo.tsx
import MorphOrb from "@/components/ui/ai-thiking-orb-and-input";

export default function DemoOne() {
  return (
    <div className="flex min-h-[450px] w-full items-center justify-center p-4">
      <MorphOrb />
    </div>
  );
}
```

Extend existing Tailwind 4 index.css with this code (or if project uses Tailwind 3, extend tailwind.config.js or globals.css):
```css
@import "tailwindcss";
@import "tw-animate-css";


@keyframes mo-spin {
  to {
    --angle: 360deg;
  }
}

@keyframes mo-drift {
  from {
    transform: translateX(-14%);
  }
  to {
    transform: translateX(14%);
  }
}

@keyframes mo-shimmer {
  from {
    background-position: 150% 0;
  }
  to {
    background-position: -100% 0;
  }
}

@keyframes mo-dot {
  0%, 80%, 100% {
    opacity: .25;
  }
  40% {
    opacity: 1;
  }
}

@keyframes mo-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes mo-out {
  from {
    opacity: 1;
    transform: none;
  }
  to {
    opacity: 0;
    transform: translateY(-6px);
  }
}

@keyframes mo-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes mo-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes mo-shake {
  0%, 100% {
    transform: translate(-50%, -50%);
  }
  25% {
    transform: translate(calc(-50% - 4px), -50%);
  }
  75% {
    transform: translate(calc(-50% + 4px), -50%);
  }
}
```
---

LEADS-TREE:
You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
tree.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ItemInstance } from '@headless-tree/core';
import { ChevronDownIcon, SquareMinus, SquarePlus } from 'lucide-react';
import { Slot as SlotPrimitive } from 'radix-ui';

type ToggleIconType = 'chevron' | 'plus-minus';

interface TreeContextValue<T = any> {
  indent: number;
  currentItem?: ItemInstance<T>;
  tree?: any;
  toggleIconType?: ToggleIconType;
}

const TreeContext = React.createContext<TreeContextValue>({
  indent: 20,
  currentItem: undefined,
  tree: undefined,
  toggleIconType: 'plus-minus',
});

function useTreeContext<T = any>() {
  return React.useContext(TreeContext) as TreeContextValue<T>;
}

interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  indent?: number;
  tree?: any;
  toggleIconType?: ToggleIconType;
}

function Tree({ indent = 20, tree, className, toggleIconType = 'chevron', ...props }: TreeProps) {
  const containerProps = tree && typeof tree.getContainerProps === 'function' ? tree.getContainerProps() : {};
  const mergedProps = { ...props, ...containerProps };

  // Extract style from mergedProps to merge with our custom styles
  const { style: propStyle, ...otherProps } = mergedProps;

  // Merge styles
  const mergedStyle = {
    ...propStyle,
    '--tree-indent': `${indent}px`,
  } as React.CSSProperties;

  return (
    <TreeContext.Provider value={{ indent, tree, toggleIconType }}>
      <div data-slot="tree" style={mergedStyle} className={cn('flex flex-col', className)} {...otherProps} />
    </TreeContext.Provider>
  );
}

interface TreeItemProps<T = any> extends React.HTMLAttributes<HTMLButtonElement> {
  item: ItemInstance<T>;
  indent?: number;
  asChild?: boolean;
}

function TreeItem<T = any>({ item, className, asChild, children, ...props }: Omit<TreeItemProps<T>, 'indent'>) {
  const parentContext = useTreeContext<T>();
  const { indent } = parentContext;

  const itemProps = typeof item.getProps === 'function' ? item.getProps() : {};
  const mergedProps = { ...props, ...itemProps };

  // Extract style from mergedProps to merge with our custom styles
  const { style: propStyle, ...otherProps } = mergedProps;

  // Merge styles
  const mergedStyle = {
    ...propStyle,
    '--tree-padding': `${item.getItemMeta().level * indent}px`,
  } as React.CSSProperties;

  const Comp = asChild ? SlotPrimitive.Slot : 'button';

  return (
    <TreeContext.Provider value={{ ...parentContext, currentItem: item }}>
      <Comp
        data-slot="tree-item"
        style={mergedStyle}
        className={cn(
          'z-10 ps-(--tree-padding) outline-hidden select-none not-last:pb-0.5 focus:z-20 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          className,
        )}
        data-focus={typeof item.isFocused === 'function' ? item.isFocused() || false : undefined}
        data-folder={typeof item.isFolder === 'function' ? item.isFolder() || false : undefined}
        data-selected={typeof item.isSelected === 'function' ? item.isSelected() || false : undefined}
        data-drag-target={typeof item.isDragTarget === 'function' ? item.isDragTarget() || false : undefined}
        data-search-match={typeof item.isMatchingSearch === 'function' ? item.isMatchingSearch() || false : undefined}
        aria-expanded={item.isExpanded()}
        {...otherProps}
      >
        {children}
      </Comp>
    </TreeContext.Provider>
  );
}

interface TreeItemLabelProps<T = any> extends React.HTMLAttributes<HTMLSpanElement> {
  item?: ItemInstance<T>;
}

function TreeItemLabel<T = any>({ item: propItem, children, className, ...props }: TreeItemLabelProps<T>) {
  const { currentItem, toggleIconType } = useTreeContext<T>();
  const item = propItem || currentItem;

  if (!item) {
    console.warn('TreeItemLabel: No item provided via props or context');
    return null;
  }

  return (
    <span
      data-slot="tree-item-label"
      className={cn(
        'in-focus-visible:ring-ring/50 bg-background hover:bg-accent in-data-[selected=true]:bg-accent in-data-[selected=true]:text-accent-foreground in-data-[drag-target=true]:bg-accent flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm transition-colors not-in-data-[folder=true]:ps-7 in-focus-visible:ring-[3px] in-data-[search-match=true]:bg-blue-50! [&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {item.isFolder() &&
        (toggleIconType === 'plus-minus' ? (
          item.isExpanded() ? (
            <SquareMinus className="text-muted-foreground size-3.5" stroke="currentColor" strokeWidth="1" />
          ) : (
            <SquarePlus className="text-muted-foreground size-3.5" stroke="currentColor" strokeWidth="1" />
          )
        ) : (
          <ChevronDownIcon className="text-muted-foreground size-4 in-aria-[expanded=false]:-rotate-90" />
        ))}
      {children || (typeof item.getItemName === 'function' ? item.getItemName() : null)}
    </span>
  );
}

function TreeDragLine({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { tree } = useTreeContext();

  if (!tree || typeof tree.getDragLineStyle !== 'function') {
    console.warn('TreeDragLine: No tree provided via context or tree does not have getDragLineStyle method');
    return null;
  }

  const dragLine = tree.getDragLineStyle();
  return (
    <div
      style={dragLine}
      className={cn(
        'bg-primary before:bg-background before:border-primary absolute z-30 -mt-px h-0.5 w-[unset] before:absolute before:-top-[3px] before:left-0 before:size-2 before:rounded-full before:border-2',
        className,
      )}
      {...props}
    />
  );
}

export { Tree, TreeItem, TreeItemLabel, TreeDragLine };




demo.tsx
'use client';

import React from 'react';
import { Tree, TreeItem, TreeItemLabel } from '@/components/ui/tree';
import { hotkeysCoreFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react';

interface Item {
  name: string;
  children?: string[];
}

const items: Record<string, Item> = {
  crm: {
    name: 'CRM',
    children: ['leads', 'accounts', 'activities', 'support'],
  },
  leads: {
    name: 'Leads',
    children: ['new-lead', 'contacted-lead', 'qualified-lead'],
  },
  'new-lead': { name: 'New Lead' },
  'contacted-lead': { name: 'Contacted Lead' },
  'qualified-lead': { name: 'Qualified Lead' },
  accounts: {
    name: 'Accounts',
    children: ['acme-corp', 'globex-inc'],
  },
  'acme-corp': {
    name: 'Acme Corp',
    children: ['acme-contacts', 'acme-opportunities'],
  },
  'acme-contacts': {
    name: 'Contacts',
    children: ['john-smith', 'jane-doe'],
  },
  'john-smith': { name: 'John Smith' },
  'jane-doe': { name: 'Jane Doe' },
  'acme-opportunities': {
    name: 'Opportunities',
    children: ['website-redesign', 'annual-maintenance'],
  },
  'website-redesign': { name: 'Website Redesign' },
  'annual-maintenance': { name: 'Annual Maintenance' },
  'globex-inc': {
    name: 'Globex Inc',
    children: ['globex-contacts', 'globex-opportunities'],
  },
  'globex-contacts': {
    name: 'Contacts',
    children: ['alice-johnson'],
  },
  'alice-johnson': { name: 'Alice Johnson' },
  'globex-opportunities': {
    name: 'Opportunities',
    children: ['cloud-migration'],
  },
  'cloud-migration': { name: 'Cloud Migration' },
  activities: {
    name: 'Activities',
    children: ['calls', 'meetings', 'emails'],
  },
  calls: { name: 'Calls' },
  meetings: { name: 'Meetings' },
  emails: { name: 'Emails' },
  support: {
    name: 'Support',
    children: ['open-tickets', 'closed-tickets'],
  },
  'open-tickets': { name: 'Open Tickets' },
  'closed-tickets': { name: 'Closed Tickets' },
};

const indent = 20;

export default function Component() {
  const tree = useTree<Item>({
    initialState: {
      expandedItems: ['leads', 'accounts', 'activities'],
    },
    indent,
    rootItemId: 'crm',
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData()?.children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => items[itemId],
      getChildren: (itemId) => items[itemId].children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  return (
    <div className="flex flex-col gap-5 p-10 w-full mx-auto max-w-[300px] h-screen justify-center items-center">
        <div className="self-start lg:w-[225px]">
        <Tree
            className="relative before:absolute before:inset-0 before:-ms-1.25 before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)))]"
            indent={indent}
            tree={tree}
            toggleIconType="plus-minus"
        >
            {tree.getItems().map((item) => {
            return (
                <TreeItem key={item.getId()} item={item}>
                <TreeItemLabel className="before:bg-background relative before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10">
                    <span className="flex items-center gap-2 ms-1">
                    {item.isFolder() ? (
                        item.isExpanded() ? (
                        <FolderOpenIcon className="text-muted-foreground pointer-events-none size-4" />
                        ) : (
                        <FolderIcon className="text-muted-foreground pointer-events-none size-4" />
                        )
                    ) : (
                        <FileIcon className="text-muted-foreground pointer-events-none size-4" />
                    )}
                    {item.getItemName()}
                    </span>
                </TreeItemLabel>
                </TreeItem>
            );
            })}
        </Tree>
        </div>
    </div>
  );
}

```

Install NPM dependencies:
```bash
radix-ui, lucide-react, @headless-tree/core
```
---

COLOR-PICKER:
You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
color-picker.tsx
"use client";

/**
 * ColorPicker, saturation/value canvas + hue/alpha rails + HEX/RGB/HSL fields.
 *
 * HSV is the internal source of truth so dragging through pure black or pure
 * white does not discard hue/saturation the way a hex round-trip would.
 * Chrome is token-driven; only the color surfaces themselves carry live values.
 */

import * as React from "react";
import { IconColorPicker, IconSelector, IconCheck } from "@tabler/icons-react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ─── color math ────────────────────────────────────────────── */

export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (n: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, n));

const round = (n: number, digits = 0) => {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
};

function hsvaToRgba({ h, s, v, a }: Hsva): Rgba {
  const hh = ((h % 360) + 360) % 360 / 60;
  const ss = s / 100;
  const vv = v / 100;
  const c = vv * ss;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = vv - c;
  const seg = Math.floor(hh) % 6;
  const segments: readonly (readonly [number, number, number])[] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = segments[seg] ?? segments[0]!;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a,
  };
}

function rgbaToHsva({ r, g, b, a }: Rgba): Hsva {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / d) % 6);
    else if (max === gg) h = 60 * ((bb - rr) / d + 2);
    else h = 60 * ((rr - gg) / d + 4);
  }
  if (h < 0) h += 360;
  return {
    h: round(h, 1),
    s: max === 0 ? 0 : round((d / max) * 100, 1),
    v: round(max * 100, 1),
    a,
  };
}

function hsvaToHsl({ h, s, v }: Hsva) {
  const vv = v / 100;
  const ss = s / 100;
  const l = vv * (1 - ss / 2);
  const sl = l === 0 || l === 1 ? 0 : (vv - l) / Math.min(l, 1 - l);
  return { h: Math.round(h), s: Math.round(sl * 100), l: Math.round(l * 100) };
}

function hslToHsva(h: number, s: number, l: number, a: number): Hsva {
  const ll = l / 100;
  const ss = s / 100;
  const v = ll + ss * Math.min(ll, 1 - ll);
  return {
    h: ((h % 360) + 360) % 360,
    s: v === 0 ? 0 : (2 * (1 - ll / v)) * 100,
    v: v * 100,
    a,
  };
}

const hex2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");

export function rgbaToHex({ r, g, b, a }: Rgba, withAlpha = false): string {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  if (!withAlpha || a >= 1) return base;
  return `${base}${hex2(a * 255)}`;
}

/** Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` (with or without `#`). */
export function parseHex(input: string): Rgba | null {
  const raw = input.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return null;
  const full =
    raw.length <= 4
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
  };
}

/** WCAG relative luminance, used to pick a readable mark over a swatch. */
function isLightColor({ r, g, b }: Rgba) {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) > 0.45;
}

function hsvaToCss(hsva: Hsva, withAlpha: boolean) {
  const { r, g, b, a } = hsvaToRgba(hsva);
  return withAlpha ? `rgba(${r}, ${g}, ${b}, ${round(a, 2)})` : `rgb(${r}, ${g}, ${b})`;
}

/* ─── shared chrome ─────────────────────────────────────────── */

export type ColorFormat = "hex" | "rgb" | "hsl";

const FORMAT_ORDER: ColorFormat[] = ["hex", "rgb", "hsl"];

/**
 * 8px alpha checkerboard, drawn behind every translucent swatch.
 * These carry position/size syntax and a trailing base color, so they are only
 * valid in the `background` shorthand, `background-image` rejects both and
 * silently drops the whole declaration.
 */
const CHECKERBOARD_LAYER =
  "repeating-conic-gradient(color-mix(in srgb, var(--foreground) 26%, transparent) 0% 25%, transparent 0% 50%) 50% / 8px 8px";
const CHECKERBOARD_BASE = "var(--background)";
const CHECKERBOARD = `${CHECKERBOARD_LAYER}, ${CHECKERBOARD_BASE}`;

const thumbRingClass = cn(
  "pointer-events-none absolute block rounded-full",
  "border-2 border-white",
  "shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_1px_4px_rgba(0,0,0,0.4)]",
);

const focusRing = cn(
  "outline-none",
  "focus-visible:ring-2 focus-visible:ring-[color:var(--primitive-ring,color-mix(in_srgb,var(--foreground)_45%,transparent))]",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--primitive-surface-overlay,var(--popover))]",
);

/** Maps a pointer event to 0..1 coordinates inside `el`. */
function pointerRatio(el: HTMLElement, event: { clientX: number; clientY: number }) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.width === 0 ? 0 : clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: rect.height === 0 ? 0 : clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

function useDrag(
  onMove: (el: HTMLElement, event: { clientX: number; clientY: number }) => void,
  disabled?: boolean,
) {
  const [dragging, setDragging] = React.useState(false);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0) return;
      const el = event.currentTarget;
      el.setPointerCapture(event.pointerId);
      setDragging(true);
      el.focus();
      onMove(el, event);
    },
    [disabled, onMove],
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      event.preventDefault();
      onMove(event.currentTarget, event);
    },
    [dragging, onMove],
  );

  const stop = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }, []);

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: stop,
      onPointerCancel: stop,
    },
  };
}

/** Arrow/Home/End stepping shared by the canvas and both rails. */
function arrowStep(
  key: string,
  step: number,
  big: number,
): { dx: number; dy: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { dx: -step, dy: 0 };
    case "ArrowRight":
      return { dx: step, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: step };
    case "ArrowDown":
      return { dx: 0, dy: -step };
    case "PageUp":
      return { dx: big, dy: big };
    case "PageDown":
      return { dx: -big, dy: -big };
    default:
      return null;
  }
}

/* ─── saturation / value canvas ─────────────────────────────── */

function SaturationCanvas({
  hsva,
  onChange,
  disabled,
  className,
}: {
  hsva: Hsva;
  onChange: (next: { s: number; v: number }) => void;
  disabled?: boolean;
  className?: string;
}) {
  const apply = React.useCallback(
    (el: HTMLElement, event: { clientX: number; clientY: number }) => {
      const { x, y } = pointerRatio(el, event);
      onChange({ s: round(x * 100, 1), v: round((1 - y) * 100, 1) });
    },
    [onChange],
  );

  const { dragging, handlers } = useDrag(apply, disabled);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onChange(event.key === "Home" ? { s: 0, v: 100 } : { s: 100, v: 100 });
      return;
    }
    const delta = arrowStep(event.key, event.shiftKey ? 10 : 1, 10);
    if (!delta) return;
    event.preventDefault();
    onChange({
      s: clamp(hsva.s + delta.dx),
      v: clamp(hsva.v + delta.dy),
    });
  };

  return (
    <div
      role="slider"
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(hsva.s)}%, brightness ${Math.round(hsva.v)}%`}
      aria-disabled={disabled || undefined}
      data-dragging={dragging || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      {...handlers}
      className={cn(
        "relative isolate w-full touch-none select-none",
        disabled ? "cursor-not-allowed" : dragging ? "cursor-grabbing" : "cursor-crosshair",
        focusRing,
        "focus-visible:ring-inset focus-visible:ring-offset-0",
        className,
      )}
      style={{ backgroundColor: `hsl(${hsva.h} 100% 50%)` }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#fff,transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,#000,transparent)]" />
      <span
        className={cn(
          thumbRingClass,
          "size-4 -translate-x-1/2 -translate-y-1/2",
          "transition-transform duration-100 ease-out data-[dragging]:scale-110",
          "motion-reduce:transition-none motion-reduce:data-[dragging]:scale-100",
        )}
        data-dragging={dragging || undefined}
        style={{
          // Clamped by half the thumb so it never clips against the panel's
          // rounded, overflow-hidden edges at the fully saturated corners.
          left: `clamp(8px, ${hsva.s}%, calc(100% - 8px))`,
          top: `clamp(8px, ${100 - hsva.v}%, calc(100% - 8px))`,
          backgroundColor: hsvaToCss({ ...hsva, a: 1 }, false),
        }}
      />
    </div>
  );
}

/* ─── rails ─────────────────────────────────────────────────── */

function Rail({
  label,
  value,
  max,
  step = 1,
  valueText,
  trackStyle,
  thumbColor,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  valueText: string;
  trackStyle: React.CSSProperties;
  thumbColor: string;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const apply = React.useCallback(
    (el: HTMLElement, event: { clientX: number; clientY: number }) => {
      onChange(round(pointerRatio(el, event).x * max, 2));
    },
    [max, onChange],
  );

  const { dragging, handlers } = useDrag(apply, disabled);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onChange(event.key === "Home" ? 0 : max);
      return;
    }
    const unit = step * (event.shiftKey ? 10 : 1);
    const delta = arrowStep(event.key, unit, step * 10);
    if (!delta) return;
    event.preventDefault();
    onChange(round(clamp(value + (delta.dx || delta.dy), 0, max), 2));
  };

  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={round(value, 1)}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      {...handlers}
      className={cn(
        "relative h-3 w-full touch-none select-none rounded-full",
        "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_12%,transparent)]",
        disabled ? "cursor-not-allowed" : dragging ? "cursor-grabbing" : "cursor-pointer",
        focusRing,
      )}
      style={trackStyle}
    >
      <span
        className={cn(
          thumbRingClass,
          "top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2",
          "transition-transform duration-100 ease-out data-[dragging]:scale-110",
          "motion-reduce:transition-none motion-reduce:data-[dragging]:scale-100",
        )}
        data-dragging={dragging || undefined}
        style={{
          // Inset by half the thumb so it never overhangs either rail end.
          left: `calc(9px + ${value / max} * (100% - 18px))`,
          background: thumbColor,
        }}
      />
    </div>
  );
}

/* ─── numeric + hex fields ──────────────────────────────────── */

const fieldShellClass = cn(
  "flex h-8 w-full items-center rounded-[var(--primitive-radius-control-sm,0.625rem)]",
  "border border-[var(--border)] bg-[var(--background)]",
  "transition-[border-color,box-shadow] duration-150 ease-[var(--primitive-ease,cubic-bezier(0.23,1,0.32,1))]",
  "hover:border-[color-mix(in_srgb,var(--foreground)_16%,transparent)]",
  "focus-within:border-[color-mix(in_srgb,var(--foreground)_26%,transparent)]",
  "focus-within:ring-2 focus-within:ring-[color:var(--primitive-ring,color-mix(in_srgb,var(--foreground)_45%,transparent))]",
  "focus-within:ring-offset-2 focus-within:ring-offset-[color:var(--primitive-surface-overlay,var(--popover))]",
  "motion-reduce:transition-none",
);

const fieldInputClass = cn(
  "h-full w-full bg-transparent text-center text-xs font-medium tabular-nums",
  "text-[var(--foreground)] outline-none",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
  "disabled:cursor-not-allowed",
);

function ChannelField({
  label,
  value,
  min,
  max,
  onCommit,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (next: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? String(Math.round(value));

  const commit = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    setDraft(null);
    if (Number.isNaN(parsed)) return;
    onCommit(clamp(Math.round(parsed), min, max));
  };

  return (
    <label className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <span className={fieldShellClass}>
        <input
          type="text"
          inputMode="numeric"
          value={shown}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(event.currentTarget.value);
            }
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              const step = (event.shiftKey ? 10 : 1) * (event.key === "ArrowUp" ? 1 : -1);
              setDraft(null);
              onCommit(clamp(Math.round(value) + step, min, max));
            }
          }}
          className={fieldInputClass}
        />
      </span>
      <span className="text-[10px] font-medium tracking-[0.08em] text-[color:var(--primitive-text-secondary,color-mix(in_srgb,var(--foreground)_72%,transparent))]">
        {label}
      </span>
    </label>
  );
}

function HexField({
  hex,
  onCommit,
  disabled,
}: {
  hex: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = (draft ?? hex).replace(/^#/, "").toUpperCase();

  const commit = (raw: string) => {
    setDraft(null);
    if (parseHex(raw)) onCommit(raw.startsWith("#") ? raw : `#${raw}`);
  };

  return (
    <label className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <span className={fieldShellClass}>
        <span className="pl-2.5 text-xs text-[color:var(--primitive-text-placeholder,var(--muted-foreground))]">#</span>
        <input
          type="text"
          spellCheck={false}
          autoComplete="off"
          value={shown}
          disabled={disabled}
          aria-label="Hex color"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(event.currentTarget.value);
            }
          }}
          className={cn(fieldInputClass, "pl-1 pr-2.5 text-left uppercase tracking-[0.08em]")}
        />
      </span>
      <span className="text-[10px] font-medium tracking-[0.08em] text-[color:var(--primitive-text-secondary,color-mix(in_srgb,var(--foreground)_72%,transparent))]">
        HEX
      </span>
    </label>
  );
}

/* ─── eyedropper ────────────────────────────────────────────── */

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/** Support never changes for the life of the document, so nothing subscribes. */
const subscribeToNothing = () => () => {};

function useEyeDropper() {
  // Read through useSyncExternalStore rather than an effect: the server
  // snapshot is false, so SSR and the first client paint agree on markup
  // without a post-mount setState and the re-render it costs.
  const supported = React.useSyncExternalStore(
    subscribeToNothing,
    () => "EyeDropper" in window,
    () => false,
  );

  const pick = React.useCallback(async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) return null;
    try {
      const result = await new Ctor().open();
      return result.sRGBHex;
    } catch {
      // User dismissed with Escape, not an error worth surfacing.
      return null;
    }
  }, []);

  return { supported, pick };
}

/* ─── panel ─────────────────────────────────────────────────── */

export interface ColorPickerPanelProps {
  /** Controlled color as a hex string (`#rrggbb` or `#rrggbbaa`). */
  value?: string;
  /** Initial color when uncontrolled. */
  defaultValue?: string;
  /** Fires on every committed change with a hex string. */
  onChange?: (hex: string) => void;
  /** Initial format shown in the fields row. */
  format?: ColorFormat;
  /** Adds the alpha rail and emits 8-digit hex below full opacity. */
  alpha?: boolean;
  /** Shows the eyedropper button where the browser supports it. */
  eyedropper?: boolean;
  /** Preset hex swatches rendered under the fields. */
  swatches?: string[];
  /** Disables every control. */
  disabled?: boolean;
  className?: string;
}

const DEFAULT_COLOR = "#3b82f6";

function useColorState({
  value,
  defaultValue,
  onChange,
  alpha,
}: Pick<ColorPickerPanelProps, "value" | "defaultValue" | "onChange" | "alpha">) {
  const withAlpha = Boolean(alpha);

  const [hsva, setHsvaState] = React.useState<Hsva>(() => {
    const parsed = parseHex(value ?? defaultValue ?? DEFAULT_COLOR) ??
      parseHex(DEFAULT_COLOR)!;
    return rgbaToHsva(parsed);
  });

  const rgba = React.useMemo(() => hsvaToRgba(hsva), [hsva]);
  const hex = React.useMemo(() => rgbaToHex(rgba, withAlpha), [rgba, withAlpha]);

  // Adopt an external controlled value only when it is a different color than
  // the one currently rendered, so hue survives achromatic round-trips and the
  // value we just emitted does not bounce back through here.
  //
  // This adjusts state during render rather than in an effect: React discards
  // the render and retries immediately, so the external color is never painted
  // one frame late. The condition clears once adopted, since `hex` recomputes
  // from the new state and both sides are normalised through `rgbaToHex`.
  const externalRgba = value === undefined ? null : parseHex(value);
  if (
    externalRgba &&
    rgbaToHex(externalRgba, withAlpha).toLowerCase() !== hex.toLowerCase()
  ) {
    setHsvaState((prev) => {
      const next = rgbaToHsva(externalRgba);
      return { ...next, h: next.s === 0 || next.v === 0 ? prev.h : next.h };
    });
  }

  // Commit outside the updater, a state updater must stay pure, so onChange
  // is called with the already-computed next color.
  const commit = (next: Hsva) => {
    setHsvaState(next);
    onChange?.(rgbaToHex(hsvaToRgba(next), withAlpha));
  };

  const setHsva = (patch: Partial<Hsva>) => commit({ ...hsva, ...patch });

  const setFromRgba = (next: Rgba) => {
    const converted = rgbaToHsva(next);
    commit({
      ...converted,
      h: converted.s === 0 || converted.v === 0 ? hsva.h : converted.h,
    });
  };

  return { hsva, rgba, hex, withAlpha, setHsva, setFromRgba };
}

export function ColorPickerPanel({
  value,
  defaultValue,
  onChange,
  format = "hex",
  alpha = false,
  eyedropper = true,
  swatches,
  disabled,
  className,
}: ColorPickerPanelProps) {
  const { hsva, rgba, hex, withAlpha, setHsva, setFromRgba } = useColorState({
    value,
    defaultValue,
    onChange,
    alpha,
  });

  const [activeFormat, setActiveFormat] = React.useState<ColorFormat>(format);
  const { supported: dropperSupported, pick } = useEyeDropper();
  const hsl = hsvaToHsl(hsva);
  const solid = hsvaToCss({ ...hsva, a: 1 }, false);
  const current = hsvaToCss(hsva, withAlpha);

  const cycleFormat = () =>
    setActiveFormat(
      (prev) =>
        FORMAT_ORDER[(FORMAT_ORDER.indexOf(prev) + 1) % FORMAT_ORDER.length] ?? "hex",
    );

  const onEyedropper = async () => {
    const picked = await pick();
    const parsed = picked ? parseHex(picked) : null;
    if (parsed) setFromRgba({ ...parsed, a: hsva.a });
  };

  const showDropper = eyedropper && dropperSupported;

  return (
    <div
      data-wensity-primitive=""
      data-slot="wensity-color-picker-panel"
      className={cn(
        "w-[268px] overflow-hidden select-none",
        "rounded-[var(--primitive-radius-surface,1rem)] border border-[var(--border)]",
        "bg-[color:var(--primitive-surface-overlay,var(--popover))] text-[var(--foreground)]",
        disabled && "pointer-events-none opacity-45",
        className,
      )}
    >
      <SaturationCanvas
        hsva={hsva}
        disabled={disabled}
        onChange={(next) => setHsva(next)}
        className="h-[164px]"
      />

      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2.5">
          {showDropper && (
            <button
              type="button"
              onClick={onEyedropper}
              disabled={disabled}
              aria-label="Pick a color from the screen"
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-[var(--primitive-radius-control-sm,0.625rem)]",
                "border border-[var(--border)] bg-[var(--background)]",
                "text-[color:var(--primitive-text-secondary,color-mix(in_srgb,var(--foreground)_72%,transparent))]",
                "transition-[color,background-color,border-color,transform] duration-100 ease-out",
                "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))] hover:text-[var(--foreground)]",
                "active:scale-[0.97] disabled:cursor-not-allowed",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
                focusRing,
              )}
            >
              <IconColorPicker size={15} stroke={1.7} aria-hidden />
            </button>
          )}

          <span
            aria-hidden
            className={cn(
              "size-8 shrink-0 rounded-full",
              "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent)]",
            )}
            style={{ background: CHECKERBOARD }}
          >
            <span
              className="block size-full rounded-full"
              style={{ backgroundColor: current }}
            />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <Rail
              label="Hue"
              value={hsva.h}
              max={360}
              valueText={`${Math.round(hsva.h)} degrees`}
              disabled={disabled}
              onChange={(h) => setHsva({ h })}
              thumbColor={`hsl(${hsva.h} 100% 50%)`}
              trackStyle={{
                backgroundImage:
                  "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
              }}
            />
            {withAlpha && (
              <Rail
                label="Opacity"
                value={hsva.a * 100}
                max={100}
                valueText={`${Math.round(hsva.a * 100)}%`}
                disabled={disabled}
                onChange={(a) => setHsva({ a: clamp(a, 0, 100) / 100 })}
                thumbColor={current}
                trackStyle={{
                  background: `linear-gradient(to right, transparent, ${solid}), ${CHECKERBOARD}`,
                }}
              />
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          {activeFormat === "hex" && (
            <HexField
              hex={hex}
              disabled={disabled}
              onCommit={(next) => {
                const parsed = parseHex(next);
                if (parsed) setFromRgba(withAlpha ? parsed : { ...parsed, a: hsva.a });
              }}
            />
          )}

          {activeFormat === "rgb" && (
            <>
              <ChannelField
                label="R"
                value={rgba.r}
                min={0}
                max={255}
                disabled={disabled}
                onCommit={(r) => setFromRgba({ ...rgba, r })}
              />
              <ChannelField
                label="G"
                value={rgba.g}
                min={0}
                max={255}
                disabled={disabled}
                onCommit={(g) => setFromRgba({ ...rgba, g })}
              />
              <ChannelField
                label="B"
                value={rgba.b}
                min={0}
                max={255}
                disabled={disabled}
                onCommit={(b) => setFromRgba({ ...rgba, b })}
              />
            </>
          )}

          {activeFormat === "hsl" && (
            <>
              <ChannelField
                label="H"
                value={hsl.h}
                min={0}
                max={360}
                disabled={disabled}
                onCommit={(h) => setHsva(hslToHsva(h, hsl.s, hsl.l, hsva.a))}
              />
              <ChannelField
                label="S"
                value={hsl.s}
                min={0}
                max={100}
                disabled={disabled}
                onCommit={(s) => setHsva(hslToHsva(hsl.h, s, hsl.l, hsva.a))}
              />
              <ChannelField
                label="L"
                value={hsl.l}
                min={0}
                max={100}
                disabled={disabled}
                onCommit={(l) => setHsva(hslToHsva(hsl.h, hsl.s, l, hsva.a))}
              />
            </>
          )}

          {withAlpha && activeFormat !== "hex" && (
            <ChannelField
              label="A"
              value={hsva.a * 100}
              min={0}
              max={100}
              disabled={disabled}
              onCommit={(a) => setHsva({ a: a / 100 })}
            />
          )}

          <button
            type="button"
            onClick={cycleFormat}
            disabled={disabled}
            aria-label={`Color format: ${activeFormat.toUpperCase()}. Switch format`}
            className={cn(
              "mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--primitive-radius-control-sm,0.625rem)]",
              "text-[color:var(--primitive-text-secondary,color-mix(in_srgb,var(--foreground)_72%,transparent))]",
              "transition-[color,background-color] duration-100 ease-out",
              "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))] hover:text-[var(--foreground)]",
              "active:scale-[0.97] disabled:cursor-not-allowed",
              "motion-reduce:transition-none motion-reduce:active:scale-100",
              focusRing,
            )}
          >
            <IconSelector size={15} stroke={1.7} aria-hidden />
          </button>
        </div>

        {swatches && swatches.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
            {swatches.map((swatch) => {
              const selected = swatch.toLowerCase() === hex.slice(0, 7).toLowerCase();
              const parsedSwatch = parseHex(swatch);
              const darkMark = parsedSwatch ? isLightColor(parsedSwatch) : false;
              return (
                <button
                  key={swatch}
                  type="button"
                  disabled={disabled}
                  aria-label={swatch}
                  aria-pressed={selected}
                  onClick={() => {
                    const parsed = parseHex(swatch);
                    if (parsed) setFromRgba({ ...parsed, a: hsva.a });
                  }}
                  className={cn(
                    "size-5 rounded-full",
                    "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_16%,transparent)]",
                    "transition-transform duration-100 ease-out",
                    "hover:scale-110 active:scale-[0.94]",
                    "motion-reduce:transition-none motion-reduce:hover:scale-100",
                    focusRing,
                  )}
                  style={{ backgroundColor: swatch }}
                >
                  <IconCheck
                    size={12}
                    stroke={2.6}
                    aria-hidden
                    className={cn(
                      "mx-auto",
                      selected ? "opacity-100" : "opacity-0",
                      // Tick follows the swatch's luminance, so it stays legible
                      // on both a near-black and a pale swatch.
                      darkMark
                        ? "text-black/80"
                        : "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]",
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── trigger + popover ─────────────────────────────────────── */

export interface ColorPickerProps extends ColorPickerPanelProps {
  /** Controlled open state of the popover. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Which side the panel opens on. */
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Hides the hex label inside the trigger. */
  showValue?: boolean;
  /** Replaces the default trigger. */
  children?: React.ReactNode;
}

export function ColorPicker({
  open,
  defaultOpen,
  onOpenChange,
  side = "bottom",
  align = "start",
  showValue = true,
  children,
  className,
  ...panelProps
}: ColorPickerProps) {
  const { value, defaultValue, alpha } = panelProps;
  const [internalHex, setInternalHex] = React.useState(
    () => value ?? defaultValue ?? DEFAULT_COLOR,
  );
  const hex = value ?? internalHex;
  const displayHex = React.useMemo(() => {
    const parsed = parseHex(hex);
    return parsed ? rgbaToHex(parsed, Boolean(alpha)) : hex;
  }, [hex, alpha]);

  return (
    <BasePopover.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}
    >
      <BasePopover.Trigger
        disabled={panelProps.disabled}
        render={
          children ? (
            (children as React.ReactElement)
          ) : (
            <button
              type="button"
              className={cn(
                "inline-flex h-[var(--primitive-control-height-md,2.25rem)] items-center gap-2.5",
                "rounded-[var(--primitive-radius-control,0.875rem)] border border-[var(--border)]",
                "bg-[var(--background)] pl-2 pr-3 text-sm text-[var(--foreground)]",
                "transition-[border-color,background-color,transform] duration-100 ease-out",
                "hover:border-[color-mix(in_srgb,var(--foreground)_16%,transparent)]",
                "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))]",
                "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
                focusRing,
                "focus-visible:ring-offset-[var(--background)]",
                className,
              )}
            >
              <span
                aria-hidden
                className="size-5 shrink-0 rounded-[6px] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_16%,transparent)]"
                style={{ background: CHECKERBOARD }}
              >
                <span
                  className="block size-full rounded-[6px]"
                  style={{ backgroundColor: displayHex }}
                />
              </span>
              {showValue && (
                <span className="font-medium uppercase tabular-nums tracking-[0.04em]">
                  {displayHex}
                </span>
              )}
            </button>
          )
        }
      />
      <BasePopover.Portal>
        <BasePopover.Positioner
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className="z-[var(--primitive-z-popover,130)] outline-none"
        >
          <BasePopover.Popup
            data-wensity-primitive=""
            className={cn(
              "origin-[var(--transform-origin)] transform-gpu outline-none",
              "rounded-[var(--primitive-radius-surface,1rem)]",
              "[box-shadow:var(--primitive-shadow-overlay,0_1px_2px_rgba(0,0,0,0.08),0_18px_48px_-24px_rgba(0,0,0,0.4))]",
              "transition-[opacity,scale] duration-[180ms] ease-[var(--primitive-ease,cubic-bezier(0.23,1,0.32,1))]",
              "data-[ending-style]:duration-[120ms]",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              "data-[starting-style]:scale-[0.96] data-[ending-style]:scale-[0.96]",
              "motion-reduce:transition-none motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100",
            )}
          >
            <ColorPickerPanel
              {...panelProps}
              onChange={(next) => {
                setInternalHex(next);
                panelProps.onChange?.(next);
              }}
            />
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}


demo.tsx
"use client";

import * as React from "react";
import { ColorPickerPanel } from "@/components/ui/color-picker";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const primitivePreviewCardSurfaceFrameClass = cn(
  "relative isolate overflow-hidden rounded-2xl",
  "border",
);

const primitivePreviewCardSurfaceLightClass = cn(
  "border-black/[0.08] bg-[#f4f4f5]",
  "[box-shadow:0_1px_2px_rgba(0,0,0,.06),0_8px_24px_-12px_rgba(0,0,0,.08)]",
);

const primitivePreviewCardSurfaceClass = cn(
  primitivePreviewCardSurfaceFrameClass,
  primitivePreviewCardSurfaceLightClass,
  // Full static `dark:bg-[#0a0a0b]` kept for Tailwind content scan - same as
  // PRIMITIVE_PREVIEW_CANVAS_DARK_BG / PRIMITIVE_PREVIEW_CANVAS_DARK.
  "dark:border-white/[0.06] dark:bg-[#0a0a0b] dark:[box-shadow:0_1px_2px_rgba(0,0,0,.4),0_8px_24px_-12px_rgba(0,0,0,.6)]",
);

function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        primitivePreviewCardSurfaceClass,
        "w-full max-w-sm p-4 sm:p-5",
        className,
      )}
    >
      <p className="mb-1 text-sm font-semibold tracking-[-0.015em] text-[var(--foreground)]">
        {title}
      </p>
      {subtitle ? (
        <p className="mb-4 text-[11px] text-[var(--muted-foreground)]">{subtitle}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </div>
  );
}

export function ColorPickerPreview() {
  const [color, setColor] = React.useState("#1d6fe8");

  return (
    <Panel title="Color picker" subtitle="Drag the canvas, or type a value.">
      <div className="flex justify-center">
        <ColorPickerPanel value={color} onChange={setColor} />
      </div>
    </Panel>
  );
}

export default function Demo() {
  return <ColorPickerPreview />;
}

```

Install NPM dependencies:
```bash
clsx, @base-ui/react, tailwind-merge, @tabler/icons-react
```
---

INVOICE-HISTORY-TABLE:
You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
settings64.tsx
"use client";

import {
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  FileText,
  XCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Invoice {
  date: string;
  amount: string;
  status: "paid" | "pending" | "failed";
  description: string;
  invoiceNumber: string;
  downloadUrl?: string;
}

interface Settings64Props {
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "outline";
  };
  heading?: string;
  description?: string;
  invoices?: Invoice[];
  labels?: {
    date?: string;
    description?: string;
    amount?: string;
    status?: string;
    paid?: string;
    pending?: string;
    failed?: string;
    download?: string;
    noInvoices?: string;
    viewAll?: string;
  };
  viewAllUrl?: string;
  className?: string;
}

export const settings64Demo: Settings64Props = {
  badge: { label: "Billing", variant: "secondary" },
  heading: "Billing History",
  description: "View and download your past invoices and payment history.",
  invoices: [
    {
      date: "Jan 1, 2024",
      amount: "$29.00",
      status: "paid",
      description: "Pro Plan - Monthly",
      invoiceNumber: "INV-2024-001",
      downloadUrl: "https://beste.co",
    },
    {
      date: "Dec 1, 2023",
      amount: "$29.00",
      status: "paid",
      description: "Pro Plan - Monthly",
      invoiceNumber: "INV-2023-012",
      downloadUrl: "https://beste.co",
    },
    {
      date: "Nov 1, 2023",
      amount: "$29.00",
      status: "paid",
      description: "Pro Plan - Monthly",
      invoiceNumber: "INV-2023-011",
      downloadUrl: "https://beste.co",
    },
    {
      date: "Oct 1, 2023",
      amount: "$29.00",
      status: "failed",
      description: "Pro Plan - Monthly",
      invoiceNumber: "INV-2023-010",
      downloadUrl: "https://beste.co",
    },
    {
      date: "Sep 1, 2023",
      amount: "$29.00",
      status: "paid",
      description: "Pro Plan - Monthly",
      invoiceNumber: "INV-2023-009",
      downloadUrl: "https://beste.co",
    },
  ],
  labels: {
    date: "Date",
    description: "Description",
    amount: "Amount",
    status: "Status",
    paid: "Paid",
    pending: "Pending",
    failed: "Failed",
    download: "Download",
    noInvoices: "No invoices yet",
    viewAll: "View All Invoices",
  },
  viewAllUrl: "https://beste.co",
};

export function Settings64({
  badge,
  heading,
  description,
  invoices = [],
  labels = {},
  viewAllUrl,
  className,
}: Settings64Props) {
  const {
    date: dateLabel,
    description: descLabel,
    amount: amountLabel,
    status: statusLabel,
    paid: paidLabel,
    pending: pendingLabel,
    failed: failedLabel,
    download: downloadLabel,
    noInvoices: noInvoicesLabel,
    viewAll: viewAllLabel,
  } = labels;

  const getStatusBadge = (invoiceStatus: Invoice["status"]) => {
    switch (invoiceStatus) {
      case "paid":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 font-normal"
          >
            <CheckCircle className="size-3" />
            {paidLabel}
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="outline"
            className="border-amber-500/20 bg-amber-500/10 text-amber-600 font-normal"
          >
            <Clock className="size-3" />
            {pendingLabel}
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="outline"
            className="border-rose-500/20 bg-rose-500/10 text-rose-600 font-normal"
          >
            <XCircle className="size-3" />
            {failedLabel}
          </Badge>
        );
    }
  };

  return (
    <section className={cn("py-16 md:py-24 w-full", className)}>
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            {badge?.label && (
              <Badge variant={badge.variant} className="w-fit">
                <CreditCard className="mr-1 size-3" />
                {badge.label}
              </Badge>
            )}
            {heading && (
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                {heading}
              </h2>
            )}
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>

          {invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center">
              <FileText className="size-12 text-muted-foreground" />
              <p className="text-muted-foreground">{noInvoicesLabel}</p>
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="px-4">{dateLabel}</TableHead>
                    <TableHead className="px-4">{descLabel}</TableHead>
                    <TableHead className="px-4">{amountLabel}</TableHead>
                    <TableHead className="px-4 text-center">
                      {statusLabel}
                    </TableHead>
                    <TableHead className="px-4 w-12 text-right">
                      {downloadLabel}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice, index) => (
                    <TableRow key={index}>
                      <TableCell className="px-4">
                        <div className="font-medium">{invoice.date}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.invoiceNumber}
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        {invoice.description}
                      </TableCell>
                      <TableCell className="px-4 font-medium">
                        {invoice.amount}
                      </TableCell>
                      <TableCell className="px-4 text-center">
                        {getStatusBadge(invoice.status)}
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        {invoice.downloadUrl ? (
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={invoice.downloadUrl}>
                              <Download className="size-4" />
                            </Link>
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" disabled>
                            <Download className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {invoices.length > 0 && viewAllUrl && (
            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <Link href={viewAllUrl}>{viewAllLabel}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Settings64;


demo.tsx
import Settings64, { settings64Demo } from "@/components/ui/settings64";

export default function Settings64Demo() {
  return <Settings64 {...settings64Demo} />;
}

```

Copy-paste these files for dependencies:
```tsx
shadcn/table
import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className,
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className,
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className,
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

```
```tsx
shadcn/badge
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

```
```tsx
shadcn/button
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }

```

Install NPM dependencies:
```bash
next, lucide-react, class-variance-authority, @radix-ui/react-slot
```
---
