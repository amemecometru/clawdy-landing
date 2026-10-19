/**
 * Studio Room — the collaborative surface.
 *
 * One room = one Agent instance (a Durable Object) at /agents/studio-room/:room.
 * State is the shared document: who is here, the shared log, and the draft being
 * worked on. `setState` persists and broadcasts, so a human typing in this page
 * lands on every other participant — including agents — with no polling and no
 * approval gate in between.
 *
 * An agent joins the exact same room at the same URL:
 *
 *   /agents/studio-room/<room>?kind=agent&name=researcher
 */

import * as React from "react";
import { useAgent } from "agents/react";
import { cn } from "@/lib/utils";
import { useRoomTicket } from "@/lib/room-ticket";
import type { RoomDraft, RoomEntry, StudioRoomState } from "@shared/studio-room-types";

const AGENT = "studio-room";

function roomFromHash(): string {
  const raw = window.location.hash.replace(/^#\/?room\/?/, "").trim();
  const slug = raw.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  return slug || "lobby";
}

export default function StudioRoomPage() {
  const [room, setRoom] = React.useState(roomFromHash);
  const [draftInput, setDraftInput] = React.useState("");
  const [noteInput, setNoteInput] = React.useState("");
  const { name, error: ticketError, refresh } = useRoomTicket();

  React.useEffect(() => {
    const onHash = () => setRoom(roomFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const agent = useAgent<StudioRoomState>({
    agent: AGENT,
    name: room,
    query: async () => {
      // Minted at connect time so an expired ticket is never replayed.
      const t = (await refresh()) ?? "";
      return { t };
    },
    queryDeps: [room],
  });

  const state = agent.state;
  const participants = state?.participants ?? [];
  const entries = state?.entries ?? [];

  const postNote = (e: React.FormEvent) => {
    e.preventDefault();
    const body = noteInput.trim();
    if (!body || !state) return;
    agent.send(
      JSON.stringify({ kind: "note", body })
    );
    setNoteInput("");
  };

  const proposeTool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) return;
    const draft: RoomDraft = {
      tool: draftInput.trim() || "untitled-tool",
      rationale: "Proposed from the studio room.",
      input_schema: JSON.stringify({ type: "object", properties: {} }, null, 2),
    };
    // Writing from the client: the Agent persists this and broadcasts it to
    // everyone in the room, agents included.
    agent.setState({ ...state, draft, revision: state.revision + 1 });
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{state?.title ?? room}</h1>
          <p className="text-sm text-neutral-500">
            <code className="text-xs">/agents/{AGENT}/{room}</code>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <StatusDot connected={agent.readyState === 1} />
          <span className="text-neutral-500">
            rev {state?.revision ?? 0} · {participants.length} here
          </span>
        </div>
      </header>

      {ticketError && (
        <p className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          {ticketError} — you can still join as a guest and read the room.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr_300px]">
        {/* Who is here */}
        <aside className="flex flex-col gap-2">
          <SectionLabel>In this room</SectionLabel>
          <ul className="flex flex-col gap-1">
            {participants.length === 0 && <li className="text-xs text-neutral-600">—</li>}
            {participants.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    p.kind === "agent" ? "bg-violet-400" : "bg-emerald-400"
                  )}
                />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-neutral-600">
                  {p.kind}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
            Signed in as <span className="text-neutral-400">{name}</span>
          </p>
        </aside>

        {/* Shared log */}
        <section className="flex min-h-[420px] flex-col gap-3">
          <SectionLabel>Shared log</SectionLabel>
          <div className="flex-1 overflow-y-auto rounded border border-neutral-800 p-3">
            {entries.length === 0 ? (
              <p className="text-sm text-neutral-600">
                Nothing yet. Write a note — an agent in this room sees it immediately.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={postNote} className="flex gap-2">
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Add a note to the room…"
              className="flex-1 rounded border border-neutral-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-600"
            />
            <button
              type="submit"
              className="rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
            >
              Send
            </button>
          </form>
        </section>

        {/* Shared draft */}
        <aside className="flex flex-col gap-3">
          <SectionLabel>Working draft</SectionLabel>
          {state?.draft ? (
            <div className="rounded border border-violet-500/30 bg-violet-500/5 p-3">
              <p className="font-mono text-sm text-violet-200">{state.draft.tool}</p>
              <p className="mt-2 text-xs text-neutral-500">{state.draft.rationale}</p>
            </div>
          ) : (
            <p className="text-xs text-neutral-600">No draft yet.</p>
          )}

          <form onSubmit={proposeTool} className="flex flex-col gap-2">
            <input
              value={draftInput}
              onChange={(e) => setDraftInput(e.target.value)}
              placeholder="propose a tool…"
              className="rounded border border-neutral-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-600"
            />
            <button
              type="submit"
              className="rounded border border-violet-500/40 px-3 py-2 text-sm hover:bg-violet-500/10"
            >
              Propose into draft
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function EntryRow({ entry }: { entry: RoomEntry }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 text-xs">
        <span className={entry.author_kind === "agent" ? "text-violet-300" : "text-emerald-300"}>
          {entry.author}
        </span>
        {entry.kind !== "note" && (
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
            {entry.kind}
          </span>
        )}
        <span className="ml-auto text-neutral-700">{new Date(entry.at).toLocaleTimeString()}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-neutral-300">{entry.body}</p>
    </li>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">{children}</h2>
  );
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full", connected ? "bg-emerald-400" : "bg-neutral-700")}
      title={connected ? "connected" : "connecting"}
    />
  );
}