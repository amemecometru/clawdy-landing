/**
 * Track A proofs — a third-party agent's view of the catalogue.
 *
 * The client here knows only the server's origin. It discovers the tools from
 * the Bazaar discovery extension carried in the 402 challenge, rebuilds the
 * catalogue with prices, then pays for one call end to end and replays it with
 * the same idempotency key to show a retry is free.
 *
 * Live mode (testnet facilitator, real settlement) runs only when
 * X402_BUYER_PRIVATE_KEY is set. Without a key the discovery half still runs
 * against a local facilitator, so the catalogue proof never depends on funds.
 */

import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { recoverTypedDataAddress } from "viem";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import mcp from "../src/api/mcp";
import { PRICE_TABLE } from "../src/lib/price-table";
import { X402_TESTNET_FACILITATOR, withX402Client } from "../src/lib/x402";

const LIVE_KEY = process.env.X402_BUYER_PRIVATE_KEY as `0x${string}` | undefined;
const LIVE = Boolean(LIVE_KEY);
// Testnet only. Never a production key, never a mainnet spend.
const TESTNET_BUYER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as `0x${string}`;
const BUYER_KEY = LIVE_KEY ?? TESTNET_BUYER_KEY;

const SELLER = "0x1111111111111111111111111111111111111111";
const SESSION_COOKIE = "clawdyclaw.session=agent";
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

/** Set X402_EVIDENCE_FILE to have the live proofs append their evidence to a file. */
function record(line: string) {
  console.log(line);
  const file = process.env.X402_EVIDENCE_FILE;
  if (file) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { appendFileSync } = require("node:fs") as typeof import("node:fs");
    appendFileSync(file, line + "\n");
  }
}

const spentNonces = new Set<string>();
let facilitatorCalls = { verify: 0, settle: 0 };
let localUrl = "";
let server: Server;

async function checkPayment(body: any): Promise<{ isValid: boolean; invalidReason?: string; payer?: string }> {
  const signed = body?.paymentPayload?.payload;
  const auth = signed?.authorization;
  if (!signed?.signature || !auth?.from) return { isValid: false, invalidReason: "malformed" };
  if (spentNonces.has(auth.nonce)) return { isValid: false, invalidReason: "nonce_already_used" };

  const req = body.paymentRequirements;
  let signer: string;
  try {
    signer = await recoverTypedDataAddress({
      domain: {
        name: req.extra?.name as string,
        version: req.extra?.version as string,
        chainId: CHAIN_ID,
        verifyingContract: req.asset as `0x${string}`,
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
  if (signer.toLowerCase() !== auth.from.toLowerCase()) return { isValid: false, invalidReason: "wrong_signer" };
  if (BigInt(auth.value) !== BigInt(req.amount)) return { isValid: false, invalidReason: "wrong_amount" };
  if (BigInt(auth.validBefore) <= now) return { isValid: false, invalidReason: "expired" };
  return { isValid: true, payer: signer };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", async () => {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
      const json = (value: unknown, status = 200) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(value));
      };
      if (req.url === "/verify") {
        facilitatorCalls.verify++;
        json(await checkPayment(body));
      } else if (req.url === "/settle") {
        facilitatorCalls.settle++;
        const checked = await checkPayment(body);
        if (checked.isValid) spentNonces.add(body.paymentPayload.payload.authorization.nonce);
        json(
          checked.isValid
            ? {
                success: true,
                transaction: `0x${String(facilitatorCalls.settle).padStart(4, "0")}`,
                network: body.paymentRequirements.network,
                payer: checked.payer,
              }
            : { success: false, errorReason: checked.invalidReason, transaction: "", network: body.paymentRequirements.network }
        );
      } else if (req.url === "/supported") {
        json({ kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:84532" }], extensions: [], signers: {} });
      } else {
        json({ error: "not found" }, 404);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  localUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  facilitatorCalls = { verify: 0, settle: 0 };
  spentNonces.clear();
});

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

function sellerEnv(facilitator: string) {
  const kv = new MemKV();
  kv.map.set("session:agent", JSON.stringify({ sub: "agent", email: "agent@example.com" }));
  return {
    DB: {} as D1Database,
    SESSIONS: kv as unknown as KVNamespace,
    X402_PAY_TO_ADDRESS: SELLER,
    X402_FACILITATOR_URL: facilitator,
  };
}

/** A transport that only knows the origin: https://clawdyclaw.com/mcp/v1. */
function thirdPartyTransport(env: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(
      input instanceof Request ? input : new URL(String(input)),
      input instanceof Request ? init : init
    );
    const url = new URL(request.url);
    url.pathname = "/";
    url.search = "";
    return mcp.fetch(new Request(url.toString(), request), env as never);
  }) as typeof fetch;
}

function toolCall(name: string, args: Record<string, unknown> = {}) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  });
}

// ── Proof 1: discovery ───────────────────────────────────────────────────────

describe("third-party discovery", () => {
  it(
    "rebuilds the whole catalogue from the Bazaar extensions alone",
    { timeout: 60_000 },
    async () => {
      const facilitator = LIVE ? X402_TESTNET_FACILITATOR : localUrl;
      const env = sellerEnv(facilitator);

      // The agent's only prior knowledge: the origin. It reads the Bazaar
      // discovery documents published on the catalogue, then confirms on the
      // callable tools that a 402 challenge carries the same document and price.
      const listing = (await thirdPartyTransport(env)("https://clawdyclaw.com/mcp/v1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })) as Response;
      const catalogue = JSON.parse(
        (JSON.parse(await listing.text()) as { result: { content: { text: string }[] } }).result.content[0].text
      ) as {
        discovery: {
          tool: string;
          mcp_name: string | null;
          price_usd: number;
          price_atomic: string;
          extensions: Record<string, any>;
        }[];
      };

      expect(catalogue.discovery).toHaveLength(35);
      const discovered = new Map<string, { description: string; price_usd: number; atomic: string; mcp: string | null }>();
      for (const entry of catalogue.discovery) {
        const bazaar = entry.extensions?.bazaar;
        expect(bazaar, entry.tool).toBeDefined();
        expect(bazaar.info.input.type, entry.tool).toBe("mcp");
        expect(bazaar.info.input.inputSchema, entry.tool).toBeDefined();
        discovered.set(entry.tool, {
          description: bazaar.info.input.description ?? "",
          price_usd: entry.price_usd,
          atomic: entry.price_atomic,
          mcp: entry.mcp_name,
        });
      }
      const client = x402Client.fromConfig({ schemes: [], spendControls: false });
      registerExactEvmScheme(client, {
        signer: privateKeyToAccount(BUYER_KEY),
        networks: ["eip155:84532"],
      });
      const http = new x402HTTPClient(client);

      expect(discovered.size).toBe(35);

      // Every price the agent learned must equal the locked table.
      for (const tool of PRICE_TABLE) {
        const found = discovered.get(tool.name)!;
        expect(found.price_usd, tool.name).toBe(tool.price_usd);
        expect(found.atomic, tool.name).toBe(tool.price_atomic);
        expect(found.mcp, tool.name).toBe(tool.mcp_name);
      }

      // A 402 challenge on each callable tool repeats the same document and the
      // same amount, on the network and asset the agent will be charged on.
      const callable = PRICE_TABLE.filter((t) => t.on_execution_surface);
      expect(callable.length).toBeGreaterThan(0);
      expect(callable.length).toBeLessThan(35);
      for (const tool of callable) {
        const response = await thirdPartyTransport(env)("https://clawdyclaw.com/mcp/v1", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: SESSION_COOKIE },
          body: toolCall(tool.mcp_name as string),
        });
        expect(response.status, tool.name).toBe(402);
        const required = http.getPaymentRequiredResponse((name) => response.headers.get(name));
        const bazaar = (required.extensions as Record<string, any> | undefined)?.bazaar;
        expect(bazaar?.info?.input?.toolName, tool.name).toBe(tool.mcp_name);
        expect(Number(required.accepts[0].amount) / 1_000_000, tool.name).toBe(tool.price_usd);
        expect(required.accepts[0].network, tool.name).toBe("eip155:84532");
        expect(required.accepts[0].asset.toLowerCase(), tool.name).toBe(USDC_SEPOLIA.toLowerCase());
      }
      record(
        `discovered ${discovered.size} tools via Bazaar documents (${callable.length} callable now), facilitator ${facilitator}`
      );
    }
  );
});

// ── Proof 2: transaction + timing ────────────────────────────────────────────

/**
 * One paid attempt, timed. The public testnet facilitator resets connections
 * intermittently; a failed verification therefore gets a fresh authorization and
 * a fresh attempt, and the attempt count is reported with the timing.
 */
async function timedPayment(
  env: Record<string, unknown>,
  facilitator: string,
  headers: Record<string, string>,
  body: string
): Promise<{ response: Response; elapsed: number; paid: number }> {
  return withX402Client(
    {
      env: { X402_BUYER_PRIVATE_KEY: BUYER_KEY, X402_FACILITATOR_URL: facilitator },
      confirm: () => true,
      fetch: thirdPartyTransport(env),
      maxAmountUsd: "$5",
    },
    async (ctx) => {
      const started = Date.now();
      const response = await ctx.fetch("https://clawdyclaw.com/mcp/v1", { method: "POST", headers, body });
      return { response, elapsed: Date.now() - started, paid: ctx.paid.length };
    }
  );
}

/** Pay for a call, retrying on a transient facilitator failure. */
async function payWithRetry(
  env: Record<string, unknown>,
  facilitator: string,
  headers: Record<string, string>,
  body: string,
  attemptsAllowed = 3
) {
  const log: { attempt: number; status: number; ms: number; body: string }[] = [];
  let last: Awaited<ReturnType<typeof timedPayment>> | undefined;
  for (let attempt = 1; attempt <= attemptsAllowed; attempt++) {
    const result = await timedPayment(env, facilitator, headers, body);
    last = result;
    log.push({
      attempt,
      status: result.response.status,
      ms: result.elapsed,
      body: (await result.response.clone().text()).slice(0, 160),
    });
    if (result.response.status === 200) return { ...result, log };
  }
  return { response: last!.response, elapsed: last!.elapsed, paid: last!.paid, log };
}

describe("third-party transaction", () => {
  it(
    "discovers, pays, settles and replays without a second charge",
    { timeout: 60_000 },
    async () => {
      const facilitator = LIVE ? X402_TESTNET_FACILITATOR : localUrl;
      const env = sellerEnv(facilitator);
      const body = toolCall("classify_intent", { intent: "renew the clawdyclaw domain" });
      const headers = {
        "content-type": "application/json",
        cookie: SESSION_COOKIE,
        "idempotency-key": "track-a-1",
      };

      const result = await payWithRetry(env, facilitator, headers, body);
      expect(result.response, JSON.stringify(result.log)).toBeTruthy();
      expect(result.response!.status, JSON.stringify(result.log)).toBe(200);

      const parsed = (await result.response!.json()) as {
        result: { content: { text: string }[]; _meta?: Record<string, unknown> };
      };
      const settlement = parsed.result._meta?.["x402/payment-response"] as {
        success: boolean;
        transaction: string;
      };
      expect(settlement.success).toBe(true);
      // A real chain hash on testnet; the local stub returns a short stand-in.
      if (LIVE) expect(settlement.transaction).toMatch(/^0x[0-9a-f]{40,}$/);

      // The same request again: same idempotency key, no second charge.
      const replayStarted = Date.now();
      const replay = await thirdPartyTransport(env)("https://clawdyclaw.com/mcp/v1", {
        method: "POST",
        headers,
        body,
      });
      const replayElapsed = Date.now() - replayStarted;

      expect(replay.status).toBe(200);
      expect(replay.headers.get("x402-idempotent-replay")).toBe("true");
      expect(await replay.text()).toBe(JSON.stringify(parsed));

      // One authorization, one settlement, however many times it is sent. Against
      // the local facilitator that is a counter; on testnet the proof is the
      // byte-identical replay and the absence of a second transaction.
      if (!LIVE) expect(facilitatorCalls.settle).toBe(1);

      const budget = LIVE ? 10_000 : 1_000;
      expect(result.elapsed).toBeLessThan(budget);
      const attempts = result.log.map((a) => `${a.status}@${a.ms}ms`).join(", ");
      record(
        `402→200 in ${result.elapsed}ms (attempts: ${attempts}), replay in ${replayElapsed}ms, ` +
          `tx=${settlement.transaction} (${LIVE ? "testnet" : "local facilitator"})`
      );
    }
  );

  it(
    "refuses to pay twice for the same authorization",
    { timeout: 60_000 },
    async () => {
      const facilitator = LIVE ? X402_TESTNET_FACILITATOR : localUrl;
      const env = sellerEnv(facilitator);
      const body = toolCall("classify_intent", { intent: "renew the clawdyclaw domain" });

      const client = x402Client.fromConfig({ schemes: [], spendControls: { maxAmountPerPayment: "$5" } });
      registerExactEvmScheme(client, { signer: privateKeyToAccount(BUYER_KEY), networks: ["eip155:84532"] });
      const http = new x402HTTPClient(client);

      const send = (headers: Record<string, string>) =>
        thirdPartyTransport(env)("https://clawdyclaw.com/mcp/v1", {
          method: "POST",
          headers: { "content-type": "application/json", cookie: SESSION_COOKIE, ...headers },
          body,
        });

      /** Challenge the server and sign whatever it quotes. */
      const signFresh = async () => {
        const challenge = await send({});
        expect(challenge.status).toBe(402);
        const required = http.getPaymentRequiredResponse((name) => challenge.headers.get(name));
        const payload = await http.createPaymentPayload(required);
        return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
      };

      // Pay once. A transient facilitator failure is retried with a brand new
      // authorization; anything else is a real refusal and fails the test.
      let signature = await signFresh();
      let paid = await send({ "PAYMENT-SIGNATURE": signature });
      for (let attempt = 0; paid.status !== 200 && attempt < 2; attempt++) {
        signature = await signFresh();
        paid = await send({ "PAYMENT-SIGNATURE": signature });
      }
      expect(paid.status).toBe(200);
      if (!LIVE) expect(facilitatorCalls.settle).toBe(1);

      const firstBody = await paid.clone().text();
      const firstSettlement = (JSON.parse(firstBody).result._meta["x402/payment-response"] ?? {}) as {
        transaction?: string;
      };
      if (LIVE) expect(firstSettlement.transaction).toMatch(/^0x[0-9a-f]{40,}$/);
      record(`first payment settled: ${firstSettlement.transaction}`);

      // The same signed authorization, sent again. The chain already spent that
      // nonce, so the facilitator will not settle it a second time: the call
      // is refused, and the paid result is not delivered twice.
      const replay = await send({ "PAYMENT-SIGNATURE": signature });
      expect(replay.status).toBe(402);
      const replayText = await replay.text();
      expect(replayText).not.toContain("queue_for_review");
      // The refusal is either a fresh challenge or a settlement refusal.
      const replayBody = JSON.parse(replayText) as { accepts?: unknown[]; error?: { message?: string } };
      expect(
        replayBody.accepts !== undefined ||
          replayBody.error?.message?.includes("settlement failed") ||
          replayBody.error?.message?.includes("Payment required")
      ).toBe(true);
      if (!LIVE) expect(facilitatorCalls.settle).toBe(1);
      record(`replay of the same authorization: ${replay.status}, no second settlement, no second delivery`);
    }
  );
});
