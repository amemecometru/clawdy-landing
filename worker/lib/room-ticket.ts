/**
 * Room identity tickets.
 *
 * A hibernating WebSocket `Connection` keeps its upgrade URL (`connection.uri`)
 * but NOT the request headers, so the session cookie is unavailable by the time
 * `onConnect` runs. Query params, however, survive hibernation.
 *
 * So the browser authenticates normally — `fetch()` sends the HttpOnly session
 * cookie — and exchanges it here for a short-lived, single-purpose ticket. The
 * ticket travels in the WebSocket URL and is verified inside the room.
 *
 * This keeps the collaborative surface honest: a human cannot simply claim to be
 * someone else by editing a query param, which is the whole reason the studio is
 * not a permission-checkpoint toy.
 */

import type { SessionUser } from "./session";

const TICKET_PREFIX = "room-ticket:";
const TICKET_TTL_SECONDS = 600;

export interface RoomTicket {
  sub: string;
  name: string;
  kind: "human";
  issued_at: number;
}

export function mintRoomTicket(env: { SESSIONS: KVNamespace }, user: SessionUser): Promise<string> {
  const ticket = crypto.randomUUID();
  const payload: RoomTicket = {
    sub: user.sub,
    name: user.name ?? user.email ?? user.sub,
    kind: "human",
    issued_at: Date.now(),
  };
  // `expirationTtl` is minimum 60s in KV; 600 gives a comfortable window for a
  // slow first paint without meaningfully widening the replay surface.
  return env.SESSIONS.put(`${TICKET_PREFIX}${ticket}`, JSON.stringify(payload), {
    expirationTtl: TICKET_TTL_SECONDS,
  }).then(() => ticket);
}

export async function redeemRoomTicket(
  env: { SESSIONS: KVNamespace },
  ticket: string | null
): Promise<RoomTicket | null> {
  if (!ticket || !/^[0-9a-f-]{36}$/i.test(ticket)) return null;
  const raw = await env.SESSIONS.get(`${TICKET_PREFIX}${ticket}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RoomTicket;
    return parsed && typeof parsed.sub === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export const ROOM_TICKET_TTL_SECONDS = TICKET_TTL_SECONDS;