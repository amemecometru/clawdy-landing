import { describe, expect, it } from "vitest";
import professionals from "../worker/api/professionals";
import campaigns from "../worker/api/campaigns";

class MemKV {
  map = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

const explodingDB = new Proxy(
  {},
  {
    get() {
      throw new Error("DB must not be touched for unauthenticated requests");
    },
  }
) as unknown as D1Database;

function env(kv: MemKV) {
  return { DB: explodingDB, SESSIONS: kv as unknown as KVNamespace };
}

const routers = [
  ["professionals", professionals],
  ["campaigns", campaigns],
] as const;

describe("professional API auth gate", () => {
  for (const [name, router] of routers) {
    it(`${name} rejects anonymous list requests with 401`, async () => {
      const res = await router.fetch(new Request("http://clawdyclaw.com/"), env(new MemKV()));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it(`${name} rejects a session cookie with no KV record with 401`, async () => {
      const res = await router.fetch(
        new Request("http://clawdyclaw.com/", { headers: { Cookie: "clawdyclaw.session=revoked" } }),
        env(new MemKV())
      );
      expect(res.status).toBe(401);
    });
  }

  it("professionals rejects anonymous writes with 401", async () => {
    const res = await professionals.fetch(
      new Request("http://clawdyclaw.com/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: "Jane" }),
      }),
      env(new MemKV())
    );
    expect(res.status).toBe(401);
  });
});
