import * as React from "react";
import { SectionHeader, RawJson } from "@/components/studio/section-header";
import { fetchModels, runModel, testModelProvider, type ModelDef } from "@/lib/api";

/**
 * Models Registry — the operator sees which model connections are live and can
 * fire real inference runs; agents see the exact schema/MCP tool surfaces.
 * No raw JSON leaks into the operator view; the backend runs behind-the-curtain.
 */
export function ModelsPage({ mode, onMode }: { mode: "operator" | "agent"; onMode: (m: "operator" | "agent") => void }) {
  const [models, setModels] = React.useState<ModelDef[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState<Record<string, "pending" | "ok" | "fail">>({});
  const [runnerNote, setRunnerNote] = React.useState<string | null>(null);
  const [activeModel, setActiveModel] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState("Generate a warm engineering status update for the ops feed.");
  const [imagePrompt, setImagePrompt] = React.useState("A lone server rack in a neon-lit data center");
  const [runResult, setRunResult] = React.useState<{ ok: boolean; output: string; latency_ms: number; model: string } | null>(null);
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchModels()
      .then((data) => {
        if (cancelled) return;
        setModels(data.models);
        setRunnerNote(`${data.inference_backbone.runner} · ${data.inference_backbone.providers_bound} providers bound`);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "registry sync failed");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function test(provider: string) {
    setTesting((t) => ({ ...t, [provider]: "pending" }));
    try {
      const res = await testModelProvider(provider);
      setTesting((t) => ({ ...t, [provider]: res.ok ? "ok" : "fail" }));
    } catch {
      setTesting((t) => ({ ...t, [provider]: "fail" }));
    }
  }

  async function run(provider: string) {
    const def = models.find((m) => m.provider === provider);
    if (!def) return;
    setActiveModel(def.name);
    setRunning(true);
    setRunResult(null);
    try {
      const body = def.category === "imaging"
        ? { model: def.models[0], image_prompt: imagePrompt }
        : { model: def.models[0], prompt };
      const res = await runModel(provider, body);
      setRunResult({
        ok: res.ok,
        output: renderOutput(res.output),
        latency_ms: res.latency_ms,
        model: res.model,
      });
    } catch (e) {
      setRunResult({
        ok: false,
        output: e instanceof Error ? e.message : "run failed",
        latency_ms: 0,
        model: def.models[0],
      });
    } finally {
      setRunning(false);
    }
  }

  const agentState = {
    registry: "/api/v1/models",
    model_definitions: models.map((m) => ({
      provider: m.provider,
      category: m.category,
      mode: m.mode,
      models: m.models,
      connected: m.connected ?? false,
    })),
    mcp_tools: [
      { name: "hf_infer", args: { org: "string", model: "string", prompt: "string" } },
      { name: "cloudflare_ai", args: { worker_run: "string", model: "string", prompt: "string" } },
      { name: "model_infer", args: { provider: "string", model: "string", prompt: "string" } },
      { name: "flux_image", args: { prompt: "string", steps: "number" } },
    ],
    secrets_at_rest: "AES-256-GCM in D1 vault (env-provider chain)",
  };

  return (
    <div>
      <SectionHeader
        title="Models"
        description="Model connections bound to the edge. Test provider keys, then fire real inference runs against the worker."
        mode={mode}
        onMode={onMode}
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-silver/20 bg-muted/30" />
          ))}
        </div>
      ) : mode === "operator" ? (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-silver/20 bg-muted/30 px-4 py-2 font-mono text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {runnerNote ?? "inference backbone · worker-edge"}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {models.map((m) => (
              <ModelCard
                key={m.provider}
                model={m}
                testing={testing[m.provider]}
                onTest={() => void test(m.provider)}
                onRun={() => void run(m.provider)}
              />
            ))}
          </div>
          {error && <p className="mt-3 font-mono text-xs text-beacon">⚠ {error}</p>}

          {/* Run console */}
          <div className="mt-6 rounded-xl border border-silver/25 bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Live Inference Run {activeModel && <span className="text-ember">· {activeModel}</span>}
              </h2>
              {running && <span className="font-mono text-xs text-ember animate-pulse">running…</span>}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                  Prompt (text models)
                </span>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-silver/25 bg-obsidian px-3 py-2 text-sm text-porcelain outline-none transition focus:border-ember/60"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                  Image prompt (flux)
                </span>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-silver/25 bg-obsidian px-3 py-2 text-sm text-porcelain outline-none transition focus:border-ember/60"
                />
              </label>
            </div>

            {runResult && (
              <div className={`mt-3 rounded-lg border px-4 py-3 font-mono text-xs ${runResult.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-beacon/40 bg-beacon/10 text-beacon"}`}>
                <div className="mb-1 flex items-center gap-3">
                  <span>{runResult.ok ? "✓" : "✗"}</span>
                  <span className="text-porcelain">{runResult.model}</span>
                  <span className="ml-auto text-muted-foreground">{runResult.latency_ms} ms</span>
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed">{runResult.output}</pre>
              </div>
            )}
          </div>
        </>
      ) : (
        <RawJson data={agentState} />
      )}
    </div>
  );
}

function ModelCard({
  model,
  testing,
  onTest,
  onRun,
}: {
  model: ModelDef;
  testing: "pending" | "ok" | "fail" | undefined;
  onTest: () => void;
  onRun: () => void;
}) {
  const stateColor = model.connected ? "bg-emerald-400" : "bg-silver/40";
  return (
    <div className="flex flex-col rounded-xl border border-silver/25 bg-card p-4 transition hover:border-ember/40">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-muted/40 font-mono text-sm">{model.icon}</span>
          <div>
            <div className="text-sm font-semibold text-porcelain">{model.name}</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {model.category} · {model.mode}
            </div>
          </div>
        </div>
        <span className={`mt-1 flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground`}>
          <span className={`size-1.5 rounded-full ${stateColor} ${model.connected ? "animate-pulse" : ""}`} />
          {model.connected ? "live" : "unbound"}
        </span>
      </div>

      <p className="mt-3 min-h-8 text-xs leading-relaxed text-muted-foreground">{model.description}</p>

      <div className="mt-2 flex flex-wrap gap-1">
        {model.models.map((m) => (
          <span key={m} className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ${model.accent ?? "bg-muted/40 text-muted-foreground"}`}>
            {m}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-silver/15 pt-3">
        <button
          onClick={onTest}
          disabled={!model.connected || testing === "pending"}
          className="rounded-md border border-silver/25 px-3 py-1.5 font-mono text-[11px] text-porcelain/80 transition hover:border-ember/50 hover:text-ember disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          {testing === "pending" ? "ping…" : testing === "ok" ? "✓ reachable" : testing === "fail" ? "✗ unreachable" : "test"}
        </button>
        <button
          onClick={onRun}
          className="ml-auto rounded-md bg-rust px-3 py-1.5 font-mono text-[11px] font-semibold text-chrome transition hover:bg-ember cursor-pointer"
        >
          run
        </button>
      </div>
    </div>
  );
}

function renderOutput(output: unknown): string {
  if (typeof output === "string") return output.slice(0, 1200);
  if (Array.isArray(output)) {
    const first = output[0];
    if (first && typeof first === "string") return first.slice(0, 1200);
  }
  return JSON.stringify(output).slice(0, 1200);
}