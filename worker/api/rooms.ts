/**
 * Room identity API — /api/v1/rooms
 *
 * The only REST surface the studio needs today. The collaborative surface itself
 * is a WebSocket (see worker/agents/studio-room.ts); this exists purely to turn
 * an HttpOnly session cookie into a ticket the WebSocket URL can carry.
 */

import { Hono } from "hono";
import { requireSession, authedUser } from "../lib/require-auth";
import { mintRoomTicket, ROOM_TICKET_TTL_SECONDS } from "../lib/room-ticket";

const rooms = new Hono<{ Bindings: { SESSIONS: KVNamespace } }>();

rooms.post("/ticket", requireSession, async (c) => {
  const user = authedUser(c);
  if (!c.env.SESSIONS) return c.json({ error: "Session store unavailable" }, 503);

  const ticket = await mintRoomTicket(c.env as { SESSIONS: KVNamespace }, user);
  return c.json({
    ticket,
    name: user.name ?? user.email ?? user.sub,
    expires_in: ROOM_TICKET_TTL_SECONDS,
    // The agent class and the URL shape routeAgentRequest expects.
    agent: "studio-room",
    path_template: `/agents/studio-room/{room}?t=${ticket}`,
  });
});

export default rooms;