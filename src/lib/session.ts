/**
 * Session resolution — reads the ClawdyClaw session cookie and returns
 * the authenticated user identity (shared across all API routes).
 */

export interface SessionUser {
  sub: string;
  email: string | null;
  name: string | null;
}

const SESSION_COOKIE = "clawdyclaw.session";
const SESSION_TTL = 60 * 60 * 24 * 30;

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export async function getSessionUser(
  env: { SESSIONS: KVNamespace },
  request: Request
): Promise<SessionUser | null> {
  const token = parseCookies(request.headers.get("cookie") ?? undefined)[SESSION_COOKIE];
  if (!token) return null;
  const raw = await env.SESSIONS.get(`session:${token}`);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as { sub: string; email?: string | null; name?: string | null };
    return { sub: s.sub, email: s.email ?? null, name: s.name ?? null };
  } catch {
    return null;
  }
}

export function sessionUserOrDefault(user: SessionUser | null): SessionUser {
  return user ?? { sub: "anonymous", email: null, name: null };
}

export { SESSION_COOKIE, SESSION_TTL };