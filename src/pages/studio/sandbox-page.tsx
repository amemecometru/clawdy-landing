import * as React from "react";
import { SectionHeader, RawJson } from "@/components/studio/section-header";
import { simulatePayload } from "@/lib/api";

const PRESETS: Array<{ label: string; source: string; payload: Record<string, unknown> }> = [
  {
    label: "New lead from Facebook",
    source: "facebook_ads",
    payload: {
      client_name: "Avery Shields",
      contact: "avery@shields.dev",
      intent: "Want a site refresh before holiday promo — 2 weeks.",
      estimated_value: 4800,
      url: "https://fb.me/lead/8291",
    },
  },
  {
    label: "Urgent Gmail note",
    source: "gmail",
    payload: {
      sender: "ops@corekit.co",
      subject: "RE: proposal — need today",
      body: "Can you bump the timeline? Client approved the numbers.",
      estimated_value: 12500,
    },
  },
  {
    label: "Marketplace listing caught",
    source: "scraper",
    payload: {
      listing_title: "Beachfront condo — seller motivated",
      price: 340000,
      location: "Panama City Beach",
      url: "https://market.example/listing/773",
    },
  },
];

/**
 * Sandbox — dry-run playground.
 * Operator: form/preset → simulate → read the human trace.
 * Agent: the exact proposed task JSON the worker would enqueue.
 */
export function SandboxPage({ mode, onMode }: { mode: "operator" | "agent"; onMode: (m: "operator" | "agent") => void }) {
  const [source, setSource] = React.useState("facebook_ads");
  const [json, setJson] = React.useState(JSON.stringify(PRESETS[0].payload, null, 2));
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  function applyPreset(i: number) {
    setSource(PRESETS[i].source);
    setJson(JSON.stringify(PRESETS[i].payload, null, 2));
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const payload = JSON.parse(json) as Record<string, unknown>;
      setResult(await simulatePayload({ source, payload }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "simulate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SectionHeader title="Sandbox" description="Replay any inbound payload against the live classification pipeline — no side effects." mode={mode} onMode={onMode} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-silver/20 bg-card p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => applyPreset(i)}
                className="rounded-full border border-silver/25 bg-muted/30 px-3 py-1 text-xs text-porcelain transition hover:border-ember/60 hover:text-porcelain cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mb-3 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="facebook_ads">facebook_ads</option>
            <option value="gmail">gmail</option>
            <option value="scraper">scraper</option>
            <option value="manual">manual</option>
          </select>

          <label className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">Payload (JSON)</label>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={12}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-input bg-obsidian/80 p-3 font-mono text-xs leading-relaxed text-emerald-300 focus:outline-none focus:ring-1 focus:ring-ring"
          />

          <button
            onClick={() => void run()}
            disabled={busy}
            className="mt-3 h-10 w-full rounded-md bg-ember font-semibold text-chrome transition hover:bg-ember/85 disabled:opacity-50 cursor-pointer"
          >
            {busy ? "Simulating…" : "▶ Simulate Agent Run"}
          </button>
        </section>

        <section className="min-h-[420px] rounded-xl border border-silver/20 bg-card p-5">
          {error && (
            <div className="mb-3 rounded-lg border border-beacon/40 bg-beacon/10 px-3 py-2 font-mono text-xs text-beacon">⚠ {error}</div>
          )}
          {!result && !error && (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <span className="font-mono text-3xl">⌁</span>
              <p>Run a simulation to see the normalize → classify → enqueue trace.</p>
            </div>
          )}
          {result && (mode === "agent" ? (
            <RawJson data={{ ...(result.proposed_task as object), _trace_steps: result.trace }} />
          ) : (
            <TraceView trace={(result.trace as Array<{ step: string; detail: unknown }>) ?? []} />
          ))}
        </section>
      </div>
    </div>
  );
}

function TraceView({ trace }: { trace: Array<{ step: string; detail: unknown }> }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Pipeline Trace</h2>
      {trace.map((t, i) => (
        <div key={i} className="rounded-lg border border-silver/20 bg-obsidian/70 p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-ember/20 font-mono text-[10px] text-ember">{i + 1}</span>
            <span className="font-mono text-xs text-ember">{t.step}</span>
          </div>
          <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-porcelain/80">
            {JSON.stringify(t.detail, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}