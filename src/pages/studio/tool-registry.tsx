import * as React from "react";
import { SectionHeader, RawJson } from "@/components/studio/section-header";
import {
  fetchIntegrations,
  getConnectMeta,
  bindApiKey,
  type Integration,
} from "@/lib/api";

/**
 * Tool Registry (integrations catalog) — dual-mode:
 * Operator: brand-logo cards with Connect/Configure + badge status.
 * Agent: the exact MCP manifest the worker exposes (drives the JSON-RPC surface).
 */
export function ToolRegistry({ mode, onMode }: { mode: "operator" | "agent"; onMode: (m: "operator" | "agent") => void }) {
  const [data, setData] = React.useState<{ user: { sub: string; email: string | null }; integrations: Integration[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [keyInput, setKeyInput] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setData(await fetchIntegrations());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "integrations load failed");
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function connect(provider: string) {
    setBusy(provider);
    try {
      const meta = await getConnectMeta(provider);
      if (meta.mode === "core") {
        setError(`${provider} is built in — no credential needed.`);
        setBusy(null);
        return;
      }
      if (meta.mode === "oauth") {
        window.location.href = `/api/v1/auth/${provider}/connect`;
        return;
      }
      setBusy(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : `connect failed for ${provider}`);
      setBusy(null);
    }
  }

  async function saveKey(provider: string) {
    const key = keyInput[provider];
    if (!key) return;
    setBusy(provider);
    try {
      await bindApiKey(provider, key);
      setKeyInput((k) => ({ ...k, [provider]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "key save failed");
    } finally {
      setBusy(null);
    }
  }

  if (mode === "agent") {
    return (
      <div>
        <SectionHeader title="Tool Registry — MCP Manifest" description="What the agent sees: the JSON-RPC tool surface backed by real worker credentials." mode={mode} onMode={onMode} />
        <RawJson data={{
          jsonrpc: "2.0",
          method: "tools/list",
          tools: data?.integrations.flatMap((i) => i.tools.map((t) => ({
            name: t,
            description: `${t} — provider ${i.provider} (${i.mode})`,
            provider_connected: i.connected,
          }))) ?? [],
          provider_count: data?.integrations.length ?? 0,
        }} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Tool Registry" description="Connect the pipes the agent uses: OAuth, API keys, built-ins." mode={mode} onMode={onMode} />

      {error && (
        <div className="mb-4 rounded-lg border border-beacon/40 bg-beacon/10 px-4 py-2 font-mono text-xs text-beacon">⚠ {error}</div>
      )}

      {data && (
        <p className="mb-4 font-mono text-xs text-muted-foreground">
          operator session → <span className="text-porcelain">{data.user.email ?? data.user.sub}</span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.integrations.map((it) => (
          <div key={it.provider} className="flex flex-col rounded-xl border border-silver/25 bg-card p-4 transition hover:border-ember/50">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/40 font-mono text-lg text-chrome">
                {it.icon}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-porcelain">{it.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {it.mode} · <span className={it.connected ? "text-emerald-400" : "text-ember"}>{it.connected ? "● connected" : "○ not connected"}</span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{it.description}</p>

            <div className="mt-2 flex flex-wrap gap-1">
              {it.tools.map((t) => (
                <span key={t} className="rounded-full bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-silver">{t}</span>
              ))}
            </div>

            <div className="mt-auto pt-3">
              {it.mode === "api_key" ? (
                <div className="flex gap-2">
                  <input
                    value={keyInput[it.provider] ?? ""}
                    onChange={(e) => setKeyInput((k) => ({ ...k, [it.provider]: e.target.value }))}
                    placeholder={it.connected ? "rotate key…" : "paste API key"}
                    type="password"
                    className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={() => void saveKey(it.provider)}
                    disabled={busy === it.provider || !keyInput[it.provider]}
                    className="h-8 rounded-md bg-ember px-3 text-xs font-semibold text-chrome transition hover:bg-ember/85 disabled:opacity-50 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ) : it.mode === "oauth" ? (
                <button
                  onClick={() => void connect(it.provider)}
                  disabled={busy === it.provider}
                  className="h-8 w-full rounded-md bg-rust px-3 text-xs font-semibold text-chrome transition hover:bg-rust/90 disabled:opacity-50 cursor-pointer"
                >
                  {it.connected ? "Reconnect" : "Connect"} Google/GitHub
                </button>
              ) : (
                <div className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">✦ built into worker edge</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}