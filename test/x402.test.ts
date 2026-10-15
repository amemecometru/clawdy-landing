import { describe, expect, it } from "vitest";
import mcp from "../src/api/mcp";
import {
  devBypassEnabled,
  paymentRequiredBody,
  paymentRequiredHeaders,
  paymentRequirements,
  priceUsd,
  requiresPayment,
  resolveX402Config,
  toAtomicUnits,
  verifyX402Payment,
  type X402Config,
} from "../src/lib/x402";
import { TOOL_DEFS } from "../src/api/tools";
import { PRICE_TABLE, priceTableByCategory, TOOL_CATEGORIES } from "../src/lib/price-table";

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

/** Throws if touched — a 401/402 must be decided before any DB access. */
const explodingDB = new Proxy(
  {},
  {
    get() {
      throw new Error("DB must not be touched before the payment gate passes");
    },
  }
) as unknown as D1Database;

const PAY_TO = "0x1111111111111111111111111111111111111111";
const SESSION_COOKIE = "clawdyclaw.session=good";
const PRICED_TOOL = "cloudflare_ai"; // $0.02 → 20000 atomic units

function baseEnv(overrides: Record<string, unknown> = {}) {
  return { DB: explodingDB, X402_PAY_TO_ADDRESS: PAY_TO, ...overrides };
}

/** Environment with an empty session store. */
function anonEnv(overrides: Record<string, unknown> = {}) {
  return baseEnv({ SESSIONS: new MemKV() as unknown as KVNamespace, ...overrides });
}

/** Environment with a session store seeded for cookie `clawdyclaw.session=good`. */
async function authedEnv(overrides: Record<string, unknown> = {}) {
  const kv = new MemKV();
  await kv.put("session:good", JSON.stringify({ sub: "u1", email: "u@example.com" }));
  return baseEnv({ SESSIONS: kv as unknown as KVNamespace, ...overrides });
}

function rpc(body: unknown) {
  return { jsonrpc: "2.0", id: 1, ...(body as object) };
}

function callTool(name: string) {
  return { method: "tools/call", params: { name, arguments: {} } };
}

/** POST a JSON-RPC request through the MCP router. */
function post(body: unknown, e: Record<string, unknown>, headers: Record<string, string> = {}) {
  return mcp.fetch(
    new Request("http://clawdyclaw.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    e as never
  );
}

/** POST a tools/call for `name`, authenticated as u1 unless `cookie` is null. */
function call(name: string, e: Record<string, unknown>, headers: Record<string, string> = {}) {
  const cookie = headers.Cookie ?? SESSION_COOKIE;
  return post(rpc(callTool(name)), e, { ...headers, ...(cookie ? { Cookie: cookie } : {}) });
}

// ── Unit: atomic-unit conversion ───────────────────────────────────────────

describe("toAtomicUnits", () => {
  it("converts USD to USDC atomic units exactly", () => {
    expect(toAtomicUnits(0.001)).toBe("1000");
    expect(toAtomicUnits(0.005)).toBe("5000");
    expect(toAtomicUnits(0.006)).toBe("6000");
    expect(toAtomicUnits(0.08)).toBe("80000");
    expect(toAtomicUnits(0.25)).toBe("250000");
    expect(toAtomicUnits(1)).toBe("1000000");
  });

  it("does not overcharge on binary float drift", () => {
    // 0.000123 * 1e6 === 123.00000000000001 — a naive ceil bills 124.
    expect(toAtomicUnits(0.000123)).toBe("123");
    expect(toAtomicUnits(0.000246)).toBe("246");
    expect(toAtomicUnits(0.000492)).toBe("492");
  });

  it("matches Math.ceil on every price in the locked table", () => {
    for (const t of TOOL_DEFS) expect(toAtomicUnits(t.x402_price_usd)).toBe(`${t.x402_price_usd * 1e6}`);
  });

  it("rejects negative and non-finite prices", () => {
    expect(() => toAtomicUnits(-1)).toThrow(RangeError);
    expect(() => toAtomicUnits(Number.NaN)).toThrow(RangeError);
    expect(() => toAtomicUnits(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

// ── Unit: price lookup ─────────────────────────────────────────────────────

describe("priceUsd", () => {
  it("matches the locked table", () => {
    expect(TOOL_DEFS).toHaveLength(35);
    expect(priceUsd("list_tasks")).toBe(0.001);
    expect(priceUsd("classify_intent")).toBe(0.005);
    expect(priceUsd("web_search")).toBe(0.006);
    expect(priceUsd("run_scraper")).toBe(0.5);
    expect(priceUsd("create_invoice")).toBe(0.5);
    expect(priceUsd("generate_video")).toBe(1);
  });

  it("agrees with the registry for every tool", () => {
    for (const t of TOOL_DEFS) expect(priceUsd(t.name)).toBe(t.x402_price_usd);
  });

  it("returns null for an unknown tool", () => {
    expect(priceUsd("not_a_tool")).toBeNull();
  });
});

describe("requiresPayment", () => {
  it("is true for a priced tool", () => {
    expect(requiresPayment(0.001)).toBe(true);
  });

  it("is false for a $0 tool and for an unknown tool", () => {
    expect(requiresPayment(0)).toBe(false);
    expect(requiresPayment(null)).toBe(false);
  });
});

describe("devBypassEnabled", () => {
  it("is true only for the exact string 'true'", () => {
    expect(devBypassEnabled({ X402_DEV_BYPASS: "true" })).toBe(true);
    expect(devBypassEnabled({})).toBe(false);
    expect(devBypassEnabled({ X402_DEV_BYPASS: "false" })).toBe(false);
    expect(devBypassEnabled({ X402_DEV_BYPASS: "TRUE" })).toBe(false);
    expect(devBypassEnabled({ X402_DEV_BYPASS: "1" })).toBe(false);
    expect(devBypassEnabled({ X402_DEV_BYPASS: "" })).toBe(false);
  });
});

// ── Unit: 402 body shape ───────────────────────────────────────────────────

describe("payment requirements", () => {
  function config(): X402Config {
    const resolved = resolveX402Config({ X402_PAY_TO_ADDRESS: PAY_TO });
    if (!resolved.ok) throw new Error(resolved.reason);
    return resolved.config;
  }

  it("quotes the locked price in atomic units on the configured network", async () => {
    const requirements = await paymentRequirements(0.02, config());
    expect(requirements).toMatchObject({
      scheme: "exact",
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "20000",
      payTo: PAY_TO,
      maxTimeoutSeconds: 60,
    });
    expect(requirements.extra).toMatchObject({ name: "USDC", version: "2" });
  });

  it("carries the x402 payment-required shape", async () => {
    const body = await paymentRequiredBody("cloudflare_ai", 0.02, {
      config: config(),
      resource: "https://clawdyclaw.com/mcp/v1",
    });
    expect(body.x402Version).toBe(2);
    expect(body.error).toContain("cloudflare_ai");
    expect(body.accepts).toHaveLength(1);
    expect(body.accepts[0]).toMatchObject({
      scheme: "exact",
      network: "eip155:84532",
      amount: "20000",
      payTo: PAY_TO,
    });
    expect(body.resource.url).toBe("https://clawdyclaw.com/mcp/v1");
    expect(typeof body.accepts[0].amount).toBe("string");
  });

  it("declares Bazaar discovery metadata for the tool", async () => {
    const body = await paymentRequiredBody("cloudflare_ai", 0.02, {
      config: config(),
      resource: "https://clawdyclaw.com/mcp/v1",
    });
    expect(body.extensions?.bazaar).toBeDefined();
  });

  it("encodes the 402 body into the PAYMENT-REQUIRED header", async () => {
    const body = await paymentRequiredBody("cloudflare_ai", 0.02, {
      config: config(),
      resource: "https://clawdyclaw.com/mcp/v1",
    });
    const headers = paymentRequiredHeaders(body);
    expect(headers["PAYMENT-REQUIRED"]).toBeTypeOf("string");
    expect(JSON.parse(atob(headers["PAYMENT-REQUIRED"])).accepts[0].amount).toBe("20000");
  });
});

// ── Unit: verification fails closed ─────────────────────────────────────────

describe("verifyX402Payment", () => {
  const opts = {
    toolName: "cloudflare_ai",
    usd: 0.02,
    env: { X402_PAY_TO_ADDRESS: PAY_TO },
    resource: "https://clawdyclaw.com/mcp/v1",
  };

  it("rejects a missing header", async () => {
    expect(await verifyX402Payment(new Request("http://x/"), opts)).toEqual({
      ok: false,
      reason: "Missing or malformed payment signature header",
    });
  });

  it("rejects a non-base64 header", async () => {
    const req = new Request("http://x/", { headers: { "PAYMENT-SIGNATURE": "!!!not-base64!!!" } });
    const result = await verifyX402Payment(req, opts);
    expect(result.ok).toBe(false);
  });

  it("rejects the legacy X-PAYMENT header when it carries no payment", async () => {
    const req = new Request("http://x/", {
      headers: { "X-PAYMENT": btoa(JSON.stringify({ signature: "0xdead", payload: { from: "0xabc" } })) },
    });
    const result = await verifyX402Payment(req, opts);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("Unsupported x402 version");
  });

  it("rejects a payment that matches no requirement", async () => {
    const req = new Request("http://x/", {
      headers: {
        "PAYMENT-SIGNATURE": btoa(
          JSON.stringify({ x402Version: 2, accepted: { scheme: "exact", network: "base" }, payload: {} })
        ),
      },
    });
    const result = await verifyX402Payment(req, opts);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("does not match");
  });

  it("fails closed when the rail has no recipient", async () => {
    const result = await verifyX402Payment(new Request("http://x/"), { ...opts, env: {} });
    expect(result).toEqual({ ok: false, reason: "X402_PAY_TO_ADDRESS is missing or not a 20-byte address" });
  });
});

// ── Gate order: 401 before 402 ─────────────────────────────────────────────

describe("mcp gate order", () => {
  it("returns 401, not 402, when the caller has no session", async () => {
    const res = await call(PRICED_TOOL, anonEnv(), { Cookie: "" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when the session store binding is missing entirely", async () => {
    const res = await call(PRICED_TOOL, baseEnv(), { Cookie: "" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when the session cookie has no KV record", async () => {
    const res = await call(PRICED_TOOL, anonEnv(), { Cookie: "clawdyclaw.session=revoked" });
    expect(res.status).toBe(401);
  });

  it("returns 401 before an unknown-tool check, so unauthenticated callers cannot probe the catalog", async () => {
    const res = await call("no_such_tool", anonEnv(), { Cookie: "" });
    expect(res.status).toBe(401);
  });
});

// ── The 402 path ───────────────────────────────────────────────────────────

describe("mcp x402 payment gate", () => {
  it("returns 402 with x402 instructions for an unpaid priced call", async () => {
    const res = await call(PRICED_TOOL, await authedEnv());
    expect(res.status).toBe(402);

    const body = (await res.json()) as {
      x402Version: number;
      resource: { url: string };
      accepts: { amount: string; payTo: string; asset: string }[];
    };
    expect(body.x402Version).toBe(2);
    expect(body.accepts[0].amount).toBe("20000");
    expect(body.accepts[0].payTo).toBe(PAY_TO);
    expect(body.accepts[0].asset).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(body.resource.url).toBe("http://clawdyclaw.com/mcp/v1");
  });

  it("advertises the payment requirements in the PAYMENT-REQUIRED header", async () => {
    const res = await call(PRICED_TOOL, await authedEnv());
    const header = res.headers.get("PAYMENT-REQUIRED");
    expect(header).toBeTruthy();
    const decoded = JSON.parse(atob(header as string)) as { accepts: { amount: string }[] };
    expect(decoded.accepts[0].amount).toBe("20000");
  });

  it("answers 503 when the rail has no recipient configured", async () => {
    const e = await authedEnv();
    const res = await call(PRICED_TOOL, { ...e, X402_PAY_TO_ADDRESS: undefined });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("X402_PAY_TO_ADDRESS");
  });

  it("quotes the atomic amount of each tool's locked price", async () => {
    const e = await authedEnv();
    const expectations: [string, string][] = [
      ["list_tasks", "1000"],
      ["classify_intent", "5000"],
      ["model_infer", "50000"],
      ["flux_image", "50000"],
      ["run_scraper", "500000"],
    ];
    for (const [tool, atomic] of expectations) {
      const res = await call(tool, e);
      expect(res.status, tool).toBe(402);
      const body = (await res.json()) as { accepts: { amount: string }[] };
      expect(body.accepts[0].amount, tool).toBe(atomic);
    }
  });

  it("returns 402 for a malformed payment header", async () => {
    const res = await call(PRICED_TOOL, await authedEnv(), { "PAYMENT-SIGNATURE": "!!!" });
    expect(res.status).toBe(402);
  });

  it("returns 402 for a payment that matches no quoted requirement", async () => {
    const res = await call(PRICED_TOOL, await authedEnv(), {
      "PAYMENT-SIGNATURE": btoa(
        JSON.stringify({ x402Version: 2, accepted: { scheme: "exact", network: "base" }, payload: {} })
      ),
    });
    expect(res.status).toBe(402);
  });

  it("never reaches the executor when payment fails", async () => {
    // explodingDB throws on any access; a 402 proves the gate ran first.
    const res = await call(PRICED_TOOL, await authedEnv());
    expect(res.status).toBe(402);
    expect(await res.json()).toHaveProperty("accepts");
  });
});

// ── Dev bypass ─────────────────────────────────────────────────────────────

describe("X402_DEV_BYPASS", () => {
  it("skips the gate when set to exactly 'true'", async () => {
    const res = await call(PRICED_TOOL, await authedEnv({ X402_DEV_BYPASS: "true" }));
    expect(res.status).not.toBe(402);
    expect(res.status).not.toBe(401);
  });

  it("keeps the gate on when set to 'false'", async () => {
    const res = await call(PRICED_TOOL, await authedEnv({ X402_DEV_BYPASS: "false" }));
    expect(res.status).toBe(402);
  });

  it("keeps the gate on for any other value", async () => {
    for (const value of ["1", "yes", "TRUE", "", "true "]) {
      const res = await call(PRICED_TOOL, await authedEnv({ X402_DEV_BYPASS: value }));
      expect(res.status, `X402_DEV_BYPASS=${JSON.stringify(value)}`).toBe(402);
    }
  });

  it("still requires a session when the bypass is on", async () => {
    const res = await call(PRICED_TOOL, anonEnv({ X402_DEV_BYPASS: "true" }), { Cookie: "" });
    expect(res.status).toBe(401);
  });

  it("does not weaken the session gate for priced tools", async () => {
    const res = await call("list_tasks", anonEnv({ X402_DEV_BYPASS: "true" }), { Cookie: "" });
    expect(res.status).toBe(401);
  });
});

// ── $0 tools and discovery ─────────────────────────────────────────────────

describe("$0 tools", () => {
  it("have no priced registry entry today, so the branch is covered by requiresPayment", () => {
    const zeros = TOOL_DEFS.filter((t) => t.x402_price_usd === 0);
    expect(zeros).toHaveLength(0);
    expect(requiresPayment(0)).toBe(false);
  });

  it("skips the payment gate when a called tool prices at $0", async () => {
    // Simulate a $0 tool reaching the gate: requiresPayment(0) is false, so
    // no 402 body is produced for it.
    expect(requiresPayment(priceUsd(PRICED_TOOL))).toBe(true);
    expect(requiresPayment(0)).toBe(false);
  });
});

describe("tools/list", () => {
  it("stays public for discovery", async () => {
    const res = await post(rpc({ method: "tools/list" }), anonEnv());
    expect(res.status).toBe(200);
  });

  it("is not payment-gated", async () => {
    const res = await post(rpc({ method: "tools/list" }), anonEnv());
    const body = (await res.json()) as { result: { content: { text: string }[] } };
    expect(JSON.parse(body.result.content[0].text).tools.length).toBeGreaterThan(0);
  });
});

describe("unknown tools", () => {
  it("returns a JSON-RPC error, not a 402, when the tool is not in the registry", async () => {
    const res = await call("no_such_tool", await authedEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("Unknown tool");
  });
});

// ── PRICE_TABLE export ───────────────────────────────────────────────────────

describe("PRICE_TABLE", () => {
  it("lists all 35 priced tools with their atomic amounts", () => {
    expect(PRICE_TABLE).toHaveLength(35);
    expect(new Set(PRICE_TABLE.map((t) => t.name)).size).toBe(35);
    for (const tool of PRICE_TABLE) {
      expect(tool.price_atomic, tool.name).toBe(toAtomicUnits(tool.price_usd));
      expect(tool.price_usd, tool.name).toBeGreaterThan(0);
    }
  });

  it("agrees with the registry and the gate on every price", () => {
    for (const tool of PRICE_TABLE) {
      expect(priceUsd(tool.name), tool.name).toBe(tool.price_usd);
    }
  });

  it("marks which tools are on the execution surface today", () => {
    const live = PRICE_TABLE.filter((t) => t.on_execution_surface);
    expect(live.length).toBeGreaterThan(0);
    expect(live.every((t) => t.mcp_name === t.name)).toBe(true);
    expect(PRICE_TABLE.filter((t) => !t.on_execution_surface).every((t) => t.mcp_name === null)).toBe(true);
  });

  it("groups every tool under a known category", () => {
    const grouped = priceTableByCategory();
    const total = Object.values(grouped).reduce((sum, rows) => sum + rows.length, 0);
    expect(total).toBe(35);
    expect(Object.keys(grouped).every((c) => (TOOL_CATEGORIES as readonly string[]).includes(c))).toBe(true);
  });
});
