/**
 * Temporary proof harness — prints the verification evidence trail.
 */

import { createServer } from "node:http";
import { describe, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import mcp from "../src/api/mcp";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { X402_TESTNET_FACILITATOR } from "../src/lib/x402";

const KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const OTHER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const PAY_TO = "0x1111111111111111111111111111111111111111";
const SESSION = "clawdyclaw.session=proof";
const TRANSFER_TOPIC = "0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5";

const rpcUrl = process.env.X402_RPC_URL ?? "https://sepolia.base.org";

function env() {
  const map = new Map<string, string>([["session:proof", JSON.stringify({ sub: "proof" })]]);
  return {
    DB: {} as D1Database,
    SESSIONS: {
      get: async (k: string) => map.get(k) ?? null,
      put: async () => {},
      delete: async () => {},
    } as unknown as KVNamespace,
    X402_PAY_TO_ADDRESS: PAY_TO,
    X402_FACILITATOR_URL: X402_TESTNET_FACILITATOR,
  };
}

async function postJson(url: string, body: unknown, tries = 5): Promise<any> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
}

async function gateCall(envr: Record<string, unknown>, payment?: string, idem?: string) {
  const headers: Record<string, string> = { "content-type": "application/json", cookie: SESSION };
  if (payment) headers["payment-signature"] = payment;
  if (idem) headers["idempotency-key"] = idem;
  return mcp.fetch(
    new Request("http://clawdyclaw.com/", {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "classify_intent", arguments: { intent: "renew the clawdyclaw domain" } },
      }),
    }),
    envr as never
  );
}

function b64(obj: unknown) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function line(title: string) {
  console.log(`\n──────── ${title} ────────`);
}

/**
 * Testnet only. Runs a real settlement against the public facilitator and the
 * public Anvil test key, so it is skipped unless a key is in the environment —
 * same gate as the other live proofs. Unattended `npm test` must not spend.
 */
describe.skipIf(!process.env.X402_BUYER_PRIVATE_KEY)("verification proof", () => {
  it(
    "shows the trail",
    { timeout: 180_000 },
    async () => {
      const envr = env();

      line("1. UNPAID CALL — the gate answers 402, nothing executes");
      const unpaid = await gateCall(envr);
      console.log("status:", unpaid.status);
      const required = (await unpaid.json()) as any;
      console.log("quote :", JSON.stringify(required.accepts[0]));
      console.log("bazaar:", JSON.stringify(required.extensions?.bazaar).slice(0, 90) + "…");

      line("2. BUYER SIGNS — EIP-3009 authorization, local, no network");
      const client = x402Client.fromConfig({ schemes: [], spendControls: { maxAmountPerPayment: "$5" } });
      const signer = privateKeyToAccount(KEY);
      registerExactEvmScheme(client, { signer, networks: ["eip155:84532"] });
      const http = new x402HTTPClient(client);
      const payload = await http.createPaymentPayload(required);
      console.log("payer :", signer.address);
      console.log("auth  :", JSON.stringify(payload.payload.authorization));
      console.log("sig   :", payload.payload.signature);

      line("3. FACILITATOR /verify — the honest payload");
      const good = await postJson(`${X402_TESTNET_FACILITATOR}/verify`, {
        x402Version: 2,
        paymentPayload: payload,
        paymentRequirements: required.accepts[0],
      });
      console.log("response:", JSON.stringify(good));

      line("4. FACILITATOR /verify — tampered variants");
      const variants: [string, (p: any) => void, any][] = [
        ["amount lowered in the quote", (p) => (p.accepted.amount = "1"), required.accepts[0]],
        ["amount raised in the quote", (p) => (p.accepted.amount = "999999999"), { ...required.accepts[0] }],
        [
          "recipient swapped",
          (p) => (p.accepted.payTo = "0x2222222222222222222222222222222222222222"),
          { ...required.accepts[0], payTo: "0x2222222222222222222222222222222222222222" },
        ],
        [
          "asset swapped",
          (p) => (p.accepted.asset = "0x0000000000000000000000000000000000000001"),
          { ...required.accepts[0], asset: "0x0000000000000000000000000000000000000001" },
        ],
        ["signature bit flipped", (p) => (p.payload.signature = p.payload.signature.slice(0, -4) + "dead"), required.accepts[0]],
        ["authorization value rewritten", (p) => (p.payload.authorization.value = "1"), required.accepts[0]],
        ["authorization expired", (p) => (p.payload.authorization.validBefore = "1"), required.accepts[0]],
      ];
      for (const [label, mutate, reqs] of variants) {
        const bad = structuredClone(payload);
        mutate(bad);
        const res = await postJson(`${X402_TESTNET_FACILITATOR}/verify`, {
          x402Version: 2,
          paymentPayload: bad,
          paymentRequirements: reqs,
        });
        console.log(`${label.padEnd(32)} → ${JSON.stringify(res)}`);
      }

      line("4b. THE SAME VARIANTS THROUGH OUR GATE — the local match first");
      for (const [label, mutate] of variants) {
        const bad = structuredClone(payload);
        mutate(bad);
        const res = await gateCall(envr, b64(bad));
        console.log(`${label.padEnd(32)} → HTTP ${res.status}  executed=${res.status === 200}`);
      }

      line("5. A DIFFERENT KEY SIGNS THE SAME QUOTE");
      const otherClient = x402Client.fromConfig({ schemes: [], spendControls: false });
      registerExactEvmScheme(otherClient, {
        signer: privateKeyToAccount(OTHER_KEY),
        networks: ["eip155:84532"],
      });
      const stolen = await new x402HTTPClient(otherClient).createPaymentPayload(required);
      console.log(
        "verify  →",
        JSON.stringify(
          await postJson(`${X402_TESTNET_FACILITATOR}/verify`, {
            x402Version: 2,
            paymentPayload: stolen,
            paymentRequirements: required.accepts[0],
          })
        )
      );
      console.log(
        "gate    →",
        (await gateCall(envr, b64(stolen))).status,
        "(402 = refused before execution)"
      );

      line("6. THE HONEST PAYMENT THROUGH OUR GATE — settles on chain");
      {
        const { verifyX402Payment } = await import("../src/lib/x402");
        const verdict = await verifyX402Payment(
          new Request("http://clawdyclaw.com/", { headers: { "payment-signature": b64(payload) } }),
          {
            toolName: "classify_intent",
            usd: 0.005,
            env: envr,
            resource: "http://clawdyclaw.com/mcp/v1",
          }
        );
        console.log("server verdict:", verdict.ok ? "verified" : `REJECTED — ${verdict.reason}`);
      }
      const paid = await gateCall(envr, b64(payload), "proof-key-1");
      const paidBody = (await paid.json()) as any;
      const settlement = paidBody.result?._meta?.["x402/payment-response"];
      console.log("status:", paid.status);
      console.log("settle:", JSON.stringify(settlement));
      console.log("result:", paidBody.result?.content?.[0]?.text);

      const receipt = await postJson(rpcUrl, {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [settlement.transaction],
      });
      console.log(`\non-chain ${settlement.transaction}`);
      console.log(`status   ${receipt.result.status}  (0x1 = success)`);
      console.log(`block    ${parseInt(receipt.result.blockNumber, 16)}`);
      console.log(`sender   ${receipt.result.from}`);
      for (const log of receipt.result.logs) {
        if (log.topics[0] !== TRANSFER_TOPIC) continue;
        const usdc = (log.data && log.data !== "0x" ? BigInt(log.data) : 0n) / 10n ** 6n;
        const label = log.topics[2].slice(-40) === PAY_TO.slice(2).toLowerCase() ? "seller" : "facilitator";
        console.log(
          `USDC     ${log.topics[1].slice(-40)} → ${log.topics[2].slice(-40)} (${label})  ${usdc} USDC`
        );
      }

      line("7. THE SAME AUTHORIZATION, SENT AGAIN (double-charge attempt)");
      const replaySameKey = await gateCall(envr, b64(payload), "proof-key-1");
      console.log("same idempotency key →", replaySameKey.status, replaySameKey.headers.get("x402-idempotent-replay"));
      console.log("body identical       →", (await replaySameKey.text()) === JSON.stringify(paidBody));
      const replayNoKey = await gateCall(envr, b64(payload));
      console.log("no idempotency key   →", replayNoKey.status, "(402: chain already consumed the authorization)");
      console.log("body                 →", (await replayNoKey.json()).error?.message);
    }
  );
});