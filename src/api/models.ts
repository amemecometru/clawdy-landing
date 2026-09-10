/**
 * Models Registry API.
 *
 *   GET  /api/v1/models               → model catalog + per-provider connection status
 *   POST /api/v1/models/:provider/test → probe bound credentials (lightweight upstream call)
 *   POST /api/v1/models/:provider/run  → run an inference behind-the-curtain (operator → real backend)
 *
 * Connection status mirrors the encrypted vault (`vault_tokens`).
 * CATEGORIES: "cloud" (Cloudflare Workers AI), "openweights" (HuggingFace),
 * "legacy" (Anthropic, Grok/xAI, Google Gemini, CF Flow/Omni), "imaging".
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
  category: "cloud" | "openweights" | "legacy" | "imaging";
  description: string;
  mode: "api_key" | "core";
  models: string[];
  icon: string;
  accent: string;
}

export const MODEL_DEFS: ModelDef[] = [
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
  let body: { model?: string; prompt?: string; image_prompt?: string } = {};
  try { body = await c.req.json(); } catch { /* empty */ }
  if (!body.prompt && !body.image_prompt) return c.json({ error: "prompt is required" }, 400);

  const ctx: InferContext = { DB: c.env.DB, operator: user, CF_ACCOUNT_ID: c.env.CF_ACCOUNT_ID, VAULT_CIPHER_KEY: c.env.VAULT_CIPHER_KEY, ...(c.env as unknown as Record<string, unknown>) } as InferContext;
  const result = await infer(provider, body, ctx);
  return c.json(result);
});

export default models;