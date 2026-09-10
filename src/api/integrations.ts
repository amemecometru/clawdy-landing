/**
 * Integrations Catalog & Auth Vault API.
 *
 *   GET  /api/v1/integrations              → catalog + per-user connection status
 *   GET  /api/v1/auth/:provider/connect     → OAuth redirect / key-binding metadata
 *   GET  /api/v1/auth/:provider/callback    → exchange code → store token → redirect
 *   POST /api/v1/integrations/:provider/key → bind an API key
 *
 * Tokens are stored encrypted-at-rest in the `vault_tokens` D1 table.
 */

import { Hono } from "hono";
import { getSessionUser, sessionUserOrDefault } from "../lib/session";
import { storeToken, listTokens, type VaultEnv } from "../db/vault";

export interface IntegrationEnv extends VaultEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export type AuthMode = "oauth" | "api_key" | "core";

export interface IntegrationDef {
  provider: string;
  name: string;
  icon: string; // lucide icon slug for the frontend
  mode: AuthMode;
  description: string;
  tools: string[];
  badge: string; // [Active] [Requires Auth] [Core Primitive]
  badgeTone: "ok" | "warn" | "core";
  scopes?: string;
  oauth?: { scopes: string };
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    provider: "google",
    name: "Gmail",
    icon: "mail",
    mode: "oauth",
    description: "Read, draft, and send email through the GAIA Gmail API.",
    tools: ["send_email", "search_threads", "draft_reply"],
    badge: "Requires Auth",
    badgeTone: "warn",
    oauth: { scopes: "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly" },
  },
  {
    provider: "github",
    name: "GitHub",
    icon: "github",
    mode: "oauth",
    description: "File issues, open PRs, and inspect repositories.",
    tools: ["create_issue", "create_pull_request"],
    badge: "Requires Auth",
    badgeTone: "warn",
    oauth: { scopes: "repo read:user" },
  },
  {
    provider: "stripe",
    name: "Stripe",
    icon: "credit-card",
    mode: "api_key",
    description: "Billing, invoices, and subscription management.",
    tools: ["create_invoice", "list_products"],
    badge: "Requires Auth",
    badgeTone: "warn",
  },
  {
    provider: "apify",
    name: "Web Scraper",
    icon: "bot",
    mode: "api_key",
    description: "Marketplace scraping via Apify actors (stress-test tier).",
    tools: ["run_scraper"],
    badge: "Requires Auth",
    badgeTone: "warn",
  },
  {
    provider: "openrouter",
    name: "OpenRouter",
    icon: "sparkles",
    mode: "api_key",
    description: "Multi-model inference for agent skillchains.",
    tools: ["llm_infer"],
    badge: "Requires Auth",
    badgeTone: "warn",
  },
  {
    provider: "vector_memory",
    name: "Vector Memory",
    icon: "database",
    mode: "core",
    description: "Cloudflare-backed semantic memory for lookup + recall.",
    tools: ["query_knowledge", "store_knowledge"],
    badge: "Core Primitive",
    badgeTone: "core",
  },
  {
    provider: "cloudflare",
    name: "Cloudflare Workers AI",
    icon: "◈",
    mode: "api_key",
    description: "Edge inference backbone — most models run here (Llama, Qwen, DeepSeek, Mistral).",
    tools: ["cloudflare_ai", "model_infer", "flux_image"],
    badge: "Core Backbone",
    badgeTone: "core",
  },
  {
    provider: "huggingface",
    name: "HuggingFace · OpenWeights",
    icon: "H",
    mode: "api_key",
    description: "HF inference router — connect open-weight models straight into the Tool Registry.",
    tools: ["hf_infer", "model_infer"],
    badge: "Requires Auth",
    badgeTone: "warn",
  },
  {
    provider: "flux",
    name: "FLUX · Imaging",
    icon: "◧",
    mode: "api_key",
    description: "Image generation via Cloudflare Workers AI (FLUX.1-schnell).",
    tools: ["flux_image"],
    badge: "Requires Auth",
    badgeTone: "warn",
  },
  {
    provider: "anthropic",
    name: "Anthropic · Claude",
    icon: "λ",
    mode: "api_key",
    description: "Legacy frontier chat via Claude messages API.",
    tools: ["model_infer"],
    badge: "Requires Auth",
    badgeTone: "warn",
  },
  {
    provider: "grok",
    name: "Grok · xAI",
    icon: "¤",
    mode: "api_key",
    description: "Legacy frontier chat via the xAI compatible endpoint.",
    tools: ["model_infer"],
    badge: "Requires Auth",
    badgeTone: "warn",
  },
  {
    provider: "gemini",
    name: "Google · Gemini",
    icon: "✦",
    mode: "api_key",
    description: "Legacy frontier chat via the generative language API.",
    tools: ["model_infer"],
    badge: "Requires Auth",
    badgeTone: "warn",
  },
];

const OAUTH_PROVIDERS: Record<string, { clientIdKey: string; clientSecretKey: string }> = {
  google: { clientIdKey: "GOOGLE_CLIENT_ID", clientSecretKey: "GOOGLE_CLIENT_SECRET" },
  github: { clientIdKey: "GITHUB_CLIENT_ID", clientSecretKey: "GITHUB_CLIENT_SECRET" },
};

const OAUTH_STATE_TTL = 600;

function b64u(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

const integrations = new Hono<{ Bindings: IntegrationEnv }>();

/**
 * GET /api/v1/integrations
 */
integrations.get("/integrations", async (c) => {
  const user = sessionUserOrDefault(await getSessionUser(c.env, c.req.raw));
  const tokens = await listTokens(c.env.DB, user.sub);
  const connected = new Map(tokens.map((t) => [t.provider, true]));

  const catalog = INTEGRATIONS.map((def) => ({
    ...def,
    connected: connected.get(def.provider) ?? false,
  }));

  return c.json({ user: { sub: user.sub, email: user.email }, integrations: catalog });
});

/**
 * GET /api/v1/auth/:provider/connect
 * OAuth providers get a 302 redirect; api_key/core providers return metadata
 * so the frontend can prompt for a key or mark as core.
 */
integrations.get("/auth/:provider/connect", async (c) => {
  const provider = c.req.param("provider");
  const def = INTEGRATIONS.find((i) => i.provider === provider);
  if (!def) return c.json({ error: "Unknown provider" }, 404);

  if (def.mode === "core") {
    return c.json({ provider, mode: "core", message: "Core primitive — no credential required" });
  }

  if (def.mode === "api_key") {
    return c.json({
      provider,
      mode: "api_key",
      message: "Paste your API key in the binding modal",
      bind_url: `/api/v1/integrations/${provider}/key`,
    });
  }

  // OAuth flow
  const oauth = OAUTH_PROVIDERS[provider];
  const clientId = oauth ? c.env[oauth.clientIdKey as keyof IntegrationEnv] as string : undefined;
  if (!clientId) {
    return c.json({ error: `OAuth not configured for ${provider} (missing client id/secret)` }, 501);
  }

  const user = sessionUserOrDefault(await getSessionUser(c.env, c.req.raw));
  const state = b64u(randomBytes(24));
  const origin = new URL(c.req.url).origin;

  await c.env.SESSIONS.put(
    `vault_oauth:${state}`,
    JSON.stringify({ provider, user_id: user.sub }),
    { expirationTtl: OAUTH_STATE_TTL }
  );

  const authorize = new URL(def.provider === "google"
    ? "https://accounts.google.com/o/oauth2/v2/auth"
    : `https://github.com/login/oauth/authorize`);

  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", `${origin}/api/v1/auth/${provider}/callback`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("state", state);
  if (provider === "github") {
    authorize.searchParams.set("scope", "repo read:user");
    // SC or PKCE as fallback
    const verifier = b64u(randomBytes(32));
    const challenger = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const pkce = b64u(new Uint8Array(challenger));
    authorize.searchParams.set("code_challenge", pkce);
    authorize.searchParams.set("code_challenge_method", "S256");
    await c.env.SESSIONS.put(`vault_oauth:${state}:verifier`, verifier, { expirationTtl: OAUTH_STATE_TTL });
  } else {
    const verifier = b64u(randomBytes(32));
    const challenger = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const pkce = b64u(new Uint8Array(challenger));
    authorize.searchParams.set("code_challenge", pkce);
    authorize.searchParams.set("code_challenge_method", "S256");
    await c.env.SESSIONS.put(`vault_oauth:${state}:verifier`, verifier, { expirationTtl: OAUTH_STATE_TTL });
  }
  if (def.oauth?.scopes && provider === "google") {
    authorize.searchParams.set("scope", def.oauth.scopes);
    authorize.searchParams.set("access_type", "offline");
    authorize.searchParams.set("prompt", "consent");
  }

  return c.redirect(authorize.toString(), 302);
});

/**
 * GET /api/v1/auth/:provider/callback
 */
integrations.get("/auth/:provider/callback", async (c) => {
  const provider = c.req.param("provider");
  const def = INTEGRATIONS.find((i) => i.provider === provider);
  if (!def || def.mode !== "oauth") {
    return c.redirect("/studio/tools?vault=error&reason=provider", 302);
  }

  const state = c.req.query("state") ?? "";
  const code = c.req.query("code") ?? "";
  const err = c.req.query("error");

  const record = await c.env.SESSIONS.get(`vault_oauth:${state}`);
  await c.env.SESSIONS.delete(`vault_oauth:${state}`);
  if (err) {
    return c.redirect(`/studio/tools?vault=error&reason=${encodeURIComponent(err)}`, 302);
  }
  if (!record) {
    return c.redirect("/studio/tools?vault=error&reason=state_expired", 302);
  }
  const { user_id } = JSON.parse(record) as { provider: string; user_id: string };

  const oauth = OAUTH_PROVIDERS[provider];
  const clientId = c.env[oauth.clientIdKey as keyof IntegrationEnv] as string;
  const clientSecret = c.env[oauth.clientSecretKey as keyof IntegrationEnv] as string;
  const origin = new URL(c.req.url).origin;

  const tokenUrl =
    provider === "google" ? "https://oauth2.googleapis.com/token" : "https://github.com/login/oauth/access_token";

  const params: Record<string, string> = {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/api/v1/auth/${provider}/callback`,
    grant_type: "authorization_code",
  };
  const verifier = await c.env.SESSIONS.get(`vault_oauth:${state}:verifier`);
  await c.env.SESSIONS.delete(`vault_oauth:${state}:verifier`);
  if (verifier) params.code_verifier = verifier;

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });

  if (!tokenRes.ok) {
    return c.redirect(`/studio/tools?vault=error&reason=token_exchange_${tokenRes.status}`, 302);
  }

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
  };
  if (!tokens.access_token) {
    return c.redirect("/studio/tools?vault=error&reason=no_access_token", 302);
  }

  const expiresAt = tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null;
  await storeToken(c.env.DB, c.env, {
    user_id,
    provider,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: expiresAt,
    scope: tokens.scope ?? def.oauth?.scopes ?? null,
  });

  return c.redirect("/studio/tools?vault=connected&provider=" + provider, 302);
});

/**
 * POST /api/v1/integrations/:provider/key — bind an API key.
 */
integrations.post("/integrations/:provider/key", async (c) => {
  const provider = c.req.param("provider");
  const def = INTEGRATIONS.find((i) => i.provider === provider);
  if (!def) return c.json({ error: "Unknown provider" }, 404);
  if (def.mode !== "api_key") {
    return c.json({ error: "Provider does not accept an API key" }, 400);
  }

  let body: { key?: string } = {};
  try { body = await c.req.json(); } catch { /* empty */ }
  const key = body.key;
  if (!key) return c.json({ error: "key is required" }, 400);

  const user = sessionUserOrDefault(await getSessionUser(c.env, c.req.raw));
  await storeToken(c.env.DB, c.env, { user_id: user.sub, provider, access_token: key });

  return c.json({ ok: true, provider, connected: true });
});

export default integrations;