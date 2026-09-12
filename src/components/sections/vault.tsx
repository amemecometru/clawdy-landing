import { useEffect, useState } from "react";

interface VaultModel {
  provider: string;
  name: string;
  description: string;
  mode: "api_key" | "core";
  connected: boolean;
  icon: string;
}

interface ModelsResponse {
  models?: VaultModel[];
}

interface ProbeResponse {
  detail?: string;
}

export function VaultSection() {
  const [models, setModels] = useState<VaultModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, string>>({});

  const fetchCatalog = async () => {
    try {
      const res = await fetch("/api/v1/models");
      const data = (await res.json()) as ModelsResponse;
      if (data.models) setModels(data.models);
    } catch {
      setStatus(prev => ({ ...prev, global: "Failed to load catalog" }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleTest = async (provider: string) => {
    setStatus(prev => ({ ...prev, [provider]: "Testing connection..." }));
    try {
      const res = await fetch(`/api/v1/models/${provider}/test`, { method: "POST" });
      const data = (await res.json()) as ProbeResponse;
      setStatus(prev => ({ ...prev, [provider]: data.detail ?? "Probe returned nothing" }));
    } catch {
      setStatus(prev => ({ ...prev, [provider]: "Probe request failed" }));
    }
  };

  const handleSave = async (provider: string) => {
    const token = inputs[provider];
    if (!token) return;
    setStatus(prev => ({ ...prev, [provider]: "Saving to vault..." }));
    try {
      const res = await fetch(`/api/v1/vault/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token })
      });
      if (res.ok) {
        setStatus(prev => ({ ...prev, [provider]: "Saved securely ✓" }));
        setInputs(prev => ({ ...prev, [provider]: "" }));
        fetchCatalog();
      } else {
        setStatus(prev => ({ ...prev, [provider]: "Save rejected" }));
      }
    } catch {
      setStatus(prev => ({ ...prev, [provider]: "Save error" }));
    }
  };

  if (loading) {
    return <div className="p-6 text-neutral-400 font-mono text-xs">Loading vault state...</div>;
  }

  return (
    <div className="p-6 text-white max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Vault & Credentials</h1>
      <p className="text-neutral-400 text-xs mb-6">Manage encrypted API tokens for your active edge channels, social pipelines, and media generators.</p>

      {status.global && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-900 rounded text-xs text-red-400 font-mono">
          {status.global}
        </div>
      )}

      <div className="space-y-3">
        {models.map((m) => (
          <div key={m.provider} className="bg-neutral-900 border border-neutral-800 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <span className="text-lg font-mono text-neutral-400 bg-neutral-800 px-2.5 py-1 rounded">{m.icon}</span>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm">{m.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${m.connected ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-neutral-800 text-neutral-400'}`}>
                    {m.connected ? 'CONNECTED' : 'UNBOUND'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">{m.description}</p>
                {status[m.provider] && (
                  <p className="text-[11px] font-mono text-orange-400 mt-1">status: {status[m.provider]}</p>
                )}
              </div>
            </div>

            {m.mode === "api_key" ? (
              <div className="flex items-center space-x-2 w-full md:w-auto">
                <input
                  type="password"
                  placeholder="Paste API token..."
                  className="bg-black border border-neutral-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-600 w-full md:w-48 font-mono"
                  value={inputs[m.provider] || ""}
                  onChange={(e) => setInputs({ ...inputs, [m.provider]: e.target.value })}
                />
                <button
                  onClick={() => handleSave(m.provider)}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded text-white whitespace-nowrap transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => handleTest(m.provider)}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-xs font-semibold rounded text-white whitespace-nowrap transition-colors"
                >
                  Test
                </button>
              </div>
            ) : (
              <span className="text-xs text-neutral-500 font-mono italic">Edge Native</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
