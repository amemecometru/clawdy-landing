/**
 * Page renderer — the thing you actually sell.
 *
 * Takes a PageSpec and emits two renderings of it:
 *   renderPageHtml()   a standalone document served from mcp.clawdyclaw.com
 *   renderPageReact()  a .tsx component the agent can drop into its own repo
 *
 * Both walk the same block list, so a hosted page and the source the agent took
 * home cannot drift apart.
 *
 * Everything here is string building on purpose: the output has to be a single
 * self-contained file with no runtime dependency, because half the buyers are
 * agents that will never run a bundler.
 */

import type {
  CardsBlock,
  ConsentBlock,
  CtaBlock,
  FeaturesBlock,
  FormBlock,
  HeroBlock,
  PageBlock,
  PageSpec,
  Palette,
  StatsBlock,
} from "../../shared/pages";

// ── Escaping ──────────────────────────────────────────────────────────────────

/**
 * Agent-supplied strings land in HTML attributes and text nodes. Every
 * interpolation goes through this; never inline a raw spec value.
 */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Reject schemes that would let a spec smuggle javascript: into an href. */
export function safeHref(href: unknown): string {
  const raw = String(href ?? "").trim();
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(raw)) return esc(raw);
  return "#";
}

// ── Stylesheet ────────────────────────────────────────────────────────────────

function paletteVars(p: Palette): string {
  return [
    ["--bg", p.bg],
    ["--surface", p.surface],
    ["--text", p.text],
    ["--muted", p.muted],
    ["--border", p.border],
    ["--accent", p.accent],
    ["--accent-text", p.accentText],
  ]
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/**
 * One stylesheet for every page. It reads its colours from custom properties, so
 * retheming a page is a variable swap rather than a second stylesheet.
 */
const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--bg);color:var(--text);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;
  font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;
}
.wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 24px}
.wrap--narrow{max-width:760px}
section{padding:56px 0;border-top:1px solid var(--border)}
section:first-of-type{border-top:0}
h1,h2,h3{line-height:1.15;letter-spacing:-.02em;margin:0 0 .5em;font-weight:600}
h1{font-size:clamp(2rem,5vw,3.25rem)}
h2{font-size:clamp(1.4rem,3vw,2rem)}
h3{font-size:1.05rem}
p{margin:0 0 1em;color:var(--muted)}
.eyebrow{
  display:inline-block;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent);font-weight:600;margin:0 0 14px;
}
.lede{font-size:1.1rem;max-width:60ch}
.muted{color:var(--muted)}
.center{text-align:center}
.center .lede{margin-left:auto;margin-right:auto}

.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:11px 20px;border-radius:8px;font-size:.92rem;font-weight:600;
  text-decoration:none;border:1px solid transparent;cursor:pointer;
  transition:transform .12s ease,filter .12s ease;
}
.btn:hover{transform:translateY(-1px)}
.btn--primary{background:var(--accent);color:var(--accent-text)}
.btn--primary:hover{filter:brightness(1.08)}
.btn--ghost{border-color:var(--border);color:var(--text);background:transparent}
.btn--ghost:hover{border-color:var(--accent);color:var(--accent)}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
.center .actions{justify-content:center}

.grid{display:grid;gap:18px}
.grid--2{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.grid--3{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.grid--4{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.card{
  background:var(--surface);border:1px solid var(--border);border-radius:12px;
  padding:22px;transition:border-color .15s ease;
}
.card:hover{border-color:var(--accent)}
.card h3{margin-bottom:.35em}
.card p:last-child{margin-bottom:0}
.card--link{display:block;text-decoration:none;color:inherit}
.icon{width:18px;height:18px;color:var(--accent);margin-bottom:10px}
.tag{
  display:inline-block;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--muted);border:1px solid var(--border);border-radius:999px;
  padding:3px 9px;margin-bottom:10px;
}

/* Horizontal carousel — snap so a card never lands half-visible. */
.carousel{
  display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;
  padding-bottom:12px;margin:0 -24px;padding-left:24px;padding-right:24px;
  scrollbar-width:thin;
}
.carousel::-webkit-scrollbar{height:6px}
.carousel::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
.carousel>*{scroll-snap-align:start;flex:0 0 clamp(240px,72vw,320px)}

.stats{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px}
.stat__value{font-size:1.9rem;font-weight:650;letter-spacing:-.02em;line-height:1.1}
.stat__label{font-size:.78rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-top:6px}
.stat__hint{font-size:.8rem;color:var(--muted);margin-top:4px}

.form{display:grid;gap:14px;max-width:520px}
.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:.82rem;color:var(--muted);font-weight:500}
.field input,.field select{
  padding:11px 13px;border-radius:8px;border:1px solid var(--border);
  background:var(--bg);color:var(--text);font:inherit;font-size:.94rem;width:100%;
}
.field input:focus,.field select:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}

/* Consent: deliberately plain. This is the one page that must not sell. */
.consent{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:32px}
.consent__client{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.consent__avatar{
  width:40px;height:40px;border-radius:9px;background:var(--accent);color:var(--accent-text);
  display:grid;place-items:center;font-weight:700;font-size:1.05rem;flex:0 0 auto;
}
.consent__scopes{list-style:none;padding:0;margin:20px 0;display:grid;gap:9px}
.consent__scopes li{
  display:flex;gap:10px;align-items:flex-start;font-size:.92rem;color:var(--text);
  background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:11px 13px;
}
.consent__scopes li::before{content:"";color:var(--accent);font-weight:700;flex:0 0 auto}
.consent__note{font-size:.8rem;color:var(--muted);margin-top:18px}

.foot{border-top:1px solid var(--border);padding:28px 0;font-size:.82rem;color:var(--muted)}
.foot__inner{display:flex;gap:16px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.foot a{color:var(--muted);text-decoration:none}
.foot a:hover{color:var(--accent)}

@media (max-width:640px){
  section{padding:40px 0}
  .wrap{padding:0 18px}
  .actions .btn{flex:1 1 auto}
}
@media (prefers-reduced-motion:reduce){
  .btn,.card{transition:none}
  .btn:hover{transform:none}
}
`.trim();

function css(spec: PageSpec): string {
  return `:root{${paletteVars(spec.palette)}}` + BASE_CSS;
}

// ── Blocks ────────────────────────────────────────────────────────────────────

function renderHero(b: HeroBlock): string {
  return `<section><div class="wrap">
  ${b.eyebrow ? `<p class="eyebrow">${esc(b.eyebrow)}</p>` : ""}
  <h1>${esc(b.title)}</h1>
  ${b.body ? `<p class="lede">${esc(b.body)}</p>` : ""}
  ${b.cta || b.secondaryCta ? `<div class="actions">
    ${b.cta ? `<a class="btn btn--primary" href="${safeHref(b.cta.href)}">${esc(b.cta.label)}</a>` : ""}
    ${b.secondaryCta ? `<a class="btn btn--ghost" href="${safeHref(b.secondaryCta.href)}">${esc(b.secondaryCta.label)}</a>` : ""}
  </div>` : ""}
</div></section>`;
}

function renderFeatures(b: FeaturesBlock): string {
  const cls = b.columns === 2 ? "grid grid--2" : "grid grid--3";
  return `<section><div class="wrap">
  ${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}
  <div class="${cls}">
    ${b.items
      .map(
        (i) => `<article class="card">
      ${i.icon ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>` : ""}
      <h3>${esc(i.title)}</h3><p>${esc(i.body)}</p>
    </article>`
      )
      .join("\n    ")}
  </div>
</div></section>`;
}

function renderCards(b: CardsBlock): string {
  const layout = b.layout ?? "grid";
  if (layout === "carousel") {
    return `<section><div class="wrap">
  ${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}
  <div class="carousel">
    ${b.items.map((i) => renderCard(i)).join("\n    ")}
  </div>
</div></section>`;
  }
  const cls = b.columns === 2 ? "grid grid--2" : b.columns === 4 ? "grid grid--4" : "grid grid--3";
  return `<section><div class="wrap">
  ${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}
  <div class="${cls}">
    ${b.items.map((i) => renderCard(i)).join("\n    ")}
  </div>
</div></section>`;
}

function renderCard(i: {
  title: string;
  body?: string;
  href?: string;
  image?: string;
  tag?: string;
}): string {
  const inner = `${i.tag ? `<span class="tag">${esc(i.tag)}</span>` : ""}
      <h3>${esc(i.title)}</h3>
      ${i.body ? `<p>${esc(i.body)}</p>` : ""}`;
  if (i.href) {
    return `<a class="card card--link" href="${safeHref(i.href)}">${inner}</a>`;
  }
  return `<article class="card">${inner}</article>`;
}

function renderStats(b: StatsBlock): string {
  return `<section><div class="wrap"><div class="stats">
  ${b.items
    .map(
      (s) => `<div class="stat">
    <div class="stat__value">${esc(s.value)}</div>
    <div class="stat__label">${esc(s.label)}</div>
    ${s.hint ? `<div class="stat__hint">${esc(s.hint)}</div>` : ""}
  </div>`
    )
    .join("\n  ")}
</div></div></section>`;
}

function renderForm(b: FormBlock): string {
  const fields = b.fields
    .map((f) => {
      const req = f.required ? " required" : "";
      const control =
        f.type === "select"
          ? `<select id="${esc(f.name)}" name="${esc(f.name)}"${req}>${(f.options ?? [])
              .map((o) => `<option value="${esc(o)}">${esc(o)}</option>`)
              .join("")}</select>`
          : `<input id="${esc(f.name)}" name="${esc(f.name)}" type="${esc(f.type ?? "text")}"${req}>`;
      return `<div class="field">
      <label for="${esc(f.name)}">${esc(f.label)}${f.required ? " *" : ""}</label>
      ${control}
    </div>`;
    })
    .join("\n    ");

  return `<section><div class="wrap">
  ${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}
  ${b.body ? `<p class="lede">${esc(b.body)}</p>` : ""}
  <form class="form"${b.action ? ` action="${safeHref(b.action)}" method="post"` : ""}>
    ${fields}
    <div><button class="btn btn--primary" type="submit">${esc(b.submitLabel ?? "Continue")}</button></div>
  </form>
</div></section>`;
}

function renderCta(b: CtaBlock): string {
  return `<section><div class="wrap center">
  <h2>${esc(b.title)}</h2>
  ${b.body ? `<p class="lede">${esc(b.body)}</p>` : ""}
  <div class="actions"><a class="btn btn--primary" href="${safeHref(b.cta.href)}">${esc(b.cta.label)}</a></div>
</div></section>`;
}

function renderConsent(b: ConsentBlock): string {
  const initial = (b.clientName.trim()[0] ?? "?").toUpperCase();
  return `<section><div class="wrap wrap--narrow">
  <div class="consent">
    <div class="consent__client">
      <div class="consent__avatar">${esc(initial)}</div>
      <div>
        <h1 style="font-size:1.35rem;margin:0">${esc(b.clientName)}</h1>
        <p style="margin:0;font-size:.88rem">wants to access your account</p>
      </div>
    </div>
    <p>${esc(b.clientDescription)}</p>
    <h3>This will allow ${esc(b.clientName)} to:</h3>
    <ul class="consent__scopes">
      ${b.scopes.map((s) => `<li>${esc(s)}</li>`).join("\n      ")}
    </ul>
    <div class="actions">
      <button class="btn btn--primary" type="button">Allow</button>
      <button class="btn btn--ghost" type="button">Deny</button>
    </div>
    <p class="consent__note">You can revoke this access at any time from your account settings.${
      b.redirectNote ? ` ${esc(b.redirectNote)}` : ""
    }</p>
  </div>
</div></section>`;
}

export function renderBlock(b: PageBlock): string {
  switch (b.type) {
    case "hero":
      return renderHero(b);
    case "features":
      return renderFeatures(b);
    case "cards":
      return renderCards(b);
    case "stats":
      return renderStats(b);
    case "form":
      return renderForm(b);
    case "cta":
      return renderCta(b);
    case "consent":
      return renderConsent(b);
  }
}

// ── Standalone document ───────────────────────────────────────────────────────

export function renderPageHtml(spec: PageSpec): string {
  const metaTags = Object.entries(spec.meta ?? {})
    .map(([k, v]) => `<meta name="${esc(k)}" content="${esc(v)}">`)
    .join("\n  ");

  const body =
    spec.blocks.length > 0
      ? spec.blocks.map(renderBlock).join("\n")
      : `<section><div class="wrap"><h1>${esc(spec.title)}</h1><p class="lede">${esc(
          spec.brand ?? ""
        )}</p></div></section>`;

  return `<!doctype html>
<html lang="en" data-kind="${esc(spec.kind)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(spec.title)}</title>
  ${metaTags}
  <style>${css(spec)}</style>
</head>
<body>
${body}
<footer class="foot"><div class="wrap foot__inner">
  <span>${esc(spec.brand ?? spec.title)}</span>
  <span>Built by ClawdyClaw</span>
</div></footer>
</body>
</html>`;
}

// ── React source ──────────────────────────────────────────────────────────────

/**
/**
 * The emitted component declares its own types rather than importing ours. The
 * whole point is that the agent can drop this file into a repo that has never
 * heard of ClawdyClaw, so it must not have an import that breaks the build.
 *
 * The stylesheet is inlined as a JSON string literal rather than a template
 * literal, which keeps backticks and ${} inside the CSS from needing escaping.
 */
export function renderPageReact(spec: PageSpec): string {
  const cssLiteral = JSON.stringify(BASE_CSS);
  const specLiteral = JSON.stringify(spec, null, 2);

  return `/**
 * ${spec.title}
 * Generated by ClawdyClaw - https://mcp.clawdyclaw.com
 * kind: ${spec.kind}
 *
 * This file is yours. No runtime dependency beyond React.
 * Edit SPEC below, or pass your own spec: <ClawdyPage spec={mySpec} />
 */

import type { CSSProperties, ReactNode } from "react";

export interface Palette {
  mode: "dark" | "light";
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
}

export type PageBlock =
  | { type: "hero"; eyebrow?: string; title: string; body?: string;
      cta?: { label: string; href: string }; secondaryCta?: { label: string; href: string } }
  | { type: "features"; heading?: string; columns?: 2 | 3;
      items: { title: string; body: string; icon?: string }[] }
  | { type: "cards"; heading?: string; layout?: "grid" | "carousel"; columns?: 2 | 3 | 4;
      items: { title: string; body?: string; href?: string; image?: string; tag?: string }[] }
  | { type: "stats"; items: { label: string; value: string; hint?: string }[] }
  | { type: "form"; heading?: string; body?: string; submitLabel?: string; action?: string;
      fields: { name: string; label: string; type?: "text" | "email" | "url" | "select";
                options?: string[]; required?: boolean }[] }
  | { type: "cta"; title: string; body?: string; cta: { label: string; href: string } }
  | { type: "consent"; clientName: string; clientDescription: string;
      scopes: string[]; redirectNote?: string };

export interface PageSpec {
  kind: string;
  title: string;
  brand?: string;
  palette: Palette;
  blocks: PageBlock[];
  meta?: Record<string, string>;
}

export const SPEC: PageSpec = ${specLiteral};

export function paletteVars(p: Palette): CSSProperties {
  return {
    "--bg": p.bg,
    "--surface": p.surface,
    "--text": p.text,
    "--muted": p.muted,
    "--border": p.border,
    "--accent": p.accent,
    "--accent-text": p.accentText,
  } as CSSProperties;
}

export function Block({ block }: { block: PageBlock }): ReactNode {
  switch (block.type) {
    case "hero":
      return (
        <section>
          <div className="wrap">
            {block.eyebrow && <p className="eyebrow">{block.eyebrow}</p>}
            <h1>{block.title}</h1>
            {block.body && <p className="lede">{block.body}</p>}
            {(block.cta || block.secondaryCta) && (
              <div className="actions">
                {block.cta && <a className="btn btn--primary" href={block.cta.href}>{block.cta.label}</a>}
                {block.secondaryCta && (
                  <a className="btn btn--ghost" href={block.secondaryCta.href}>{block.secondaryCta.label}</a>
                )}
              </div>
            )}
          </div>
        </section>
      );

    case "features":
      return (
        <section>
          <div className="wrap">
            {block.heading && <h2>{block.heading}</h2>}
            <div className={block.columns === 2 ? "grid grid--2" : "grid grid--3"}>
              {block.items.map((i, k) => (
                <article className="card" key={k}>
                  <h3>{i.title}</h3>
                  <p>{i.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      );

    case "cards":
      return (
        <section>
          <div className="wrap">
            {block.heading && <h2>{block.heading}</h2>}
            {block.layout === "carousel" ? (
              <div className="carousel">
                {block.items.map((i, k) => (
                  <article className="card" key={k}>
                    {i.tag && <span className="tag">{i.tag}</span>}
                    <h3>{i.title}</h3>
                    {i.body && <p>{i.body}</p>}
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid grid--3">
                {block.items.map((i, k) => (
                  <article className="card" key={k}>
                    {i.tag && <span className="tag">{i.tag}</span>}
                    <h3>{i.title}</h3>
                    {i.body && <p>{i.body}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      );

    case "stats":
      return (
        <section>
          <div className="wrap">
            <div className="stats">
              {block.items.map((s, k) => (
                <div className="stat" key={k}>
                  <div className="stat__value">{s.value}</div>
                  <div className="stat__label">{s.label}</div>
                  {s.hint && <div className="stat__hint">{s.hint}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "form":
      return (
        <section>
          <div className="wrap">
            {block.heading && <h2>{block.heading}</h2>}
            {block.body && <p className="lede">{block.body}</p>}
            <form className="form" method="post">
              {block.fields.map((f) => (
                <div className="field" key={f.name}>
                  <label htmlFor={f.name}>{f.label}</label>
                  {f.type === "select" ? (
                    <select id={f.name} name={f.name}>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={f.name}
                      name={f.name}
                      type={f.type ?? "text"}
                      required={f.required}
                    />
                  )}
                </div>
              ))}
              <div>
                <button className="btn btn--primary" type="submit">
                  {block.submitLabel ?? "Continue"}
                </button>
              </div>
            </form>
          </div>
        </section>
      );

    case "cta":
      return (
        <section>
          <div className="wrap center">
            <h2>{block.title}</h2>
            {block.body && <p className="lede">{block.body}</p>}
            <div className="actions">
              <a className="btn btn--primary" href={block.cta.href}>{block.cta.label}</a>
            </div>
          </div>
        </section>
      );

    case "consent":
      return (
        <section>
          <div className="wrap wrap--narrow">
            <div className="consent">
              <div className="consent__client">
                <div className="consent__avatar">
                  {(block.clientName[0] ?? "?").toUpperCase()}
                </div>
                <div>
                  <h1 style={{ fontSize: "1.35rem", margin: 0 }}>{block.clientName}</h1>
                  <p style={{ margin: 0, fontSize: ".88rem" }}>wants to access your account</p>
                </div>
              </div>
              <p>{block.clientDescription}</p>
              <h3>This will allow {block.clientName} to:</h3>
              <ul className="consent__scopes">
                {block.scopes.map((s, k) => <li key={k}>{s}</li>)}
              </ul>
              <div className="actions">
                <button className="btn btn--primary" type="button">Allow</button>
                <button className="btn btn--ghost" type="button">Deny</button>
              </div>
              <p className="consent__note">
                You can revoke this access at any time from your account settings.
              </p>
            </div>
          </div>
        </section>
      );

    default:
      return null;
  }
}

export default function ClawdyPage({ spec = SPEC }: { spec?: PageSpec }) {
  return (
    <div style={paletteVars(spec.palette)}>
      <style dangerouslySetInnerHTML={{ __html: ${cssLiteral} }} />
      {spec.blocks.map((b, i) => <Block key={i} block={b} />)}
      <footer className="foot">
        <div className="wrap foot__inner">
          <span>{spec.brand ?? spec.title}</span>
          <span>Built by ClawdyClaw</span>
        </div>
      </footer>
    </div>
  );
}
`;
}
