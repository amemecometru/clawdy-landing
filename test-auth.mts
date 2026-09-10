import { Hono } from "hono";
import { createAuthRouter } from "./src/auth/auth.ts";

class MemKV {
  map = new Map<string, string>();
  async get(k: string) { return this.map.get(k) ?? null; }
  async put(k: string, v: string) { this.map.set(k, v); }
  async delete(k: string) { this.map.delete(k); }
}

const kv = new MemKV() as unknown as KVNamespace;
const env = {
  SESSIONS: kv,
  GOOGLE_CLIENT_ID: "343473510188-6pm5ifmejv45mksfen9l63usjq30qrd5.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "GOCSPX-test",
  AUTH_SECRET: "test-secret",
} as unknown as Record<string, unknown>;

const router = new Hono().route("/api/auth", createAuthRouter());
const base = "http://clawdyclaw.com";
let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log("  ok:", name); }
  else { fail++; console.log("  FAIL:", name, extra); }
}
async function hit(path: string, init?: RequestInit) {
  return router.fetch(new Request(`${base}${path}`, init), env) as Promise<Response>;
}

// 1) csrf
let csrf = "";
{
  const res = await hit("/api/auth/csrf");
  const body = await res.json() as { csrfToken: string };
  const setCookie = res.headers.get("Set-Cookie") ?? "";
  csrf = body.csrfToken;
  check("csrf returns token", !!csrf);
  check("csrf sets cookie", setCookie.includes("clawdyclaw.csrf=") && setCookie.includes("HttpOnly"));
}

// 2) signin happy path
let signinUrl = "";
{
  const res = await hit("/api/auth/signin/google", {
    method: "POST",
    headers: { "Cookie": `clawdyclaw.csrf=${encodeURIComponent(csrf)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: `csrfToken=${encodeURIComponent(csrf)}&callbackUrl=%2Fdashboard`,
  });
  signinUrl = res.headers.get("Location") ?? "";
  check("signin 302", res.status === 302, `status=${res.status}`);
  const u = new URL(signinUrl);
  check("redirects to accounts.google.com", u.hostname === "accounts.google.com");
  check("has redirect_uri callback", u.searchParams.get("redirect_uri") === `${base}/api/auth/callback/google`);
  check("has PKCE challenge", u.searchParams.has("code_challenge") && u.searchParams.get("code_challenge_method") === "S256");
  check("has state", !!u.searchParams.get("state"));
  check("state persisted in KV", kv.map.has(`oauth:${u.searchParams.get("state")}`));
}

// 3) signin bad csrf -> 403
{
  const res = await hit("/api/auth/signin/google", {
    method: "POST",
    headers: { "Cookie": `clawdyclaw.csrf=${encodeURIComponent(csrf)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: `csrfToken=${encodeURIComponent("WRONG")}`,
  });
  check("signin rejects bad csrf (403)", res.status === 403, `status=${res.status}`);
}

// 4) providers
{
  const res = await hit("/api/auth/providers");
  const body = await res.json() as Record<string, { signinUrl: string }>;
  check("providers lists google", !!body.google && body.google.signinUrl.endsWith("/api/auth/signin/google"));
}

// 5) session empty
{
  const res = await hit("/api/auth/session");
  const body = await res.json() as Record<string, unknown>;
  check("session empty when no cookie", Object.keys(body).length === 0);
}

// 6) callback rejects bogus state
{
  const res = await hit("/api/auth/callback/google?state=FAKE&code=xyz", { redirect: "manual" });
  check("callback rejects invalid state", res.status === 302 && (res.headers.get("Location") ?? "").includes("error=InvalidState"));
}

// 7) error page
{
  const res = await hit("/api/auth/error?error=OAuthSignin");
  check("error page renders", res.status === 200 && (await res.text()).includes("OAuthSignin"));
}

// 8) signout no session
{
  const res = await hit("/api/auth/signout", { method: "POST", redirect: "manual" });
  check("signout", res.status === 200 && (res.headers.get("Set-Cookie") ?? "").includes("Max-Age=0"));
}

// 9) signout clears session-cookie when present
{
  const res = await hit("/api/auth/signout", {
    method: "POST",
    headers: { "Cookie": `clawdyclaw.session=abc123` },
  });
  const setCookie = res.headers.get("Set-Cookie") ?? "";
  check("signout clears session cookie", setCookie.includes("clawdyclaw.session") && setCookie.includes("Max-Age=0"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);