/**
 * StudioRoom — one durable room per collaborative session.
 *
 * The point of this class is that `Agent` IS a Durable Object, so a room gets
 * a single-threaded execution context, embedded SQLite, and hibernating
 * WebSockets for free. State is the shared document:
 *
 *   - `participants` — who is in the room right now (humans and agents alike)
 *   - `entries`      — the shared work log: notes, tool proposals, decisions
 *   - `draft`        — the artifact under discussion, edited by anyone
 *
 * `setState` persists to SQLite AND broadcasts to every connected socket in one
 * call, so a write from a human in the browser lands on an agent mid-turn with
 * no polling and no permission checkpoint in the way.
 *
 * Identity: a hibernating `Connection` keeps its upgrade URL but not its request
 * headers, so humans do not re-announce themselves — the browser exchanges its
 * session cookie for a short-lived ticket (see lib/room-ticket.ts) and passes
 * that in the query string. Agents declare `?kind=agent` and may be anonymous.
 */

import { Agent, type Connection } from "agents";
import { redeemRoomTicket } from "../lib/room-ticket";
import {
  MAX_ENTRIES,
  MAX_PARTICIPANTS,
  type RoomDraft,
  type RoomEntry,
  type RoomEntryKind,
  type RoomParticipant,
  type StudioRoomState,
} from "../../shared/studio-room-types";
import type { ClawdyEnv } from "../index";

export class StudioRoom extends Agent<ClawdyEnv, StudioRoomState> {
  initialState: StudioRoomState = {
    title: "Untitled room",
    participants: [],
    entries: [],
    draft: null,
    revision: 0,
  };

  /**
   * Called before the first request is handled. Seeds the room title from the
   * instance name so `/agents/studio-room/tool-workshop` reads sensibly in the UI.
   */
  onStart(): void {
    const seed = this.ctx.id.name;
    if (seed && this.state.title === "Untitled room") {
      this.setState({ ...this.state, title: humanizeRoomName(seed) });
    }
  }

  async onConnect(connection: Connection): Promise<void> {
    const who = await identify(connection.uri, this.env);
    const participants = [
      ...this.state.participants.filter((p) => p.id !== who.id),
      who,
    ].slice(0, MAX_PARTICIPANTS);

    this.setState({
      ...this.state,
      participants,
      revision: this.state.revision + 1,
    });
  }

  onClose(connection: Connection): void {
    if (!this.state.participants.some((p) => p.id === connection.id)) return;
    this.setState({
      ...this.state,
      participants: this.state.participants.filter((p) => p.id !== connection.id),
      revision: this.state.revision + 1,
    });
  }

  onMessage(connection: Connection, message: string | ArrayBuffer | Uint8Array): void {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    if (!text.trim()) return;

    const author = this.state.participants.find((p) => p.id === connection.id);
    const parsed = safeParseEntry(text, author);

    this.setState({
      ...this.state,
      entries: [...this.state.entries, parsed].slice(-MAX_ENTRIES),
      revision: this.state.revision + 1,
    });
  }

  /** Server-side write path for agents holding a stub. */
  postEntry(body: string, kind: RoomEntryKind = "note", author = "agent"): number {
    const entry: RoomEntry = {
      id: crypto.randomUUID(),
      author,
      author_kind: "agent",
      kind,
      body: body.slice(0, 4000),
      at: Date.now(),
    };
    this.setState({
      ...this.state,
      entries: [...this.state.entries, entry].slice(-MAX_ENTRIES),
      revision: this.state.revision + 1,
    });
    return this.state.revision;
  }

  /** Server-side write path for agents proposing to the shared draft. */
  setDraft(draft: RoomDraft | null): number {
    this.setState({
      ...this.state,
      draft,
      revision: this.state.revision + 1,
    });
    return this.state.revision;
  }
}

// ── Identity ───────────────────────────────────────────────────────────────────

async function identify(uri: string | null, env: ClawdyEnv): Promise<RoomParticipant> {
  const params = uri ? new URL(uri).searchParams : null;

  // Agents identify themselves. This is a declared machine identity, not a
  // privilege claim — an agent still only reaches rooms it is pointed at.
  if (params?.get("kind") === "agent") {
    const name = params.get("name") ?? "agent";
    return { id: `agent:${name}`, name, kind: "agent", joined_at: Date.now() };
  }

  // Humans present a ticket minted over an authenticated request.
  if (env.SESSIONS) {
    const ticket = await redeemRoomTicket(env, params?.get("t") ?? null);
    if (ticket) {
      return {
        id: `human:${ticket.sub}`,
        name: ticket.name,
        kind: "human",
        joined_at: Date.now(),
      };
    }
  }

  return {
    id: `human:anon:${crypto.randomUUID().slice(0, 8)}`,
    name: params?.get("name") ?? "guest",
    kind: "human",
    joined_at: Date.now(),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeParseEntry(text: string, author: RoomParticipant | undefined): RoomEntry {
  // Accepts a bare string as a note, or {"kind","body"} as structured JSON.
  try {
    const parsed = JSON.parse(text) as Partial<RoomEntry>;
    if (parsed && typeof parsed.body === "string") {
      return {
        id: crypto.randomUUID(),
        author: author?.name ?? "unknown",
        author_kind: author?.kind ?? "human",
        kind: isEntryKind(parsed.kind) ? parsed.kind : "note",
        body: parsed.body.slice(0, 4000),
        at: Date.now(),
      };
    }
  } catch {
    /* not JSON — treat the raw text as a note */
  }
  return {
    id: crypto.randomUUID(),
    author: author?.name ?? "unknown",
    author_kind: author?.kind ?? "human",
    kind: "note",
    body: text.slice(0, 4000),
    at: Date.now(),
  };
}

function isEntryKind(value: unknown): value is RoomEntryKind {
  return value === "note" || value === "proposal" || value === "decision";
}

function humanizeRoomName(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}