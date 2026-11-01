import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import pages from "../worker/api/pages";
import { SCHEMA_SQL, splitStatements } from "../worker/db/schema";
import { PRODUCT_GENERATION_MODEL } from "../worker/api/pages";

class MemD1 {
  private db = new DatabaseSync(":memory:");
  constructor() {
    for (const stmt of splitStatements(SCHEMA_SQL)) this.db.exec(stmt);
  }
  prepare(sql: string) { const db = this.db; let p: unknown[] = [];
    const st = { bind(...v: unknown[]) { p = v; return st; },
      async run() { db.prepare(sql).run(...(p as never[])); return { success: true }; },
      async first() { return db.prepare(sql).get(...(p as never[])) ?? null; },
      async all() { return { results: db.prepare(sql).all(...(p as never[])) }; } };
    return st; }
  async batch(s: { run(): Promise<unknown> }[]) { return Promise.all(s.map((x) => x.run())); }
}

/** Stands in for the AI binding. Records what it was asked and what it cost. */
function fakeAI(reply: unknown, usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, neurons: 1.5 }) {
  const calls: { model: string; gateway?: unknown; input: unknown }[] = [];
  return {
    calls,
    binding: {
      async run(model: string, input: unknown, opts?: { gateway?: unknown }) {
        calls.push({ model, gateway: opts?.gateway, input });
        return { response: typeof reply === "string" ? reply : JSON.stringify(reply), usage };
      },
    } as unknown as Ai,
  };
}

const env = (AI: Ai, kv = {}) =>
  ({ DB: new MemD1(), SESSIONS: { get: async () => null } as never, AI, ...kv }) as never;

const post = (e: unknown, body: unknown) =>
  pages.fetch(new Request("http://x/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), e as never);

describe("brief to spec, through the AI binding", () => {
  it("routes to the named production model via the gateway", async () => {
    const ai = fakeAI({ blocks: [{ type: "hero", title: "From a brief" }], title: "T", brand: "B" });
    await post(env(ai.binding), { kind: "landing", title: "Ignored", brief: "make me a page" });
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0].model).toBe(PRODUCT_GENERATION_MODEL);
    expect(ai.calls[0].gateway).toEqual({ id: "default" });
  });

  it("returns the measured token cost with the order", async () => {
    const ai = fakeAI({ blocks: [{ type: "hero", title: "x" }], title: "T" });
    const res = await post(env(ai.binding), { kind: "landing", title: "T", brief: "b" });
    const body = (await res.json()) as { generation: { model: string; usage: Record<string, number> } };
    expect(body.generation.model).toBe(PRODUCT_GENERATION_MODEL);
    expect(body.generation.usage.total_tokens).toBe(30);
    expect(body.generation.usage.neurons).toBe(1.5);
  });

  it("reports no generation cost when the caller supplied blocks", async () => {
    const ai = fakeAI({ blocks: [] });
    const res = await post(env(ai.binding), { kind: "landing", title: "T", blocks: [{ type: "hero", title: "y" }] });
    const body = (await res.json()) as { generation: unknown };
    expect(body.generation).toBeNull();
    expect(ai.calls).toHaveLength(0);
  });

  it("unwraps JSON that a model fenced or prefixed despite instructions", async () => {
    const ai = fakeAI('```json\n{"blocks":[{"type":"hero","title":"Fenced"}],"title":"F"}\n```');
    const res = await post(env(ai.binding), { kind: "landing", title: "T", brief: "b" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { warnings: string[] };
    expect(body.warnings).toEqual([]);
  });

  it("503s rather than silently rendering a blank page on unusable output", async () => {
    const ai = fakeAI("I could not do that.");
    const res = await post(env(ai.binding), { kind: "landing", title: "T", brief: "b" });
    expect(res.status).toBe(503);
  });

  it("survives the model throwing", async () => {
    const AI = { run: async () => { throw new Error("gateway down"); } } as unknown as Ai;
    const res = await post(env(AI), { kind: "landing", title: "T", brief: "b" });
    expect(res.status).toBe(503);
  });

  it("always asks oauth_client for a consent block", async () => {
    const ai = fakeAI({ blocks: [{ type: "hero", title: "wrong" }], title: "T" });
    await post(env(ai.binding), { kind: "oauth_client", title: "T", brief: "an oauth screen" });
    const prompt = (ai.calls[0].input as { messages: { content: string }[] }).messages[0].content;
    expect(prompt).toContain('type:"consent"');
  });
});
