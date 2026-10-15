/**
 * x402 settlement — verification against a facilitator, gateway payment
 * context, idempotent replay, and network gating.
 *
 * The facilitator here is a local stub on 127.0.0.1 that recovers the EIP-3009
 * signature with viem, so a payment only verifies when it was really signed by
 * the payer's key for the quoted asset, amount, recipient and chain.
 */

import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { recoverTypedDataAddress } from "viem";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import mcp from "../src/api/mcp";
import {
  createIdempotencyStore,
  lookupIdempotent,
  paramsFingerprint,
  paymentRequiredBody,
  paymentRequirements,
  resolveX402Config,
  verifyPaymentContext,
  verifyX402Payment,
  withX402Client,
  type X402Config,
  type X402Env,
} from "../src/lib/x402";
import { TOOL_DEFS } from "../src/api/tools";

// ── Facilitator stub ─────────────────────────────────────────────────────────

const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const CHAIN_ID = 84532;
const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

/** Counts of what the facilitator was asked to do, for replay assertions. */
const facilitatorCalls = { verify: 0, settle: 0 };

/** When set, the facilitator rejects every payment with this reason. */
let forceInvalid: string | null = null;

/**
 * Nonces the chain has already spent. A real facilitator refuses to verify or
 * settle an authorization whose nonce was consumed by an earlier settlement,
 * which is what makes a blind retry safe rather than a double charge.
 */
const spentNonces = new Set<string>();

/** The payment header of the last request that reached the router. */
let capturedPayment: string | null = null;

interface FacilitatorBody {
  paymentPayload: { payload: { authorization: Record<string, string>; signature: string } };
  paymentRequirements: {
    amount: string;
    asset: string;
    payTo: string;
    network: string;
    extra?: Record<string, unknown>;
  };
}

/**
 * Check an EIP-3009 authorization the way a facilitator does: recover the
 * signer and confirm the authorization names this payer, recipient, amount,
 * asset and a live validity window.
 */
async function checkPayment(body: FacilitatorBody): Promise<{ isValid: boolean; invalidReason?: string; payer?: string }> {
  if (forceInvalid) return { isValid: false, invalidReason: forceInvalid };

  const signed = body?.paymentPayload?.payload;
  const auth = signed?.authorization;
  if (!signed?.signature || !auth?.from) return { isValid: false, invalidReason: "malformed_authorization" };
  if (spentNonces.has(auth.nonce)) return { isValid: false, invalidReason: "authorization_already_used" };

  const requirements = body.paymentRequirements;
  let signer: string;
  try {
    signer = await recoverTypedDataAddress({
      domain: {
        name: requirements.extra?.name as string,
        version: requirements.extra?.version as string,
        chainId: CHAIN_ID,
        verifyingContract: requirements.asset as `0x${string}`,
      },
      types: EIP3009_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from: auth.from,
        to: auth.to,
        value: BigInt(auth.value),
        validAfter: BigInt(auth.validAfter),
        validBefore: BigInt(auth.validBefore),
        nonce: auth.nonce as `0x${string}`,
      },
      signature: signed.signature as `0x${string}`,
    });
  } catch {
    return { isValid: false, invalidReason: "signature_recovery_failed" };
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (signer.toLowerCase() !== auth.from.toLowerCase()) {
    return { isValid: false, invalidReason: "wrong_signer" };
  }
  if (auth.to.toLowerCase() !== String(requirements.payTo).toLowerCase()) {
    return { isValid: false, invalidReason: "wrong_recipient" };
  }
  if (BigInt(auth.value) !== BigInt(requirements.amount)) {
    return { isValid: false, invalidReason: "wrong_amount" };
  }
  if (BigInt(auth.validBefore) <= now || BigInt(auth.validAfter) > now) {
    return { isValid: false, invalidReason: "authorization_expired" };
  }
  return { isValid: true, payer: signer };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let server: Server;
let facilitatorUrl = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", async () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};
      let out: Response;
      if (req.url === "/verify") {
        facilitatorCalls.verify++;
        out = json(await checkPayment(body));
      } else if (req.url === "/settle") {
        facilitatorCalls.settle++;
        const checked = await checkPayment(body);
        if (checked.isValid) spentNonces.add(body.paymentPayload.payload.authorization.nonce);
        out = checked.isValid
          ? json({
              success: true,
              transaction: `0xsettled${String(facilitatorCalls.settle).padStart(4, "0")}`,
              network: body?.paymentRequirements?.network,
              payer: checked.payer,
            })
          : json({
              success: false,
              errorReason: checked.invalidReason ?? "verification_failed",
              transaction: "",
              network: body?.paymentRequirements?.network,
            });
      } else if (req.url === "/supported") {
        out = json({
          kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:84532" }],
          extensions: [],
          signers: {},
        });
      } else {
        out = json({ error: "not found" }, 404);
      }
      res.writeHead(out.status, { "content-type": "application/json" });
      res.end(await out.text());
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  facilitatorUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  facilitatorCalls.verify = 0;
  facilitatorCalls.settle = 0;
  forceInvalid = null;
  capturedPayment = null;
  spentNonces.clear();
});

// ── Environment helpers ──────────────────────────────────────────────────────

const PAY_TO = "0x1111111111111111111111111111111111111111";
const SESSION_COOKIE = "clawdyclaw.session=good";
const BUYER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

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

/** Seller environment: a signed-in session plus the stub facilitator. */
async function sellerEnv(overrides: Record<string, unknown> = {}) {
  const kv = new MemKV();
  await kv.put("session:good", JSON.stringify({ sub: "u1", email: "u@example.com" }));
  return {
    DB: {} as D1Database,
    SESSIONS: kv as unknown as KVNamespace,
    X402_PAY_TO_ADDRESS: PAY_TO,
    X402_FACILITATOR_URL: facilitatorUrl,
    ...overrides,
  };
}

function buyerEnv(overrides: Record<string, unknown> = {}): X402Env {
  return { X402_BUYER_PRIVATE_KEY: BUYER_KEY, X402_FACILITATOR_URL: facilitatorUrl, ...overrides };
}

/** A fetch that routes straight into the MCP router, capturing payments. */
function routerFetch(env: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(
      input instanceof Request ? input : new URL(String(input)),
      input instanceof Request ? init : init
    );
    capturedPayment = request.headers.get("payment-signature");
    const url = new URL(request.url);
    url.pathname = "/";
    return mcp.fetch(new Request(url.toString(), request), env as never);
  }) as typeof fetch;
}

/** Call a tool through the router as the buyer, paying any 402 it answers. */
function buyToolCall(
  env: Record<string, unknown>,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  return withX402Client(
    { env: buyerEnv(), confirm: () => true, fetch: routerFetch(env), maxAmountUsd: "$5" },
    async (ctx) => ({
      response: await ctx.fetch("http://clawdyclaw.com/", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: SESSION_COOKIE, ...headers },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", ...body }),
      }),
      paidCount: ctx.paid.length,
    })
  );
}

/** A read-only tool call that needs no platform bindings. */
function classifyCall(args: Record<string, unknown> = { intent: "pay an invoice" }) {
  return { params: { name: "classify_intent", arguments: args } };
}

/** Sign a 402 quote locally with the buyer key, without sending it anywhere. */
async function signQuote(quote: unknown) {
  const { x402Client, x402HTTPClient } = await import("@x402/core/client");
  const { registerExactEvmScheme } = await import("@x402/evm/exact/client");
  const { privateKeyToAccount } = await import("viem/accounts");
  const client = x402Client.fromConfig({ schemes: [], spendControls: { maxAmountPerPayment: "$5" } });
  registerExactEvmScheme(client, {
    signer: privateKeyToAccount(BUYER_KEY),
    networks: ["eip155:84532"],
  });
  return new x402HTTPClient(client).createPaymentPayload(quote as never);
}

function testConfig(overrides: Partial<X402Config> = {}): X402Config {
  const resolved = resolveX402Config({
    X402_PAY_TO_ADDRESS: PAY_TO,
    X402_FACILITATOR_URL: facilitatorUrl,
  });
  if (!resolved.ok) throw new Error(resolved.reason);
  return { ...resolved.config, ...overrides };
}

// ── Price math still agrees with the registry ────────────────────────────────

describe("payment requirements", () => {
  it("quotes every locked price as the exact atomic amount", async () => {
    const config = testConfig();
    for (const tool of TOOL_DEFS) {
      const req = await paymentRequirements(tool.x402_price_usd, config);
      expect(req.amount, tool.name).toBe(String(tool.x402_price_usd * 1e6));
      expect(req.asset, tool.name).toBe(USDC_SEPOLIA);
      expect(req.network, tool.name).toBe("eip155:84532");
      expect(req.payTo, tool.name).toBe(PAY_TO);
      expect(req.scheme, tool.name).toBe("exact");
    }
  });

  it("carries the EIP-712 domain the payer signs against", async () => {
    const req = await paymentRequirements(0.02, testConfig());
    expect(req.extra).toMatchObject({ name: "USDC", version: "2" });
  });
});

// ── Network selection ────────────────────────────────────────────────────────

describe("network selection", () => {
  it("defaults to base-sepolia", () => {
    const resolved = resolveX402Config({ X402_PAY_TO_ADDRESS: PAY_TO });
    expect(resolved.ok && resolved.config.network).toBe("eip155:84532");
    expect(resolved.ok && resolved.config.mainnet).toBe(false);
    expect(resolved.ok && resolved.config.asset).toBe(USDC_SEPOLIA);
  });

  it("switches to base only with X402_MAINNET=true", () => {
    const gated = resolveX402Config({ X402_PAY_TO_ADDRESS: PAY_TO, X402_NETWORK: "base" });
    expect(gated).toEqual({ ok: false, reason: "X402_NETWORK=base requires X402_MAINNET=true" });

    const live = resolveX402Config({
      X402_PAY_TO_ADDRESS: PAY_TO,
      X402_NETWORK: "base",
      X402_MAINNET: "true",
    });
    expect(live.ok && live.config.network).toBe("eip155:8453");
    expect(live.ok && live.config.mainnet).toBe(true);
    expect(live.ok && live.config.asset).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });

  it("keeps X402_MAINNET=false on testnet", () => {
    expect(
      resolveX402Config({ X402_PAY_TO_ADDRESS: PAY_TO, X402_NETWORK: "base", X402_MAINNET: "false" }).ok
    ).toBe(false);
    expect(
      resolveX402Config({ X402_PAY_TO_ADDRESS: PAY_TO, X402_MAINNET: "1" }).ok
    ).toBe(true);
  });

  it("fails closed on an unknown network", () => {
    expect(resolveX402Config({ X402_PAY_TO_ADDRESS: PAY_TO, X402_NETWORK: "polygon" }).ok).toBe(false);
  });

  it("fails closed without a pay-to address", () => {
    expect(resolveX402Config({}).ok).toBe(false);
    expect(resolveX402Config({ X402_PAY_TO_ADDRESS: "0x123" }).ok).toBe(false);
  });

  it("fails closed on a bad facilitator timeout", () => {
    expect(
      resolveX402Config({ X402_PAY_TO_ADDRESS: PAY_TO, X402_FACILITATOR_TIMEOUT_MS: "soon" }).ok
    ).toBe(false);
  });
});

// ── Verification ─────────────────────────────────────────────────────────────

const VERIFY_OPTS = {
  toolName: "classify_intent",
  usd: 0.005,
  resource: "http://clawdyclaw.com/mcp/v1",
};

describe("verifyX402Payment", () => {
  it("rejects a request with no payment", async () => {
    const result = await verifyX402Payment(new Request("http://x/"), {
      ...VERIFY_OPTS,
      env: { X402_PAY_TO_ADDRESS: PAY_TO, X402_FACILITATOR_URL: facilitatorUrl },
    });
    expect(result).toEqual({ ok: false, reason: "Missing or malformed payment signature header" });
  });

  it("rejects a malformed payment header", async () => {
    const req = new Request("http://x/", { headers: { "PAYMENT-SIGNATURE": "!!!not-base64!!!" } });
    const result = await verifyX402Payment(req, {
      ...VERIFY_OPTS,
      env: { X402_PAY_TO_ADDRESS: PAY_TO, X402_FACILITATOR_URL: facilitatorUrl },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a payment from an unsupported protocol version", async () => {
    const req = new Request("http://x/", {
      headers: { "PAYMENT-SIGNATURE": btoa(JSON.stringify({ x402Version: 1, payload: {} })) },
    });
    const result = await verifyX402Payment(req, {
      ...VERIFY_OPTS,
      env: { X402_PAY_TO_ADDRESS: PAY_TO, X402_FACILITATOR_URL: facilitatorUrl },
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("Unsupported x402 version");
  });

  it("accepts a signed payment and settles the call it paid for", async () => {
    const env = await sellerEnv();
    const { response, paidCount } = await buyToolCall(env, classifyCall());

    expect(paidCount).toBe(1);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      result: { content: { text: string }[]; _meta?: Record<string, unknown> };
    };
    expect(JSON.parse(body.result.content[0].text)).toHaveProperty("intent");
    const settlement = body.result._meta?.["x402/payment-response"] as { success: boolean; transaction: string };
    expect(settlement.success).toBe(true);
    expect(settlement.transaction).toMatch(/^0x/);
    expect(facilitatorCalls.verify).toBe(1);
    expect(facilitatorCalls.settle).toBe(1);
  });

  it("does not execute or settle when the facilitator rejects the payment", async () => {
    forceInvalid = "insufficient_funds";
    const env = await sellerEnv();
    const { response } = await buyToolCall(env, classifyCall());

    expect(response.status).toBe(402);
    expect(facilitatorCalls.settle).toBe(0);
    const body = (await response.json()) as { accepts?: unknown[] };
    expect(body.accepts).toBeDefined();
  });

  it("rejects a payment signed for a different amount without calling the facilitator", async () => {
    const env = await sellerEnv();
    await buyToolCall(env, classifyCall());
    const signed = capturedPayment;
    expect(signed).toBeTruthy();

    const before = facilitatorCalls.verify;
    for (const mutate of [
      (p: any) => (p.accepted.amount = "1"),
      (p: any) => (p.accepted.asset = "0x0000000000000000000000000000000000000001"),
      (p: any) => (p.accepted.payTo = "0x2222222222222222222222222222222222222222"),
      (p: any) => (p.accepted.network = "eip155:8453"),
    ]) {
      const payload = JSON.parse(atob(signed as string));
      mutate(payload);
      const result = await verifyX402Payment(
        new Request("http://x/", {
          headers: { "PAYMENT-SIGNATURE": btoa(JSON.stringify(payload)) },
        }),
        { ...VERIFY_OPTS, env: { X402_PAY_TO_ADDRESS: PAY_TO, X402_FACILITATOR_URL: facilitatorUrl } }
      );
      expect(result.ok).toBe(false);
    }
    expect(facilitatorCalls.verify).toBe(before);
  });

  it("rejects a tampered signature", async () => {
    const env = await sellerEnv();
    await buyToolCall(env, classifyCall());
    const payload = JSON.parse(atob(capturedPayment as string));
    payload.payload.signature = `0x${"11".repeat(65)}`;

    const before = facilitatorCalls.verify;
    const result = await verifyX402Payment(
      new Request("http://x/", {
        headers: { "PAYMENT-SIGNATURE": btoa(JSON.stringify(payload)) },
      }),
      { ...VERIFY_OPTS, env: { X402_PAY_TO_ADDRESS: PAY_TO, X402_FACILITATOR_URL: facilitatorUrl } }
    );
    expect(result.ok).toBe(false);
    expect(facilitatorCalls.verify).toBe(before + 1);
    expect(result.ok === false && result.reason).toContain("Facilitator rejected");
  });

  it("fails closed when the rail is misconfigured", async () => {
    const result = await verifyX402Payment(new Request("http://x/"), {
      ...VERIFY_OPTS,
      env: { X402_FACILITATOR_URL: facilitatorUrl },
    });
    expect(result.ok).toBe(false);
  });
});

// ── PAYMENT-CONTEXT (Monetization Gateway) ────────────────────────────────────

describe("verifyPaymentContext", () => {
  let privateKey: CryptoKey;
  let publicJwk: JWK;

  beforeAll(async () => {
    const pair = await generateKeyPair("EdDSA");
    privateKey = pair.privateKey;
    publicJwk = await exportJWK(pair.publicKey);
  });

  const getKey = (async () => importJWK(publicJwk, "EdDSA")) as never;
  const ISSUER = "https://payments.cloudflare.com";
  const AUDIENCE = "https://clawdyclaw.com/mcp/v1";
  const OPTS = { audience: AUDIENCE, amount: "20000", scheme: "exact" };

  async function mint(claims: Record<string, unknown>, issuer = ISSUER, expiresIn = "2m") {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "EdDSA" })
      .setIssuedAt()
      .setIssuer(issuer)
      .setExpirationTime(expiresIn)
      .sign(privateKey);
  }

  it("accepts a valid context", async () => {
    const token = await mint({
      aud: AUDIENCE,
      scheme: "exact",
      amount: "20000",
      nbf: Math.floor(Date.now() / 1000),
    });
    const result = await verifyPaymentContext(token, { ...OPTS, getKey });
    expect(result.ok).toBe(true);
  });

  it("rejects an expired context", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ aud: AUDIENCE, scheme: "exact", amount: "20000" })
      .setProtectedHeader({ alg: "EdDSA" })
      .setIssuedAt(now - 600)
      .setIssuer(ISSUER)
      .setExpirationTime(now - 300)
      .sign(privateKey);
    const result = await verifyPaymentContext(token, { ...OPTS, getKey });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("PAYMENT-CONTEXT rejected");
  });

  it("rejects a context from another issuer", async () => {
    const token = await mint({ aud: AUDIENCE, scheme: "exact", amount: "20000" }, "https://evil.example");
    expect((await verifyPaymentContext(token, { ...OPTS, getKey })).ok).toBe(false);
  });

  it("rejects a context minted for another audience or amount", async () => {
    const wrongAudience = await mint({ aud: "https://other.example/tool", scheme: "exact", amount: "20000" });
    expect((await verifyPaymentContext(wrongAudience, { ...OPTS, getKey })).ok).toBe(false);

    const wrongAmount = await mint({ aud: AUDIENCE, scheme: "exact", amount: "1" });
    expect((await verifyPaymentContext(wrongAmount, { ...OPTS, getKey })).ok).toBe(false);

    const wrongScheme = await mint({ aud: AUDIENCE, scheme: "upto", amount: "20000" });
    expect((await verifyPaymentContext(wrongScheme, { ...OPTS, getKey })).ok).toBe(false);
  });

  it("rejects a missing context", async () => {
    expect((await verifyPaymentContext(null, { ...OPTS, getKey })).ok).toBe(false);
  });

  it("blocks a gateway-fronted call whose context does not verify", async () => {
    const env = await sellerEnv();
    const context = await mint({ aud: "https://other.example", scheme: "exact", amount: "20000" });
    const { response } = await buyToolCall(env, classifyCall(), { "payment-context": context });
    expect(response.status).toBe(402);
    expect(facilitatorCalls.settle).toBe(0);
  });
});

// ── Idempotency ──────────────────────────────────────────────────────────────

describe("idempotent replay", () => {
  it("serves the original result without executing or charging twice", async () => {
    const env = await sellerEnv();
    const answered = await withX402Client(
      { env: buyerEnv(), confirm: () => true, fetch: routerFetch(env), maxAmountUsd: "$5" },
      async (ctx) => {
        const send = () =>
          ctx.fetch("http://clawdyclaw.com/", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: SESSION_COOKIE,
              "idempotency-key": "key-1",
            },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", ...classifyCall() }),
          });
        return { first: await send(), second: await send() };
      }
    );

    expect(answered.first.status).toBe(200);
    expect(answered.second.status).toBe(200);
    // Verified and settled once; the retry is served from the record.
    expect(facilitatorCalls.settle).toBe(1);
    expect(await answered.first.text()).toBe(await answered.second.text());
    expect(answered.second.headers.get("x402-idempotent-replay")).toBe("true");
    expect(answered.second.headers.get("x402-settlement-transaction")).toMatch(/^0x/);
  });

  it("still charges each call when no idempotency key is sent", async () => {
    const env = await sellerEnv();
    await buyToolCall(env, classifyCall());
    await buyToolCall(env, classifyCall());
    expect(facilitatorCalls.settle).toBe(2);
  });

  it("flags a key reused with different arguments", async () => {
    const store = createIdempotencyStore({});
    await store.put("k", {
      tool: "t",
      fingerprint: paramsFingerprint("t", { a: 1 }),
      result: "{}",
      settlement: { success: true, transaction: "0x1", network: "eip155:84532" },
      createdAt: Date.now(),
    });
    expect((await lookupIdempotent(store, "k", paramsFingerprint("t", { a: 1 }))).status).toBe("replay");
    expect((await lookupIdempotent(store, "k", paramsFingerprint("t", { a: 2 }))).status).toBe("conflict");
    expect((await lookupIdempotent(store, "other", paramsFingerprint("t", { a: 1 }))).status).toBe("miss");
  });

  it("records under a namespaced KV key when KV is bound", async () => {
    const kv = new MemKV();
    const store = createIdempotencyStore({ X402_IDEMPOTENCY: kv as unknown as KVNamespace });
    await store.put("k", {
      tool: "t",
      fingerprint: "f",
      result: "{}",
      settlement: { success: true, transaction: "0x1", network: "eip155:84532" },
      createdAt: Date.now(),
    });
    expect([...kv.map.keys()]).toEqual(["x402:idem:k"]);
    expect((await store.get("k"))?.result).toBe("{}");
  });
});
// ── Buyer wrapper ────────────────────────────────────────────────────────────

describe("withX402Client", () => {
  /** A 402 challenge for `usd`, served without a real server behind it. */
  async function challenge(usd: number) {
    const { encodePaymentRequiredHeader } = await import("@x402/core/http");
    const config = testConfig();
    const body = await paymentRequiredBody("classify_intent", usd, {
      config,
      resource: "http://clawdyclaw.com/mcp/v1",
    });
    return new Response(JSON.stringify(body), {
      status: 402,
      headers: { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(body), "content-type": "application/json" },
    });
  }

  it("shows the requirements to the confirmation callback before money moves", async () => {
    const seen: string[] = [];
    const answered = await withX402Client(
      {
        env: buyerEnv(),
        fetch: async () => challenge(0.02),
        confirm: (required) => {
          seen.push(required.accepts[0].amount);
          expect(facilitatorCalls.settle).toBe(0);
          return true;
        },
      },
      async (ctx) => {
        const response = await ctx.fetch("http://seller.example/tool");
        return { response, paid: ctx.paid.length };
      }
    );

    expect(seen).toEqual(["20000"]);
    expect(answered.paid).toBe(1);
    // The retry carries a signed authorization.
    expect(answered.response.status).toBe(402);
  });

  it("does not pay when the callback declines", async () => {
    await expect(
      withX402Client(
        { env: buyerEnv(), fetch: async () => challenge(0.02), confirm: () => false },
        (ctx) => ctx.fetch("http://seller.example/tool")
      )
    ).rejects.toThrow(/declined/);
  });

  it("auto-pays when no callback is configured", async () => {
    const answered = await withX402Client(
      { env: buyerEnv(), fetch: async () => challenge(0.02), confirm: null },
      async (ctx) => {
        await ctx.fetch("http://seller.example/tool");
        return ctx.paid.length;
      }
    );
    expect(answered).toBe(1);
  });

  it("refuses a quote above the spend cap", async () => {
    await expect(
      withX402Client(
        { env: buyerEnv(), fetch: async () => challenge(5), confirm: () => true, maxAmountUsd: "$1" },
        (ctx) => ctx.fetch("http://seller.example/tool")
      )
    ).rejects.toThrow();
  });

  it("requires a buyer key", async () => {
    await expect(
      withX402Client({ env: {}, confirm: () => true }, (ctx) => ctx.fetch("http://seller.example/tool"))
    ).rejects.toThrow(/X402_BUYER_PRIVATE_KEY/);
  });

  it("passes non-402 responses straight through", async () => {
    const answered = await withX402Client(
      { env: buyerEnv(), fetch: async () => new Response("ok", { status: 200 }), confirm: () => true },
      async (ctx) => ({ status: (await ctx.fetch("http://seller.example/tool")).status, paid: ctx.paid.length })
    );
    expect(answered).toEqual({ status: 200, paid: 0 });
  });
});

// ── MCP _meta payments ───────────────────────────────────────────────────────

describe("payment payload over MCP _meta", () => {
  it("accepts a payment carried in params._meta instead of a header", async () => {
    const env = await sellerEnv();
    // Quote, then sign the quote without paying it: the facilitator stub tracks
    // spent nonces, so a payload that has already been settled cannot be used
    // to prove a fresh transport.
    const { paymentRequiredBody } = await import("../src/lib/x402");
    const config = testConfig();
    const quote = await paymentRequiredBody("classify_intent", 0.005, {
      config,
      resource: "http://clawdyclaw.com/mcp/v1",
    });
    const payload = await signQuote(quote);
    const settledBefore = facilitatorCalls.settle;
    const res = await mcp.fetch(
      new Request("http://clawdyclaw.com/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: SESSION_COOKIE },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "classify_intent", arguments: { intent: "pay an invoice" }, _meta: { "x402/payment": payload } },
        }),
      }),
      env as never
    );
    expect(res.status).toBe(200);
    expect(facilitatorCalls.settle).toBe(settledBefore + 1);
  });
});

// ── Retry after settlement ───────────────────────────────────────────────────

describe("replay of an already-settled authorization", () => {
  it("serves the original result when the settled authorization is sent again", async () => {
    const env = await sellerEnv();

    const first = await mcp.fetch(
      new Request("http://clawdyclaw.com/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: SESSION_COOKIE,
          "Idempotency-Key": "retry-1",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", ...classifyCall() }),
      }),
      env as never
    );
    // Reuse the captured payment rather than paying again.
    expect(first.status).toBe(402);
    await buyToolCall(env, classifyCall(), { "idempotency-key": "retry-1" });
    const settled = facilitatorCalls.settle;
    expect(settled).toBe(1);

    const retry = new Request("http://clawdyclaw.com/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: SESSION_COOKIE,
        "Idempotency-Key": "retry-1",
        "PAYMENT-SIGNATURE": capturedPayment as string,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", ...classifyCall() }),
    });
    const replayed = await mcp.fetch(retry, env as never);

    expect(replayed.status).toBe(200);
    expect(replayed.headers.get("x402-idempotent-replay")).toBe("true");
    expect(facilitatorCalls.settle).toBe(settled);
  });

  it("still answers 402 when a spent authorization has no record", async () => {
    const env = await sellerEnv();
    await buyToolCall(env, classifyCall());
    const spent = capturedPayment as string;

    const again = await mcp.fetch(
      new Request("http://clawdyclaw.com/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: SESSION_COOKIE, "PAYMENT-SIGNATURE": spent },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", ...classifyCall() }),
      }),
      env as never
    );
    expect(again.status).toBe(402);
  });
});
