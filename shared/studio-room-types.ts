/**
 * Studio Room contract — the shared document humans and agents edit together.
 *
 * This lives in shared/ rather than duplicated on either side: the Worker owns
 * the behaviour (worker/agents/studio-room.ts) and the browser owns the
 * rendering (src/pages/studio/room-page.tsx), but the shape of the room is a
 * contract between them and must not drift.
 *
 * Everything in `StudioRoomState` is synchronised: an `setState` on either side
 * persists to the room's SQLite and broadcasts to every connected participant.
 */

export type ParticipantKind = "human" | "agent";

export interface RoomParticipant {
  id: string;
  name: string;
  kind: ParticipantKind;
  joined_at: number;
}

export type RoomEntryKind = "note" | "proposal" | "decision";

export interface RoomEntry {
  id: string;
  author: string;
  author_kind: ParticipantKind;
  kind: RoomEntryKind;
  body: string;
  at: number;
}

/**
 * The artifact under discussion. A tool proposal lands here first, gets argued
 * about in the room, and only then moves toward the registry.
 */
export interface RoomDraft {
  tool: string;
  rationale: string;
  input_schema: string;
}

export interface StudioRoomState {
  title: string;
  participants: RoomParticipant[];
  entries: RoomEntry[];
  draft: RoomDraft | null;
  revision: number;
}

/** Ring caps so a long-running room cannot grow its state row without limit. */
export const MAX_ENTRIES = 200;
export const MAX_PARTICIPANTS = 64;

/** Agent class name and the URL shape routeAgentRequest expects. */
export const ROOM_AGENT = "studio-room";

export function roomPath(room: string): string {
  return `/agents/${ROOM_AGENT}/${encodeURIComponent(room)}`;
}

/** An agent joining a room uses this shape; humans carry `?t=<ticket>` instead. */
export function agentRoomPath(room: string, name: string): string {
  return `${roomPath(room)}?kind=agent&name=${encodeURIComponent(name)}`;
}