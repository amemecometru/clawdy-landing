/**
 * Unified model inference layer — speaks to every model family the
 * platform connects: Cloudflare Workers AI, HuggingFace openWeights,
 * and legacy providers (Anthropic, Grok/xAI, Google Gemini) plus
 * FLUX imaging. Tokens are injected from the encrypted vault, never
 * exposed to callers.
 */

import { getToken, decryptSecret, type VaultEnv } from "../db/vault";

export interface InferContext extends VaultEnv {
  DB: D1Database;
  operator: { sub: string; email: string | null };
  CF_ACCOUNT_ID?: string;
}

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
  if (!rec) return null;
  return decryptSecret(ctx, rec.access_token);
}

const CHAT_MODELS: Record<string, string> = {
  cloudflare: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  huggingface: "meta-llama/Meta-Llama-3.1-8B-Instruct",
  anthropic: "claude-sonnet-4-20250524",
  grok: "grok-4",
  gemini: "gemini-2.5-pro",
};

export async function infer(provider: string, args: InferArgs, ctx: InferContext): Promise<InferResult> {
  const started = Date.now();
  const token = await providerTokenValue(ctx, provider);
  const model = args.model ?? CHAT_MODELS[provider] ?? "";

  if (!token) {
    return finish(provider, model, started, { ok: false, output: { error: `${provider.toUpperCase()}_TOKEN_REQUIRED`, message: `Connect ${provider} in the Models registry to run inference.` } });
  }

  try {
    switch (provider) {
      case "cloudflare": {
        if (!ctx.CF_ACCOUNT_ID) return finish(provider, model, started, { ok: false, output: { error: "CF_ACCOUNT_ID_REQUIRED", message: "Set CF_ACCOUNT_ID on the worker to use Workers AI." } });
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(ctx.CF_ACCOUNT_ID)}/ai/run/${model}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messages: args.messages ?? [{ role: "user", content: args.prompt ?? "" }] }),
        });
        const json = await res.json().catch(() => null);
        return finishResult(provider, model, started, res.ok, json);
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