/**
 * Auth enforcement — the single place that turns "is this caller allowed"
 * into a yes/no.
 *
 * DRAFT for review — not yet the law of the land. When approved, routes opt
 * in by adding `requireSession` as Hono middleware or by calling
 * `webhookSecretValid` at the top of a handler.
 *
 * Two gates:
 *   requireSession      — Hono middleware. 401 unless a valid ClawdyClaw
 *                         session cookie resolves via the SESSIONS KV
 *                         namespace. Sets the session user as c.get("user").
 *   webhookSecretValid  — shared-secret check for machine-to-machine
 *                         webhook ingress (X-Webhook-Secret header vs an
 *                         env secret).
 */

import type { Context, Next } from "hono";
import { getSessionUser, type SessionUser } from "./session";

export interface SessionCapableEnv {
  SESSIONS?: KVNamespace;
}

export type SessionContext = Context<{
  Bindings: SessionCapableEnv;
  Variables: { user: SessionUser };
}>;

/**
 * Drop-in Hono middleware: rejects unauthenticated callers with 401 and
 * exposes the session user as c.get("user"). Use on every route that must
 * never run as "anonymous".
 *
 *   tasks.post("/:id/approve", requireSession, async (c) => { ... });
 *
 * If the SESSIONS binding is missing entirely, this fails closed (401) —
 * without a session store there is no one to trust.
 */
export async function requireSession(
  c: SessionContext,
  next: Next
): Promise<Response | void> {
  const user = c.env.SESSIONS
    ? await getSessionUser(c.env as { SESSIONS: KVNamespace }, c.req.raw)
    : null;
  if (!user) {
    return c.json({ error: "Unauthorized — sign in to use this endpoint" }, 401);
  }
  c.set("user", user);
  await next();
}

/** Session user on a context that passed through requireSession. */
export function authedUser(c: Context): SessionUser {
  return c.get("user") as SessionUser;
}

/** Constant-time string comparison (avoids early-return timing leaks). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Validate the X-Webhook-Secret header against a named env secret.
 *
 * If the env secret is not configured, the check is SKIPPED (returns true)
 * with a warn — so existing integrations keep working until the secret is
 * set in the dashboard (Worker Settings > Variables > Secrets, encrypted).
 * Once the secret exists, missing or mismatched headers get 401.
 */
export function webhookSecretValid(
  env: Record<string, unknown>,
  secretName: string,
  req: Request
): boolean {
  const secret = env[secretName];
  if (typeof secret !== "string" || secret.length === 0) {
    console.warn(`[auth] ${secretName} not set — accepting unsigned webhook ingress`);
    return true;
  }
  const provided = req.headers.get("x-webhook-secret") ?? "";
  return timingSafeEqual(secret, provided);
}
