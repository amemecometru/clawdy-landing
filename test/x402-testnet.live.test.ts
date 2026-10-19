/**
 * Live x402 settlement on Base Sepolia — the real-money path, once.
 *
 * Runs the full seller/buyer exchange against the public testnet facilitator:
 *   unpaid call → 402 → sign an EIP-3009 USDC authorization → verified →
 *   settled on chain → 200 with the tool's real result.
 *
 * Skipped unless a funded buyer key is in the environment:
 *
 *   X402_BUYER_PRIVATE_KEY=0x...  buyer wallet key (never committed, never logged)
 *   X402_PAY_TO_ADDRESS=0x...    seller recipient (defaults to the test address below)
 *
 * Testnet USDC for the buyer wallet comes from the Circle testnet faucet:
 * https://faucet.circle.com/ (Base Sepolia → USDC). No key or faucet-derived
 * secret is stored in this repository.
 */

import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, formatUnits, http } from "viem";
import { baseSepolia } from "viem/chains";
import mcp from "../worker/api/mcp";
import { withX402Client, X402_DEFAULT_FACILITATOR } from "../worker/lib/x402";

const BUYER_KEY = process.env.X402_BUYER_PRIVATE_KEY;
const SELLER = process.env.X402_PAY_TO_ADDRESS ?? "0x1111111111111111111111111111111111111111";
const FACILITATOR = process.env.X402_FACILITATOR_URL ?? X402_DEFAULT_FACILITATOR;
const RPC_URL = process.env.X402_RPC_URL;
const SESSION_COOKIE = "clawdyclaw.session=live";
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

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

function sellerEnv() {
  const kv = new MemKV();
  kv.map.set("session:live", JSON.stringify({ sub: "live", email: "live@example.com" }));
  return {
    DB: {} as D1Database,
    SESSIONS: kv as unknown as KVNamespace,
    X402_PAY_TO_ADDRESS: SELLER,
    X402_FACILITATOR_URL: FACILITATOR,
  };
}

function routerFetch(env: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(
      input instanceof Request ? input : new URL(String(input)),
      input instanceof Request ? init : init
    );
    const url = new URL(request.url);
    url.pathname = "/";
    return mcp.fetch(new Request(url.toString(), request), env as never);
  }) as typeof fetch;
}

describe.skipIf(!BUYER_KEY)("live x402 settlement on base-sepolia", () => {
  it(
    "takes an unpaid tool call through 402, payment, verification and settlement",
    { timeout: 120_000 },
    async () => {
      const env = sellerEnv();
      const buyer = privateKeyToAccount(BUYER_KEY as `0x${string}`);
      console.log(`buyer     ${buyer.address}`);
      console.log(`seller    ${SELLER}`);
      console.log(`facilitator ${FACILITATOR}`);

      if (RPC_URL) {
        const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
        const before = await client
          .readContract({
            address: USDC_SEPOLIA,
            abi: [
              {
                type: "function",
                name: "balanceOf",
                stateMutability: "view",
                inputs: [{ name: "account", type: "address" }],
                outputs: [{ name: "", type: "uint256" }],
              },
            ],
            functionName: "balanceOf",
            args: [buyer.address],
          });
        console.log(`buyer USDC before  ${formatUnits(before, 6)}`);
      }

      const { unpaid, retried, quotes } = await withX402Client(
        {
          env: { X402_BUYER_PRIVATE_KEY: BUYER_KEY, X402_FACILITATOR_URL: FACILITATOR },
          confirm: (required) => {
            const accept = required.accepts[0];
            console.log(
              `quoted    ${accept.amount} atomic USDC (${formatUnits(BigInt(accept.amount), 6)} USD) on ${accept.network} → ${accept.payTo}`
            );
            return true;
          },
          fetch: routerFetch(env),
          maxAmountUsd: "$1",
        },
        async (ctx) => {
          // The same call without any payment attached.
          const unpaid = await routerFetch(env)("http://clawdyclaw.com/", {
            method: "POST",
            headers: { "content-type": "application/json", cookie: SESSION_COOKIE },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: { name: "classify_intent", arguments: { intent: "renew the clawdyclaw domain" } },
            }),
          });
          const retried = await ctx.fetch("http://clawdyclaw.com/", {
            method: "POST",
            headers: { "content-type": "application/json", cookie: SESSION_COOKIE },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: { name: "classify_intent", arguments: { intent: "renew the clawdyclaw domain" } },
            }),
          });
          return { unpaid, retried, quotes: ctx.paid.length };
        }
      );

      // 1. Unpaid: instructions, no execution.
      expect(unpaid.status).toBe(402);
      // 2. Paid: verified, settled, and the tool's real result comes back.
      expect(retried.status).toBe(200);
      expect(quotes).toBe(1);

      const body = (await retried.json()) as {
        result: { content: { text: string }[]; _meta?: Record<string, unknown> };
      };
      const settlement = body.result._meta?.["x402/payment-response"] as {
        success: boolean;
        transaction: string;
        network: string;
        payer: string;
      };
      expect(settlement.success).toBe(true);
      expect(settlement.network).toBe("eip155:84532");
      expect(settlement.payer.toLowerCase()).toBe(buyer.address.toLowerCase());
      console.log(`settled   ${settlement.transaction}`);
      console.log(`result    ${body.result.content[0].text}`);

      if (RPC_URL) {
        const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
        const receipt = await client.waitForTransactionReceipt({ hash: settlement.transaction as `0x${string}` });
        expect(receipt.status).toBe("success");
        console.log(`on chain  block ${receipt.blockNumber}, status ${receipt.status}`);
      }
    }
  );
});