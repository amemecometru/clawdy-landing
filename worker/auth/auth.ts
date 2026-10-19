/**
 * ClawdyClaw shared identity router — Auth.js-compatible endpoints.
 *
 * Implements the Google OAuth 2.0 Authorization Code flow with PKCE plus an
 * Auth.js-shaped surface so the SAME module can be mounted on any ClawdyClaw
 * host:
 *
 *   GET  /api/auth/csrf
 *   GET  /api/auth/providers
 *   POST /api/auth/signin/google
 *   GET  /api/auth/callback/google
 *   GET  /api/auth/session
 *   POST /api/auth/signout
 *   GET  /api/auth/error
 *
 * Sessions are opaque tokens stored in the shared `SESSIONS` KV namespace so
 * identity is revocable and shared across clawdyclaw.com + agents.clawdyclaw.com.
 */

import { Hono } from "hono";
import { ensureSessionIdentity } from "../db/sessions";

// ─────────────────────────────────────────────────────────────────────────────
// Environment bindings
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthEnv {
  SESSIONS: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AUTH_SECRET: string;
  DB?: D1Database;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crypto + encoding helpers (Web Crypto only — Cloudflare Workers ready)
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
const OAUTH_STATE_TTL = 600; // 10 minutes
const CSRF_TTL = 60 * 60 * 12; // 12 hours

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

async function sha256B64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return base64url(new Uint8Array(digest));
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  const pad = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(pad)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(json) as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function cookieHeader(
  name: string,
  value: string,
  opts: { secure: boolean; maxAge?: number }
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (opts.secure) parts.push("Secure");
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

function clearCookie(name: string, secure: boolean) {
  return cookieHeader(name, "", { secure, maxAge: 0 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Router factory
// ─────────────────────────────────────────────────────────────────────────────

export function createAuthRouter() {
  const app = new Hono<{ Bindings: AuthEnv }>();

  // Providers (Auth.js contract)
  app.get("/providers", (c) => {
    const origin = new URL(c.req.url).origin;
    return c.json({
      google: {
        id: "google",
        name: "Google",
        type: "oauth",
        signinUrl: `${origin}/api/auth/signin/google`,
        callbackUrl: `${origin}/api/auth/callback/google`,
      },
    });
  });

  // CSRF token (Auth.js contract)
  app.get("/csrf", async (c) => {
    const token = base64url(randomBytes(16));
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", cookieHeader("clawdyclaw.csrf", token, { secure, maxAge: CSRF_TTL }));
    return c.json({ csrfToken: token });
  });

  // Sign in with Google
  app.post("/signin/google", async (c) => {
    const cookies = parseCookies(c.req.header("cookie"));
    const reqCsrfToken = (await c.req.parseBody())["csrfToken"]?.toString() ?? "";
    const cookieCsrfToken = cookies["clawdyclaw.csrf"] ?? "";

    if (!reqCsrfToken || reqCsrfToken !== cookieCsrfToken) {
      return c.json({ error: "CSRF token validation failed" }, 403);
    }

    const url = new URL(c.req.url);
    const redirectUri = `${url.origin}/api/auth/callback/google`;
    const rawCallbackUrl = c.req.query("callbackUrl") ?? "";
    const callbackUrl =
      rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
        ? rawCallbackUrl
        : "/";

    // PKCE
    const verifier = base64url(randomBytes(32));
    const challenge = await sha256B64url(verifier);
    const state = base64url(randomBytes(24));

    await c.env.SESSIONS.put(
      `oauth:${state}`,
      JSON.stringify({ verifier, csrfToken: cookieCsrfToken, callbackUrl }),
      { expirationTtl: OAUTH_STATE_TTL }
    );

    const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorize.searchParams.set("client_id", c.env.GOOGLE_CLIENT_ID);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", "openid email profile");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("prompt", "select_account");

    return c.redirect(authorize.toString(), 302);
  });

  // OAuth callback
  app.get("/callback/google", async (c) => {
    const secure = new URL(c.req.url).protocol === "https:";
    const cookies = parseCookies(c.req.header("cookie"));
    const state = c.req.query("state") ?? "";
    const code = c.req.query("code") ?? "";
    const error = c.req.query("error");

    if (error) {
      return c.redirect(`/api/auth/error?error=${encodeURIComponent(error)}`, 302);
    }

    const record = await c.env.SESSIONS.get(`oauth:${state}`);
    await c.env.SESSIONS.delete(`oauth:${state}`);
    if (!record) {
      return c.redirect("/api/auth/error?error=InvalidState", 302);
    }

    // Defensive: only accept the state we handed to the browser that started it.
    if (cookies["clawdyclaw.csrf"] !== (JSON.parse(record) as { csrfToken?: string }).csrfToken) {
      return c.redirect("/api/auth/error?error=CSRFStateMismatch", 302);
    }

    const { verifier, callbackUrl } = JSON.parse(record) as {
      verifier: string;
      callbackUrl: string;
    };

    // Exchange code → tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${new URL(c.req.url).origin}/api/auth/callback/google`,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });

    if (!tokenRes.ok) {
      return c.redirect(
        `/api/auth/error?error=${encodeURIComponent(`token_exchange_${tokenRes.status}`)}`,
        302
      );
    }

    const tokens = (await tokenRes.json()) as {
      id_token: string;
      access_token?: string;
    };
    const claims = decodeJwtPayload(tokens.id_token) as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    // Mint session
    const sessionToken = base64url(randomBytes(24));
    const session = {
      sub: claims.sub,
      email: claims.email ?? null,
      name: claims.name ?? null,
      image: claims.picture ?? null,
      createdAt: Date.now(),
    };
    await c.env.SESSIONS.put(`session:${sessionToken}`, JSON.stringify(session), {
      expirationTtl: SESSION_TTL,
    });

    // Mirror the identity into D1 so owner-scoped records can reference it.
    if (c.env.DB) {
      try {
        await ensureSessionIdentity(c.env.DB, {
          sub: claims.sub,
          email: claims.email ?? null,
          name: claims.name ?? null,
        });
      } catch {
        // Identity mirroring is best-effort; the KV session is authoritative.
      }
    }

    const res = c.redirect(callbackUrl || "/", 302);
    res.headers.append(
      "Set-Cookie",
      cookieHeader("clawdyclaw.session", sessionToken, {
        secure,
        maxAge: SESSION_TTL,
      })
    );
    res.headers.append("Set-Cookie", clearCookie("clawdyclaw.csrf", secure));
    return res;
  });

  // Session lookup (Auth.js contract)
  app.get("/session", async (c) => {
    const cookies = parseCookies(c.req.header("cookie"));
    const token = cookies["clawdyclaw.session"];
    if (!token) return c.json({});

    const raw = token ? await c.env.SESSIONS.get(`session:${token}`) : null;
    if (!raw) return c.json({});

    const session = JSON.parse(raw) as {
      sub: string;
      email: string | null;
      name: string | null;
      image: string | null;
      createdAt: number;
    };
    return c.json({
      user: { name: session.name, email: session.email, image: session.image },
      sub: session.sub,
      expires: new Date(session.createdAt + SESSION_TTL * 1000).toISOString(),
    });
  });

  // Sign out
  app.post("/signout", async (c) => {
    const secure = new URL(c.req.url).protocol === "https:";
    const cookies = parseCookies(c.req.header("cookie"));
    const token = cookies["clawdyclaw.session"];
    if (token) await c.env.SESSIONS.delete(`session:${token}`);
    c.header("Set-Cookie", clearCookie("clawdyclaw.session", secure));
    const callbackUrl = c.req.query("callbackUrl")?.startsWith("/") ? c.req.query("callbackUrl")! : "/";
    return c.json({ url: callbackUrl });
  });

  // Error page
  app.get("/error", (c) => {
    const error = c.req.query("error") ?? "Unknown";
    const safe = error.replace(/[^a-zA-Z0-9_=-]/g, "_");
    return c.html(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Sign in error</title>
<style>body{font-family:ui-monospace,monospace;background:#070606;color:#d7cac9;display:grid;place-items:center;min-height:100vh}code{color:#e35234}</style></head>
<body><div><h1>Authentication error</h1><p><code>${safe}</code></p><a href="/">← back to clawdyclaw.com</a></div></body></html>`);
  });

  return app;
}

// Convenience: mount the router at /api/auth on any Hono app.
export function registerAuth(app: Hono, mountPath = "/api/auth") {
  app.route(mountPath, createAuthRouter());
}

export default createAuthRouter;