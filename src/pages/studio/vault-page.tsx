import * as React from "react";
import { SectionHeader, RawJson } from "@/components/studio/section-header";
import { fetchIntegrations } from "@/lib/api";

/**
 * API Vault — credential & endpoint surface.
 * Operator: connected status per provider, webhook URLs, endpoint health.
 * Agent: the TLS/credential contract the worker enforces.
 */
export function VaultPage({ mode, onMode, onNavigate }: { mode: "operator" | "agent"; onMode: (m: "operator" | "agent") => void; onNavigate?: (path: string) => void }) {
  const [data, setData] = React.useState<{ user: { sub: string; email: string | null }; integrations: Integration[] } | null>(null);

  const load = React.useCallback(async () => {
    try {
      setData(await fetchIntegrations());
    } catch {
      /* offline — keep last state */
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const endpoints = [
    { method: "POST", path: "/api/v1/webhook/ingress", desc: "Universal inbound webhook" },
    { method: "GET", path: "/api/v1/tasks", desc: "Task queue (HITL)" },
    { method: "POST", path: "/mcp/v1", desc: "JSON-RPC tool server" },
    { method: "GET", path: "/api/v1/telemetry", desc: "Telemetry feed" },
    { method: "POST", path: "/api/v1/sandbox/simulate", desc: "Dry-run sandbox" },
    { method: "GET", path: "/api/v1/integrations", desc: "Integration catalog" },
  ];

  if (mode === "agent") {
    return (
      <div>
        <SectionHeader title="API Vault — MCP Schema" description="Credential + endpoint contract the worker enforces at the edge." mode={mode} onMode={onMode} />
        <RawJson data={{
          vault_policy: "AES-256-GCM at rest · per-operator scoping · decrypted only in execution context",
          holder: data?.user ?? null,
          endpoints,
          connected_providers: data?.integrations.filter((i) => i.connected).map((i) => i.provider) ?? [],
          exposed_secrets: "none — tokens never leave the worker",
        }} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="API Vault" description="Keys, OAuth grants, and endpoint contracts — kept encrypted at the edge." mode={mode} onMode={onMode} />

      {data && (
        <p className="mb-4 font-mono text-xs text-muted-foreground">
          vault holder → <span className="text-porcelain">{data.user.email ?? data.user.sub}</span>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-silver/20 bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Credentials</h2>
          <div className="space-y-2">
            {data?.integrations.map((it) => (
              <div key={it.provider} className="flex items-center justify-between rounded-lg border border-silver/15 bg-obsidian/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{it.icon}</span>
                  <span className="text-sm text-porcelain">{it.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`size-2 rounded-full ${it.connected ? "bg-emerald-400" : "bg-ember"}`} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {it.mode === "core" ? "built-in" : it.connected ? "decrypt-in-execution" : it.mode}
                  </span>
                </div>
              </div>
            ))}
            {!data && <p className="text-xs text-muted-foreground">Loading vault state…</p>}
          </div>
        </section>

        <section className="rounded-xl border border-silver/20 bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Ingress Endpoints</h2>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">● LIVE</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {endpoints.map((e) => (
              <div key={e.method + e.path} className="flex items-center gap-3 rounded-lg border border-silver/15 bg-obsidian/50 px-3 py-2 font-mono text-xs">
                <span className={`w-12 shrink-0 ${e.method === "GET" ? "text-emerald-400" : "text-ember"}`}>{e.method}</span>
                <span className="flex-1 truncate text-porcelain">{e.path}</span>
                <span className="hidden shrink-0 text-muted-foreground sm:block">{e.desc}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-silver/20 bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Webhook Entry</h2>
        <p className="font-mono text-xs text-porcelain">
          POST <span className="text-ember">https://{window.location.host}/api/v1/webhook/ingress</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Send `{`{ "source": "facebook_ads", "payload": {…} }`}` — the agent classifies, the queue gates, you approve.
        </p>
        {onNavigate && (
          <button
            onClick={() => onNavigate("/studio/queue")}
            className="mt-3 rounded-md bg-rust px-3 py-1.5 text-xs font-semibold text-chrome transition hover:bg-rust/90 cursor-pointer"
          >
            Open Approval Queue →
          </button>
        )}
      </section>
    </div>
  );
}

// Local lightweight mirror of Integration (avoids deep import cycle).
interface Integration {
  provider: string;
  name: string;
  icon: string;
  mode: "oauth" | "api_key" | "core";
  connected: boolean;
}