/**
 * Professionals workflow payment — the four one-time tiers, the Stripe path,
 * the crypto path, and the digital receipt.
 *
 * The data layer runs against real SQLite through a small D1-shaped adapter,
 * and both payment rails are driven by stub transports, so nothing here needs
 * a Stripe account, a funded wallet or a chain.
 */

import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import payment from "../worker/api/professionals-payment";
import {
  isWorkflowTier,
  quoteWorkflow,
  verifyStripeSignature,
  WORKFLOW_TIERS,
  type ProfessionalsPaymentEnv,
} from "../worker/lib/professionals-payment";
import { SCHEMA_SQL } from "../worker/db/schema";

// ── D1-shaped adapter over node:sqlite ───────────────────────────────────────

class MemD1 {
  private db = new DatabaseSync(":memory:");
  constructor() {
    for (const stmt of SCHEMA_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
      this.db.exec(stmt);
    }
  }
  prepare(sql: string) {
    const db = this.db;
    let params: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        params = values;
        return statement;
      },
      async run() {
        db.prepare(sql).run(...(params as never[]));
        return { success: true };
      },
      async first<T>() {
        return (db.prepare(sql).get(...(params as never[])) as T) ?? null;
      },
      async all<T>() {
        return { results: db.prepare(sql).all(...(params as never[])) as T[] };
      },
    };
    return statement;
  }
  async batch(statements: { run: () => Promise<unknown> }[]) {
    for (const s of statements) await s.run();
    return [];
  }
}

// ── Environment ──────────────────────────────────────────────────────────────

const SELLER = "0x1111111111111111111111111111111111111111";
const BUYER = "0x70997970C51812dc3a010C7d01b50e0d17dc79C8";
const SESSION_COOKIE = "clawdyclaw.session=buyer";
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

class MemKV {
  map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.map.set(key, value);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
}

let db: MemD1;
let env: ProfessionalsPaymentEnv;

/** Stripe calls made, and the response to return. */
let stripeCalls: { url: string; body: string; auth: string | null }[] = [];
let stripeResponse: { status: number; body: unknown } = { status: 200, body: { id: "cs_test_1", url: "https://checkout.stripe.test/pay" } };

/** RPC calls made, and the receipt to return. */
let rpcCalls: { method: string; params: unknown[] }[] = [];
let rpcReceipt: unknown = null;

function reset() {
  db = new MemD1();
  const kv = new MemKV();
  kv.map.set("session:buyer", JSON.stringify({ sub: "buyer-1", email: "buyer@example.com" }));
  kv.map.set("session:stranger", JSON.stringify({ sub: "stranger-9", email: "other@example.com" }));
  env = {
    DB: db as unknown as D1Database,
    SESSIONS: kv as unknown as KVNamespace,
    X402_PAY_TO_ADDRESS: SELLER,
    X402_FACILITATOR_URL: "https://x402.org/facilitator",
    X402_RPC_URL: "https://rpc.test",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_test_placeholder",
    RECEIPT_SIGNING_SECRET: "receipt-secret",
    PUBLIC_ORIGIN: "https://clawdyclaw.com",
  };
  stripeCalls = [];
  stripeResponse = { status: 200, body: { id: "cs_test_1", url: "https://checkout.stripe.test/pay" } };
  rpcCalls = [];
  rpcReceipt = null;
}

/** Global fetch stub: Stripe goes to api.stripe.com, chain reads to the RPC. */
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("api.stripe.com")) {
    stripeCalls.push({
      url,
      body: String(init?.body ?? ""),
      auth: new Headers(init?.headers).get("authorization"),
    });
    return new Response(JSON.stringify(stripeResponse.body), {
      status: stripeResponse.status,
      headers: { "content-type": "application/json" },
    });
  }
  if (url.includes("rpc.test")) {
    const body = JSON.parse(String(init?.body ?? "{}")) as { method: string; params: unknown[] };
    rpcCalls.push(body);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: rpcReceipt }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input as never, init);
}) as typeof fetch;

beforeEach(reset);
afterAll(() => {
  globalThis.fetch = realFetch;
});

function call(path: string, init: RequestInit = {}) {
  return payment.fetch(
    new Request(`https://clawdyclaw.com${path}`, {
      ...init,
      headers: { "content-type": "application/json", cookie: SESSION_COOKIE, ...(init.headers ?? {}) },
    }),
    env as never
  );
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return call(path, { method: "POST", body: JSON.stringify(body), headers });
}

/** A receipt log from the buyer to the seller for `amount` atomic units. */
function transferReceipt(amount: string, opts: { from?: string; to?: string; value?: string; status?: string } = {}) {
  const pad = (a: string) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  return {
    status: opts.status ?? "0x1",
    blockNumber: "0x10",
    logs: [
      {
        address: USDC_SEPOLIA,
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          `0x${pad(opts.from ?? BUYER)}`,
          `0x${pad(opts.to ?? SELLER)}`,
        ],
        data: `0x${BigInt(opts.value ?? amount).toString(16).padStart(64, "0")}`,
      },
    ],
  };
}

/** A valid Stripe-Signature header for `body` at `timestamp`. */
async function signStripe(body: string, timestamp: number, secret = "whsec_test_placeholder") {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

// ── Tiers and the crypto rule ────────────────────────────────────────────────

describe("workflow tiers", () => {
  it("prices the four owner-locked tiers", () => {
    expect(quoteWorkflow("t1").price_usd).toBe(320);
    expect(quoteWorkflow("t2").price_usd).toBe(375);
    expect(quoteWorkflow("t3").price_usd).toBe(525);
    expect(quoteWorkflow("t4").price_usd).toBe(900);
  });

  it("is cumulative: every tier adds to the one below it", () => {
    const prices = WORKFLOW_TIERS.map((t) => quoteWorkflow(t).price_usd);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
    expect(quoteWorkflow("t2").includes).toContain("Professional resume");
    expect(quoteWorkflow("t3").includes).toContain("Basic autobiography");
    expect(quoteWorkflow("t4").includes).toContain("Ultimate autobiography with video");
    expect(quoteWorkflow("t4").includes).toContain("Imaging revisions");
  });

  it("raises the price when the domain costs more than the $20 budget", () => {
    expect(quoteWorkflow("t1", { domainCostUsd: 45 }).price_usd).toBe(345);
    expect(quoteWorkflow("t1", { domainCostUsd: 12 }).price_usd).toBe(312);
  });

  it("carries no price threshold into crypto", () => {
    // One crypto flow at every price: the buyer is given the address and the
    // exact amount, and the receipt follows the payment.
    for (const tier of WORKFLOW_TIERS) {
      expect(Object.keys(quoteWorkflow(tier)).sort()).toEqual([
        "components",
        "includes",
        "price_cents",
        "price_usd",
        "tier",
      ]);
    }
  });

  it("rejects unknown tiers", () => {
    expect(isWorkflowTier("t3")).toBe(true);
    expect(isWorkflowTier("t5")).toBe(false);
    expect(isWorkflowTier(3)).toBe(false);
  });
});

describe("GET /tiers", () => {
  it("lists every tier with its price and the crypto rule", async () => {
    const res = await call("/tiers");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tiers: { tier: string; price_usd: number; one_time: boolean; subscription: boolean }[];
    };
    expect(body.tiers).toHaveLength(4);
    expect(body.tiers.map((t) => t.tier)).toEqual(["t1", "t2", "t3", "t4"]);
    expect(body.tiers.map((t) => t.price_usd)).toEqual([320, 375, 525, 900]);
    expect(body.tiers.every((t) => t.one_time && !t.subscription)).toBe(true);
    expect(Object.keys(body)).toEqual(["tiers"]);
  });

  it("is readable without a session — a buyer needs the price list first", async () => {
    const res = await payment.fetch(
      new Request("https://clawdyclaw.com/tiers"),
      env as never
    );
    expect(res.status).toBe(200);
  });
});

// ── Stripe path ──────────────────────────────────────────────────────────────

describe("stripe checkout", () => {
  it("opens a one-time payment session at the tier price", async () => {
    const res = await post("/checkout", { tier: "t2", method: "stripe" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      checkout: { tier: string; price_usd: number; status: string; method: string };
      stripe: { session_id: string; url: string };
    };

    expect(body.checkout.tier).toBe("t2");
    expect(body.checkout.price_usd).toBe(375);
    expect(body.checkout.status).toBe("pending");
    expect(body.stripe.session_id).toBe("cs_test_1");

    expect(stripeCalls).toHaveLength(1);
    expect(stripeCalls[0].auth).toBe("Bearer sk_test_placeholder");
    const form = new URLSearchParams(stripeCalls[0].body);
    expect(form.get("mode")).toBe("payment");
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("37500");
    expect(form.get("line_items[0][quantity]")).toBe("1");
    // No subscription anywhere in the session.
    expect(form.get("line_items[0][price_data][recurring[interval]")).toBeNull();
    expect(form.get("mode")).not.toBe("subscription");
  });

  it("never sends the Stripe key to the client", async () => {
    const res = await post("/checkout", { tier: "t1" });
    expect(await res.text()).not.toContain("sk_test_placeholder");
  });

  it("reports a Stripe failure without leaving a delivered tier", async () => {
    stripeResponse = { status: 402, body: { error: { message: "Card declined at session creation" } } };
    const res = await post("/checkout", { tier: "t1" });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Card declined");
    expect((await call("/entitlement")).status).toBe(200);
    const entitlement = (await (await call("/entitlement")).json()) as { entitled: boolean };
    expect(entitlement.entitled).toBe(false);
  });

  it("delivers the tier and issues a receipt when the webhook settles", async () => {
    const created = (await (await post("/checkout", { tier: "t3" })).json()) as { checkout: { id: string } };
    const event = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1", client_reference_id: created.checkout.id, payment_status: "paid" } },
    });
    const now = Math.floor(Date.now() / 1000);
    const res = await call("/stripe/webhook", {
      method: "POST",
      body: event,
      headers: { "stripe-signature": await signStripe(event, now) },
    });
    expect(res.status).toBe(200);

    const view = (await (await call(`/checkout/${created.checkout.id}`)).json()) as {
      checkout: {
        status: string;
        tier: string;
        paid_at: number | null;
        receipt: { body: string; signature: string } | null;
      };
    };
    expect(view.checkout.status).toBe("paid");
    expect(view.checkout.paid_at).toBeGreaterThan(0);
    expect(view.checkout.receipt).toBeTruthy();

    const receipt = JSON.parse(view.checkout.receipt!.body) as { tier: string; price_usd: number };
    expect(receipt.tier).toBe("t3");
    expect(receipt.price_usd).toBe(525);

    const verify = (await (await call(`/receipt/${created.checkout.id}/verify`)).json()) as {
      valid: boolean;
    };
    expect(verify.valid).toBe(true);

    const entitlement = (await (await call("/entitlement")).json()) as {
      entitled: boolean;
      tier: string;
      includes: string[];
    };
    expect(entitlement.entitled).toBe(true);
    expect(entitlement.tier).toBe("t3");
    expect(entitlement.includes).toContain("Basic autobiography");
  });

  it("rejects a webhook with a bad signature and delivers nothing", async () => {
    const created = (await (await post("/checkout", { tier: "t4" })).json()) as { checkout: { id: string } };
    const event = JSON.stringify({
      id: "evt_2",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1", client_reference_id: created.checkout.id } },
    });
    const now = Math.floor(Date.now() / 1000);
    const forged = await signStripe(event, now, "whsec_wrong_secret");
    const res = await call("/stripe/webhook", {
      method: "POST",
      body: event,
      headers: { "stripe-signature": forged },
    });
    expect(res.status).toBe(400);

    const view = (await (await call(`/checkout/${created.checkout.id}`)).json()) as {
      checkout: { status: string };
    };
    expect(view.checkout.status).toBe("pending");
  });

  it("rejects a replayed webhook as already delivered", async () => {
    const created = (await (await post("/checkout", { tier: "t1" })).json()) as { checkout: { id: string } };
    const event = JSON.stringify({
      id: "evt_3",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1", client_reference_id: created.checkout.id } },
    });
    const now = Math.floor(Date.now() / 1000);
    const headers = { "stripe-signature": await signStripe(event, now) };
    const body = { method: "POST", body: event, headers } as const;

    expect((await call("/stripe/webhook", body)).status).toBe(200);
    const second = (await (await call("/stripe/webhook", body)).json()) as { already_paid?: boolean };
    expect(second.already_paid).toBe(true);

    const receipts = db.prepare("SELECT COUNT(*) AS n FROM professionals_receipts").first<{ n: number }>();
    expect((await receipts)?.n).toBe(1);
  });

  it("rejects a stale signature", async () => {
    const event = JSON.stringify({ id: "evt_4", type: "checkout.session.completed", data: { object: {} } });
    const stale = Math.floor(Date.now() / 1000) - 4000;
    const res = await call("/stripe/webhook", {
      method: "POST",
      body: event,
      headers: { "stripe-signature": await signStripe(event, stale) },
    });
    expect(res.status).toBe(400);
  });
});

describe("verifyStripeSignature", () => {
  it("accepts a correct, fresh signature and rejects every other case", async () => {
    const body = JSON.stringify({ hello: "world" });
    const now = Math.floor(Date.now() / 1000);
    const SECRET = "whsec_unit_test";
    expect(await verifyStripeSignature(body, await signStripe(body, now, SECRET), SECRET, now)).toBe(true);
    expect(await verifyStripeSignature(body, await signStripe(body, now, "other"), SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body + " ", await signStripe(body, now, SECRET), SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, "t=1,v1=deadbeef", SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, null, SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, await signStripe(body, now, SECRET), undefined, now)).toBe(false);
    // Older than the tolerance window.
    expect(
      await verifyStripeSignature(body, await signStripe(body, now - 4000, SECRET), SECRET, now)
    ).toBe(false);
  });
});

// ── Crypto path ──────────────────────────────────────────────────────────────

describe("crypto checkout", () => {
  it("gives the same flow at every price: address, exact amount, no invoice step", async () => {
    for (const [tier, atomic] of [
      ["t1", "320000000"],
      ["t2", "375000000"],
      ["t3", "525000000"],
      ["t4", "900000000"],
    ] as const) {
      const res = await post("/checkout", { tier, method: "crypto", wallet: BUYER });
      expect(res.status, tier).toBe(200);
      const body = (await res.json()) as {
        checkout: { network: string; asset: string; amount_atomic: string; pay_to: string; status: string };
        invoice?: unknown;
        instructions: { amount_atomic: string; pay_to: string; symbol: string; expires_at: number };
      };
      // No threshold, no invoice, no mode: one shape of instructions.
      expect(body.invoice, tier).toBeUndefined();
      expect(body.instructions.amount_atomic, tier).toBe(atomic);
      expect(body.checkout.network, tier).toBe("eip155:84532");
      expect(body.checkout.asset.toLowerCase(), tier).toBe(USDC_SEPOLIA.toLowerCase());
      expect(body.checkout.pay_to, tier).toBe(SELLER);
      expect(body.instructions.expires_at, tier).toBeGreaterThan(0);
      expect(body.checkout.status, tier).toBe("pending");
    }
  });

  it("refuses a crypto checkout without a wallet", async () => {
    const res = await post("/checkout", { tier: "t1", method: "crypto" });
    expect(res.status).toBe(400);
  });

  it("settles when the exact amount arrives from the buyer", async () => {
    const created = (await (
      await post("/checkout", { tier: "t1", method: "crypto", wallet: BUYER })
    ).json()) as { checkout: { id: string; amount_atomic: string } };
    rpcReceipt = transferReceipt(created.checkout.amount_atomic);

    const res = await post(`/checkout/${created.checkout.id}/crypto`, { tx_hash: `0x${"ab".repeat(32)}` });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      checkout: { status: string; receipt: { body: string } | null };
      payment: { amount_atomic: string; block: number };
    };
    expect(body.checkout.status).toBe("paid");
    expect(body.payment.amount_atomic).toBe("320000000");
    expect(body.payment.block).toBe(16);
    expect(JSON.parse(body.checkout.receipt!.body).method).toBe("crypto");
  });

  it("rejects a transfer of the wrong amount, the wrong sender or a revert", async () => {
    const created = (await (
      await post("/checkout", { tier: "t2", method: "crypto", wallet: BUYER })
    ).json()) as { checkout: { id: string; amount_atomic: string } };
    const id = created.checkout.id;
    const tx = { tx_hash: `0x${"cd".repeat(32)}` };

    rpcReceipt = transferReceipt("1");
    expect((await post(`/checkout/${id}/crypto`, tx)).status).toBe(402);

    rpcReceipt = transferReceipt(created.checkout.amount_atomic, {
      from: "0x2222222222222222222222222222222222222222",
    });
    expect((await post(`/checkout/${id}/crypto`, tx)).status).toBe(402);

    rpcReceipt = transferReceipt(created.checkout.amount_atomic, {
      to: "0x3333333333333333333333333333333333333333",
    });
    expect((await post(`/checkout/${id}/crypto`, tx)).status).toBe(402);

    rpcReceipt = transferReceipt(created.checkout.amount_atomic, { status: "0x0" });
    expect((await post(`/checkout/${id}/crypto`, tx)).status).toBe(402);

    rpcReceipt = null;
    expect((await post(`/checkout/${id}/crypto`, tx)).status).toBe(402);

    // Nothing was delivered by any of those attempts.
    const view = (await (await call(`/checkout/${id}`)).json()) as { checkout: { status: string } };
    expect(view.checkout.status).toBe("pending");
  });

  it("does not deliver the same payment twice", async () => {
    const created = (await (
      await post("/checkout", { tier: "t1", method: "crypto", wallet: BUYER })
    ).json()) as { checkout: { id: string; amount_atomic: string } };
    rpcReceipt = transferReceipt(created.checkout.amount_atomic);
    const tx = { tx_hash: `0x${"ef".repeat(32)}` };

    expect((await post(`/checkout/${created.checkout.id}/crypto`, tx)).status).toBe(200);
    expect((await post(`/checkout/${created.checkout.id}/crypto`, tx)).status).toBe(409);

    const receipts = await db.prepare("SELECT COUNT(*) AS n FROM professionals_receipts").first<{ n: number }>();
    expect(receipts?.n).toBe(1);
  });

  it("refuses to confirm a crypto payment when no chain reader is configured", async () => {
    const created = (await (
      await post("/checkout", { tier: "t1", method: "crypto", wallet: BUYER })
    ).json()) as { checkout: { id: string } };
    const noRpc = { ...env, X402_RPC_URL: undefined, BASE_RPC_URL: undefined };
    const res = await payment.fetch(
      new Request(
        `https://clawdyclaw.com/checkout/${created.checkout.id}/crypto`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: SESSION_COOKIE },
          body: JSON.stringify({ tx_hash: `0x${"11".repeat(32)}` }),
        }
      ),
      noRpc as never
    );
    expect(res.status).toBe(402);
    expect(((await res.json()) as { error: string }).error).toContain("RPC");
  });
});

// ── Ownership and listing ────────────────────────────────────────────────────

describe("checkout ownership", () => {
  it("does not expose another buyer's checkout", async () => {
    const created = (await (await post("/checkout", { tier: "t1" })).json()) as { checkout: { id: string } };
    const res = await call(`/checkout/${created.checkout.id}`, { headers: { cookie: "clawdyclaw.session=stranger" } });
    expect(res.status).toBe(404);
  });

  it("requires a session to open a checkout", async () => {
    const res = await payment.fetch(
      new Request("https://clawdyclaw.com/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier: "t1" }),
      }),
      env as never
    );
    expect(res.status).toBe(401);
  });

  it("lists this buyer's checkouts", async () => {
    await post("/checkout", { tier: "t1", method: "crypto", wallet: BUYER });
    await post("/checkout", { tier: "t2" });
    const res = await call("/checkout");
    const body = (await res.json()) as { checkouts: { tier: string }[] };
    expect(body.checkouts).toHaveLength(2);
  });
});
