/**
 * Room identity — client side.
 *
 * The room's WebSocket URL must carry a ticket, but the ticket is minted over an
 * authenticated `fetch()` (the session cookie is HttpOnly and cannot be read by
 * JS). So we mint it lazily, once, and let `useAgent` pass it as a query param
 * when the socket opens.
 *
 * If minting fails the user is simply anonymous in the room — the server
 * degrades to a guest identity rather than refusing the connection.
 */

import { useCallback, useState } from "react";

export interface RoomTicketResponse {
  ticket: string;
  name: string;
  expires_in: number;
  agent: string;
  path_template: string;
}

let cached: { ticket: string; name: string; at: number } | null = null;
const CACHE_MS = 60_000;

export interface RoomTicketState {
  name: string;
  error: string | null;
  refresh: () => Promise<string | null>;
}

export function useRoomTicket(): RoomTicketState {
  const [name, setName] = useState<string>(cached?.name ?? "guest");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setName(cached.name);
      return cached.ticket;
    }
    try {
      const res = await fetch("/api/v1/rooms/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Sign in to join as yourself" : `Ticket failed (${res.status})`);
        return null;
      }
      const body = (await res.json()) as RoomTicketResponse;
      cached = { ticket: body.ticket, name: body.name, at: Date.now() };
      setName(body.name);
      return body.ticket;
    } catch {
      setError("Could not reach the studio");
      return null;
    }
  }, []);

  return { name, error, refresh };
}