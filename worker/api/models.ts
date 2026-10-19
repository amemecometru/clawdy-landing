/**
 * Models Registry API.
 *
 *   GET  /api/v1/models               → model catalog + per-provider connection status
 *   POST /api/v1/models/:provider/test → probe bound credentials (lightweight upstream call)
 *   POST /api/v1/models/:provider/run  → run an inference behind-the-curtain (operator → real backend)
 *
 * Connection status mirrors the encrypted vault (`vault_tokens`), plus the
 * platform Cloudflare secret (encrypted Worker secret, dashboard Settings >
 * Variables) for platform-run providers (Cloudflare Workers AI, FLUX).
 * CATEGORIES: "cloud" (Cloudflare Workers AI), "frontier" (flagship labs),
 * "openweights" (HuggingFace), "router" (OpenRouter, Unorouter, FreeLLMAPI),
 * "imaging" (FLUX), "audio" (ElevenLabs).
 */

import { Hono } from "hono";
import { requireSession, authedUser } from "../lib/require-auth";
import { getSessionUser, sessionUserOrDefault } from "../lib/session";
import { listTokens, type VaultEnv } from "../db/vault";
import { infer, providerTokenValue, PLATFORM_PROVIDERS, type InferContext } from "./infer";

export interface ModelsEnv extends VaultEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  CF_ACCOUNT_ID?: string;
  /** Encrypted Worker secret (dashboard Settings > Variables). Never in repo. */
  CLOUDFLARE_API_TOKEN?: string;
}

export type CostTier = "free" | "cheap" | "standard" | "premium";

export interface ModelDef {
  provider: string;
  name: string;
  category: "cloud" | "frontier" | "openweights" | "router" | "imaging" | "audio";
  description: string;
  mode: "api_key" | "core";
  models: string[];
  icon: string;
  accent: string;
  /** One-liner: why a revenue-building agent dev picks this model. */
  useCase: string;
  costTier: CostTier;
  /** Platform fee in basis points (100 = 1%). 0 on free tiers. Tunable per provider. */
  feeBps: number;
}

export const MODEL_DEFS: ModelDef[] = [
  {
    provider: "cloudflare",
    name: "Cloudflare Workers AI",
    category: "cloud",
    description: "Default inference backbone — Llama, Qwen, DeepSeek and Mistral run directly on the edge, billed to your own Cloudflare account.",
    mode: "api_key",
    models: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwen2.5-coder-32b-instruct", "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", "@cf/mistral/mistral-7b-instruct-v0.1"],
    icon: "◈",
    accent: "border-ember/40",
    useCase: "Zero-key edge inference — the cheapest way to run agents 24/7.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "meta",
    name: "Meta · Llama",
    category: "frontier",
    description: "Meta's open-weight frontier family. Meta publishes no first-party LLM API — Llama is served through the platform router layer (OpenRouter → FreeLLMAPI → Cloudflare backbone), no Meta key needed.",
    mode: "api_key",
    models: ["llama-4-maverick", "llama-4-scout", "muse-spark-1.3"],
    icon: "∞",
    accent: "border-blue-500/40",
    useCase: "Open-weight frontier for self-hostable, fine-tunable money-making agents.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "openai",
    name: "OpenAI",
    category: "frontier",
    description: "The maximum-capability tier — GPT-6 family for the hardest autonomous work.",
    mode: "api_key",
    models: ["gpt-6-sol", "gpt-6-astra", "gpt-5.6"],
    icon: "◉",
    accent: "border-emerald-400/40",
    useCase: "Long-horizon, high-stakes agent runs where only the best will do.",
    costTier: "premium",
    feeBps: 1000,
  },
  {
    provider: "anthropic",
    name: "Anthropic · Claude",
    category: "frontier",
    description: "The coding-agent ceiling — Fable and Opus for deep reasoning, Sonnet for daily agent work.",
    mode: "api_key",
    models: ["claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5"],
    icon: "λ",
    accent: "border-amber-500/40",
    useCase: "Best-in-class coding agents (Opus) and the daily-driver agent model (Sonnet).",
    costTier: "premium",
    feeBps: 1000,
  },
  {
    provider: "gemini",
    name: "Google · Gemini",
    category: "frontier",
    description: "Fast native-multimodal models with million-token context windows.",
    mode: "api_key",
    models: ["gemini-3.5-flash", "gemini-3.1-pro"],
    icon: "✦",
    accent: "border-blue-400/40",
    useCase: "Document-heavy agent workflows — contracts, codebases, research at speed.",
    costTier: "standard",
    feeBps: 1000,
  },
  {
    provider: "grok",
    name: "xAI · Grok",
    category: "frontier",
    description: "Aggressive price-performance with real-time X data access.",
    mode: "api_key",
    models: ["grok-4.7", "grok-4.5"],
    icon: "¤",
    accent: "border-silver/40",
    useCase: "Coding agents on a budget, plus live social-signal awareness.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "deepseek",
    name: "DeepSeek",
    category: "frontier",
    description: "The cheapest frontier reasoning on the market — V4 class at cents per million tokens.",
    mode: "api_key",
    models: ["deepseek-v4", "deepseek-v4-flash"],
    icon: "深",
    accent: "border-cyan-400/40",
    useCase: "High-volume agent loops — scrapers, classifiers, batch outreach — for almost nothing.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "mistral",
    name: "Mistral AI",
    category: "frontier",
    description: "European-hosted frontier models plus the best cheap open weights.",
    mode: "api_key",
    models: ["mistral-medium-3.5", "mistral-small-4", "mistral-large-3"],
    icon: "M",
    accent: "border-orange-400/40",
    useCase: "EU data-residency agents and dirt-cheap capable open models.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "qwen",
    name: "Alibaba · Qwen",
    category: "frontier",
    description: "Top-tier multilingual and coding models at aggressive prices.",
    mode: "api_key",
    models: ["qwen3.7-max", "qwen3.7-plus"],
    icon: "Q",
    accent: "border-violet-400/40",
    useCase: "Multilingual customer-facing agents and strong open coding models.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "kimi",
    name: "Moonshot · Kimi",
    category: "frontier",
    description: "Long-context coding specialist — built for extended agent trajectories.",
    mode: "api_key",
    models: ["kimi-k2.7-code"],
    icon: "K",
    accent: "border-teal-400/40",
    useCase: "Marathon coding agents that hold a whole repo in context.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "zai",
    name: "Zhipu · GLM",
    category: "frontier",
    description: "MIT-licensed 1M-context reasoning — build commercial agents on open weights.",
    mode: "api_key",
    models: ["glm-5.2"],
    icon: "Z",
    accent: "border-lime-400/40",
    useCase: "Free-license frontier reasoning for commercial agent products.",
    costTier: "free",
    feeBps: 0,
  },
  {
    provider: "groq",
    name: "Groq · LPU Inference",
    category: "frontier",
    description: "The fastest tokens-per-second in the industry — LPU hardware serving open models at real-time speed.",
    mode: "api_key",
    models: ["groq/llama-3.3-70b", "groq/qwen3-32b", "groq/kimi-k2"],
    icon: "⚡",
    accent: "border-red-400/40",
    useCase: "Real-time voice agents and snappy chat products — speed is the feature.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "together",
    name: "Together AI",
    category: "frontier",
    description: "Serverless inference across 200+ open models — fine-tune, then serve from the same platform.",
    mode: "api_key",
    models: ["together/llama-4-maverick", "together/qwen3-235b", "together/deepseek-v4"],
    icon: "⇄",
    accent: "border-sky-400/40",
    useCase: "Cheapest serverless open-model inference — fine-tune your edge, then serve it.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "cohere",
    name: "Cohere",
    category: "frontier",
    description: "RAG-native models — Command for generation, Embed and Rerank for retrieval pipelines.",
    mode: "api_key",
    models: ["command-r-plus", "command-r7", "embed-v4"],
    icon: "C",
    accent: "border-teal-300/40",
    useCase: "Enterprise search agents — retrieval, rerank and grounding built for the job.",
    costTier: "standard",
    feeBps: 1000,
  },
  {
    provider: "perplexity",
    name: "Perplexity · Sonar",
    category: "frontier",
    description: "Search-grounded models — every answer backed by live citations.",
    mode: "api_key",
    models: ["sonar-pro", "sonar-reasoning-pro"],
    icon: "⌕",
    accent: "border-cyan-300/40",
    useCase: "Research agents that answer with receipts — news monitors and analyst products.",
    costTier: "standard",
    feeBps: 1000,
  },
  {
    provider: "amazon",
    name: "Amazon · Nova",
    category: "frontier",
    description: "Bedrock-grade frontier at AWS scale — long-context multimodal models.",
    mode: "api_key",
    models: ["nova-2-pro", "nova-2-lite"],
    icon: "a",
    accent: "border-amber-300/40",
    useCase: "Long-context document agents on the most battle-tested cloud infra.",
    costTier: "standard",
    feeBps: 1000,
  },
  {
    provider: "openrouter",
    name: "OpenRouter",
    category: "router",
    description: "The universal adapter — one key, 400+ models, automatic failover across providers.",
    mode: "api_key",
    models: ["openrouter/auto"],
    icon: "⧉",
    accent: "border-fuchsia-400/40",
    useCase: "Never get rugged by one provider — route around outages and price hikes automatically.",
    costTier: "standard",
    feeBps: 1000,
  },
  {
    provider: "unorouter",
    name: "Unorouter",
    category: "router",
    description: "OpenRouter-compatible aggregation at sharper prices — a second universal adapter for failover and cost arbitrage.",
    mode: "api_key",
    models: ["gpt-oss-20b:free"],
    icon: "⧉",
    accent: "border-pink-400/40",
    useCase: "Route around OpenRouter outages and price hikes — two adapters beats one.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "freellmapi",
    name: "FreeLLMAPI",
    category: "router",
    description: "Aggregates 600+ free model endpoints behind one OpenAI-compatible API. Personal experimentation, zero spend.",
    mode: "api_key",
    models: ["auto"],
    icon: "$",
    accent: "border-green-400/40",
    useCase: "Build and tinker for $0 — the on-ramp for devs with no budget.",
    costTier: "free",
    feeBps: 0,
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
    useCase: "Any open model on the hub, straight into your agents — fine-tune your edge.",
    costTier: "cheap",
    feeBps: 500,
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
    useCase: "Agent-generated creative — ad variants, thumbnails, product shots on demand.",
    costTier: "cheap",
    feeBps: 500,
  },
  {
    provider: "elevenlabs",
    name: "ElevenLabs · Voice",
    category: "audio",
    description: "Human-grade text-to-speech and speech-to-text — the voice layer for phone and audio agents.",
    mode: "api_key",
    models: ["eleven-v3", "eleven-flash-v2.5", "scribe-v2"],
    icon: "♪",
    accent: "border-rose-400/40",
    useCase: "Voice agents that close deals — calls, voicemails and audio content on demand.",
    costTier: "standard",
    feeBps: 1000,
  },
];

const TEST_PING: Record<string, string> = {
  cloudflare: "https://api.cloudflare.com/client/v4/user/tokens/verify",
  huggingface: "https://huggingface.co/api/whoami-v2",
  anthropic: "https://api.anthropic.com/v1/models?limit=1",
  grok: "https://api.x.ai/v1/models",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  flux: "https://api.cloudflare.com/client/v4/user/tokens/verify",
  openai: "https://api.openai.com/v1/models",
  deepseek: "https://api.deepseek.com/v1/models",
  mistral: "https://api.mistral.ai/v1/models",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
  kimi: "https://api.moonshot.ai/v1/models",
  zai: "https://open.bigmodel.cn/api/paas/v4/models",
  openrouter: "https://openrouter.ai/api/v1/models",
  unorouter: "https://api.unorouter.com/v1/models",
  groq: "https://api.groq.com/openai/v1/models",
  together: "https://api.together.xyz/v1/models",
  cohere: "https://api.cohere.com/v2/models",
  perplexity: "https://api.perplexity.ai/models",
  elevenlabs: "https://api.elevenlabs.io/v1/models",
  freellmapi: "https://freellmapi.co/v1/models",
};
// Providers without an entry here (e.g. amazon/Bedrock) get an honest
// "verify manually" result instead of a fake probe.

const models = new Hono<{ Bindings: ModelsEnv }>();

models.get("/models", async (c) => {
  const user = sessionUserOrDefault(await getSessionUser(c.env, c.req.raw));
  const tokens = await listTokens(c.env.DB, user.sub);
  const connected = new Map(tokens.map((t) => [t.provider, true]));
  // Platform-run providers also count as connected when the operator's
  // Cloudflare API token is present as an encrypted Worker secret.
  const platformBound = Boolean(c.env.CLOUDFLARE_API_TOKEN);

  return c.json({
    user: { sub: user.sub, email: user.email },
    inference_backbone: { runner: "worker-edge", providers_bound: connected.size },
    models: MODEL_DEFS.map((m) => ({
      ...m,
      connected: connected.get(m.provider) ?? (PLATFORM_PROVIDERS.has(m.provider) && platformBound),
    })),
  });
});

/** Probe bound credentials with a lightweight authenticated upstream call. */
models.post("/models/:provider/test", requireSession, async (c) => {
  const provider = c.req.param("provider");
  if (!provider) return c.json({ error: "unknown provider" }, 404);
  const def = MODEL_DEFS.find((m) => m.provider === provider);
  if (!def) return c.json({ error: "unknown provider" }, 404);

  const user = authedUser(c);
  const op = async (): Promise<{ ok: boolean; detail: string; status?: number }> => {
    if (def.mode === "core") return { ok: true, detail: "core channel · no credential required" };

    const ctx: InferContext = { DB: c.env.DB, operator: user, CF_ACCOUNT_ID: c.env.CF_ACCOUNT_ID, VAULT_CIPHER_KEY: c.env.VAULT_CIPHER_KEY, ...(c.env as unknown as Record<string, unknown>) } as InferContext;
    const token = await providerTokenValue(ctx, provider);
    if (!token) return { ok: false, detail: "no credential bound — connect in the Models registry first" };

    const url = TEST_PING[provider];
    if (!url) return { ok: false, detail: "no automated probe for this provider — verify the key in the provider console" };
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
models.post("/models/:provider/run", requireSession, async (c) => {
  const provider = c.req.param("provider");
  if (!provider) return c.json({ error: "unknown provider" }, 404);
  const def = MODEL_DEFS.find((m) => m.provider === provider);
  if (!def) return c.json({ error: "unknown provider" }, 404);
  if (def.mode === "core") return c.json({ error: "core channel — no inference surface" }, 400);

  const user = authedUser(c);
  let body: { model?: string; prompt?: string; image_prompt?: string } = {};
  try { body = await c.req.json(); } catch { /* empty */ }
  if (!body.prompt && !body.image_prompt) return c.json({ error: "prompt is required" }, 400);

  const ctx: InferContext = { DB: c.env.DB, operator: user, CF_ACCOUNT_ID: c.env.CF_ACCOUNT_ID, VAULT_CIPHER_KEY: c.env.VAULT_CIPHER_KEY, ...(c.env as unknown as Record<string, unknown>) } as InferContext;
  const result = await infer(provider, body, ctx, def.feeBps ?? 0);
  return c.json(result);
});

export default models;