/**
 * Unified model inference layer — speaks to every model family the
 * platform connects: Cloudflare Workers AI, HuggingFace openWeights,
 * and legacy providers (Anthropic, Grok/xAI, Google Gemini) plus
 * FLUX imaging.
 *
 * Two credential layers, in order:
 *   1. User vault (BYOK) — per-operator encrypted tokens in D1 `vault_tokens`.
 *   2. Platform secret — the operator's Cloudflare API token, stored ONLY as
 *      an encrypted Worker secret (dashboard Settings > Variables), never in
 *      the repo or local dir. Applies solely to platform-run providers
 *      (Cloudflare Workers AI + FLUX imaging), which bill to the operator's
 *      own Cloudflare account.
 * Tokens are injected from the vault or env, never exposed to callers.
 */

import { getToken, decryptSecret, type VaultEnv } from "../db/vault";

export interface InferContext extends VaultEnv {
  DB: D1Database;
  operator: { sub: string; email: string | null };
  CF_ACCOUNT_ID?: string;
  /** Encrypted Worker secret (dashboard Settings > Variables). Never in repo. */
  CLOUDFLARE_API_TOKEN?: string;
}

/** Providers that run on the operator's own Cloudflare account. */
export const PLATFORM_PROVIDERS = new Set(["cloudflare", "flux"]);

export interface InferResult {
  ok: boolean;
  provider: string;
  model: string;
  output: unknown;
  latency_ms: number;
}

interface InferArgs {
  model?: string;
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  image_prompt?: string;
}

export async function providerTokenValue(ctx: InferContext, provider: string): Promise<string | null> {
  const rec = await getToken(ctx.DB, ctx, ctx.operator.sub, provider);
  if (rec) return decryptSecret(ctx, rec.access_token);
  // Platform fallback: the operator's Cloudflare API token from the encrypted
  // Worker secret (dashboard Settings > Variables). Cloudflare decrypts it
  // into env at runtime — it never lives in the repo or local dir.
  // Never served to anonymous callers: the platform secret spends the
  // operator's own Cloudflare account, so it requires a signed-in operator.
  if (
    PLATFORM_PROVIDERS.has(provider) &&
    ctx.operator.sub !== "anonymous" &&
    ctx.CLOUDFLARE_API_TOKEN
  ) {
    return ctx.CLOUDFLARE_API_TOKEN;
  }
  return null;
}

const CHAT_MODELS: Record<string, string> = {
  cloudflare: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  huggingface: "meta-llama/Meta-Llama-3.1-8B-Instruct",
  anthropic: "claude-sonnet-5",
  grok: "grok-4.7",
  gemini: "gemini-3.5-flash",
  openai: "gpt-6-sol",
  deepseek: "deepseek-v4",
  mistral: "mistral-medium-3.5",
  qwen: "qwen3.7-plus",
  kimi: "kimi-k2.7-code",
  zai: "glm-5.2",
  openrouter: "openrouter/auto",
  freellmapi: "auto",
  groq: "groq/llama-3.3-70b",
  together: "together/llama-4-maverick",
  perplexity: "sonar-pro",
  unorouter: "gpt-oss-20b:free",
};

/**
 * OpenAI-compatible chat providers. One driver serves them all:
 * POST {baseUrl}/chat/completions with Bearer auth.
 * Base URLs current as of Oct 2026 — confirm against vendor docs at deploy.
 */
const OPENAI_COMPATIBLE: Record<string, { baseUrl: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1" },
  mistral: { baseUrl: "https://api.mistral.ai/v1" },
  qwen: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  kimi: { baseUrl: "https://api.moonshot.ai/v1" },
  zai: { baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1" },
  freellmapi: { baseUrl: "https://freellmapi.co/v1" },
  groq: { baseUrl: "https://api.groq.com/openai/v1" },
  together: { baseUrl: "https://api.together.xyz/v1" },
  perplexity: { baseUrl: "https://api.perplexity.ai" },
  unorouter: { baseUrl: "https://api.unorouter.com/v1" },
};

/** Metering foundation for the platform fee wrapper. Fire-and-forget. */
async function recordUsage(
  ctx: InferContext,
  provider: string,
  model: string,
  output: unknown,
  feeBps: number
): Promise<void> {
  try {
    const usage = (output as { usage?: { prompt_tokens?: number; completion_tokens?: number } } | null)?.usage;
    await ctx.DB.prepare(
      "INSERT INTO inference_usage (id, operator_sub, provider, model, prompt_tokens, completion_tokens, fee_bps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        ctx.operator.sub,
        provider,
        model,
        usage?.prompt_tokens ?? null,
        usage?.completion_tokens ?? null,
        feeBps,
        Math.floor(Date.now() / 1000)
      )
      .run();
  } catch {
    /* metering must never break inference */
  }
}

async function openaiChatCompletion(
  provider: string,
  model: string,
  token: string,
  args: InferArgs,
  ctx: InferContext,
  started: number,
  feeBps: number
): Promise<InferResult> {
  const cfg = OPENAI_COMPATIBLE[provider];
  // Registry IDs may carry a "provider/" prefix for display; strip it —
  // vendor APIs expect the bare model ID. (OpenRouter-style "org/model"
  // IDs pass through untouched.)
  const apiModel = model.startsWith(`${provider}/`) ? model.slice(provider.length + 1) : model;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://clawdyclaw.com";
    headers["X-Title"] = "ClawdyClaw";
  }
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: apiModel,
      messages: args.messages ?? [{ role: "user", content: args.prompt ?? "" }],
    }),
  });
  const json = await res.json().catch(() => null);
  const result = finishResult(provider, apiModel, started, res.ok, json);
  if (res.ok) await recordUsage(ctx, provider, apiModel, json, feeBps);
  return result;
}

async function cloudflareAiRun(
  model: string,
  token: string,
  args: InferArgs,
  ctx: InferContext,
  started: number,
  provider: string,
  feeBps: number
): Promise<InferResult> {
  if (!ctx.CF_ACCOUNT_ID)
    return finish(provider, model, started, {
      ok: false,
      output: { error: "CF_ACCOUNT_ID_REQUIRED", message: "Set CF_ACCOUNT_ID on the worker to use Workers AI." },
    });
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(ctx.CF_ACCOUNT_ID)}/ai/run/${model}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: args.messages ?? [{ role: "user", content: args.prompt ?? "" }] }),
    }
  );
  const json = await res.json().catch(() => null);
  const result = finishResult(provider, model, started, res.ok, json);
  if (res.ok) await recordUsage(ctx, provider, model, json, feeBps);
  return result;
}

export async function infer(
  provider: string,
  args: InferArgs,
  ctx: InferContext,
  feeBps = 0
): Promise<InferResult> {
  const started = Date.now();
  const token = await providerTokenValue(ctx, provider);
  const model = args.model ?? CHAT_MODELS[provider] ?? "";

  if (!token) {
    return finish(provider, model, started, { ok: false, output: { error: `${provider.toUpperCase()}_TOKEN_REQUIRED`, message: `Connect ${provider} in the Models registry to run inference.` } });
  }

  // One driver for every OpenAI-compatible chat provider.
  if (OPENAI_COMPATIBLE[provider]) {
    return openaiChatCompletion(provider, model, token, args, ctx, started, feeBps);
  }

  try {
    switch (provider) {
      case "cloudflare": {
        return cloudflareAiRun(model, token, args, ctx, started, provider, feeBps);
      }

      case "meta": {
        // Meta publishes no first-party LLM API — Llama is served through the
        // platform's router layer. Pick the best connected backing.
        const backing = (await providerTokenValue(ctx, "openrouter"))
          ? "openrouter"
          : (await providerTokenValue(ctx, "freellmapi"))
            ? "freellmapi"
            : "cloudflare";
        if (backing === "cloudflare") {
          const cfToken = await providerTokenValue(ctx, "cloudflare");
          if (!cfToken)
            return finish(provider, model, started, {
              ok: false,
              output: { error: "META_NO_BACKING", message: "Connect OpenRouter, FreeLLMAPI, or the Cloudflare backbone to run Llama." },
            });
          return cloudflareAiRun(
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            cfToken,
            args,
            ctx,
            started,
            provider,
            feeBps
          );
        }
        const backingToken = (await providerTokenValue(ctx, backing)) as string;
        const mapped = args.model ?? "meta-llama/llama-4-maverick";
        return openaiChatCompletion(backing, mapped, backingToken, { ...args, model: mapped }, ctx, started, feeBps);
      }

      case "huggingface": {
        const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-use-cache": "false" },
          body: JSON.stringify({ inputs: args.prompt ?? (args.messages ?? []).map((m) => m.content).join("\n") }),
        });
        const json = await res.json().catch(() => null);
        return finishResult(provider, model, started, res.ok, json);
      }

      case "anthropic": {
        const messages = args.messages ?? (args.prompt ? [{ role: "user", content: args.prompt }] : []);
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": token, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model, max_tokens: 1024, messages }),
        });
        const json = await res.json().catch(() => null);
        return finishResult(provider, model, started, res.ok, json);
      }

      case "grok": {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: model || "grok-2-latest", messages: args.messages ?? [{ role: "user", content: args.prompt ?? "" }] }),
        });
        const json = await res.json().catch(() => null);
        return finishResult(provider, model, started, res.ok, json);
      }

      case "gemini": {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: args.messages ?? [{ role: "user", content: args.prompt ?? "" }] }),
        });
        const json = await res.json().catch(() => null);
        return finishResult(provider, model, started, res.ok, json);
      }

      case "flux": {
        if (!ctx.CF_ACCOUNT_ID) return finish(provider, model, started, { ok: false, output: { error: "CF_ACCOUNT_ID_REQUIRED", message: "FLUX imaging runs on Cloudflare Workers AI." } });
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(ctx.CF_ACCOUNT_ID)}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: args.image_prompt ?? args.prompt ?? "" }),
        });
        const json = await res.json().catch(() => null);
        return finishResult(provider, model, started, res.ok, json);
      }

      default:
        return finish(provider, model, started, { ok: false, output: { error: "UNKNOWN_PROVIDER", provider } });
    }
  } catch (e) {
    return finish(provider, model, started, { ok: false, output: { error: "INFER_FAILED", message: e instanceof Error ? e.message : "unknown" } });
  }
}

function finishResult(provider: string, model: string, started: number, ok: boolean, json: unknown): InferResult {
  return finish(provider, model, started, { ok, output: json });
}

function finish(provider: string, model: string, started: number, r: { ok: boolean; output: unknown }): InferResult {
  return { ok: r.ok, provider, model, output: r.output, latency_ms: Date.now() - started };
}