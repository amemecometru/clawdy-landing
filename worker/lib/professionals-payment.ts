/**
 * Professionals workflow payment — the four owner-locked one-time tiers and the
 * two ways a human can pay for them.
 *
 * One price per tier, one payment, one delivery: there is no seat model and no
 * subscription here. Stripe Checkout is the primary path; crypto pays in USDC on
 * the same Base rail the agent tools settle on (asset, network and recipient
 * come from the x402 environment, so the two rails cannot drift apart).
 *
 * Owner lock (Oct 14):
 *   T1 $320  domain ($20 budget; overage raises the price) + brand landing page
 *   T2 $375  T1 + professionals resume
 *   T3 $525  T2 + basic autobiography
 *   T4 $900  T3 + ultimate autobiography w/ video + imaging revisions
 *
 * One crypto flow, like one card flow: the buyer gets the address and the exact
 * amount, pays, and the digital receipt is issued when the payment is seen on
 * chain. There is no invoice step and no price threshold.
 *
 * Stripe credentials come from the environment (STRIPE_SECRET_KEY,
 * STRIPE_WEBHOOK_SECRET); nothing secret is stored in code.
 */

import { resolveX402Config, toAtomicUnits, X402_NETWORKS } from "./x402";

// ── Tiers ────────────────────────────────────────────────────────────────────

export const WORKFLOW_TIERS = ["t1", "t2", "t3", "t4"] as const;
export type WorkflowTier = (typeof WORKFLOW_TIERS)[number];

/** One billable component of the workflow. */
export interface WorkflowComponent {
  id: string;
  label: string;
  price_usd: number;
}

export interface WorkflowTierDef {
  tier: WorkflowTier;
  components: WorkflowComponent[];
  /** What the buyer receives once the single payment settles. */
  includes: string[];
}

/** Domain budget folded into every tier; a real cost above it raises the price. */
export const DOMAIN_BUDGET_USD = 20;

const LANDING_PAGE: WorkflowComponent = {
  id: "landing_page",
  label: "Personal brand landing page (custom template)",
  price_usd: 300,
};

/**
 * Cumulative components per tier. T1 = 20 + 300 = 320; each tier adds exactly
 * the delta between it and the tier above it.
 */
export const WORKFLOW_TIER_DEFS: Record<WorkflowTier, WorkflowTierDef> = {
  t1: {
    tier: "t1",
    components: [
      { id: "domain", label: "Domain registration", price_usd: DOMAIN_BUDGET_USD },
      LANDING_PAGE,
    ],
    includes: ["Domain registration and DNS", "Personal brand landing page (custom template)"],
  },
  t2: {
    tier: "t2",
    components: [
      { id: "domain", label: "Domain registration", price_usd: DOMAIN_BUDGET_USD },
      LANDING_PAGE,
      { id: "resume", label: "Professional resume", price_usd: 55 },
    ],
    includes: [
      "Domain registration and DNS",
      "Personal brand landing page (custom template)",
      "Professional resume",
    ],
  },
  t3: {
    tier: "t3",
    components: [
      { id: "domain", label: "Domain registration", price_usd: DOMAIN_BUDGET_USD },
      LANDING_PAGE,
      { id: "resume", label: "Professional resume", price_usd: 55 },
      { id: "autobiography_basic", label: "Basic autobiography", price_usd: 150 },
    ],
    includes: [
      "Domain registration and DNS",
      "Personal brand landing page (custom template)",
      "Professional resume",
      "Basic autobiography",
    ],
  },
  t4: {
    tier: "t4",
    components: [
      { id: "domain", label: "Domain registration", price_usd: DOMAIN_BUDGET_USD },
      LANDING_PAGE,
      { id: "resume", label: "Professional resume", price_usd: 55 },
      { id: "autobiography_basic", label: "Basic autobiography", price_usd: 150 },
      {
        id: "autobiography_ultimate",
        label: "Ultimate autobiography with video",
        price_usd: 300,
      },
      { id: "imaging_revisions", label: "Imaging revisions", price_usd: 75 },
    ],
    includes: [
      "Domain registration and DNS",
      "Personal brand landing page (custom template)",
      "Professional resume",
      "Basic autobiography",
      "Ultimate autobiography with video",
      "Imaging revisions",
    ],
  },
};

/** True for a known tier id. */
export function isWorkflowTier(value: unknown): value is WorkflowTier {
  return typeof value === "string" && (WORKFLOW_TIERS as readonly string[]).includes(value);
}

/** A priced quote: what the buyer is buying, and for how much. */
export interface WorkflowQuote {
  tier: WorkflowTier;
  price_usd: number;
  price_cents: number;
  components: WorkflowComponent[];
  includes: string[];
}

/**
 * Price a tier. The domain is carried at its $20 budget; pass the real
 * registration cost and the quote rises with it, per the owner lock.
 */
export function quoteWorkflow(
  tier: WorkflowTier,
  opts: { domainCostUsd?: number } = {}
): WorkflowQuote {
  const def = WORKFLOW_TIER_DEFS[tier];
  const domainCost = opts.domainCostUsd;
  const components = def.components.map((c) =>
    c.id === "domain" && domainCost !== undefined
      ? { ...c, label: `${c.label} (at cost)`, price_usd: round2(domainCost) }
      : c
  );
  const price = round2(components.reduce((sum, c) => sum + c.price_usd, 0));
  return {
    tier,
    price_usd: price,
    price_cents: Math.round(price * 100),
    components,
    includes: def.includes,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ── Environment ──────────────────────────────────────────────────────────────

/** Environment for the workflow payment routes. */
export interface ProfessionalsPaymentEnv {
  DB: D1Database;
  SESSIONS?: KVNamespace;
  /** Recipient wallet for crypto payments (shared with the x402 rail). */
  X402_PAY_TO_ADDRESS?: string;
  /** Testnet or mainnet; mainnet needs X402_MAINNET=true as usual. */
  X402_NETWORK?: string;
  X402_MAINNET?: string;
  /** Base RPC used to read crypto payment receipts. */
  X402_RPC_URL?: string;
  BASE_RPC_URL?: string;
  /** Stripe secret and webhook signing secret. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Signs digital receipts; falls back to AUTH_SECRET. */
  RECEIPT_SIGNING_SECRET?: string;
  AUTH_SECRET?: string;
  /** Where Stripe returns the buyer after payment. */
  PUBLIC_ORIGIN?: string;
}

/** RPC endpoint for chain reads, or null when none is configured. */
export function rpcUrlFor(env: ProfessionalsPaymentEnv): string | null {
  return env.BASE_RPC_URL?.trim() || env.X402_RPC_URL?.trim() || null;
}

// ── Crypto instructions ──────────────────────────────────────────────────────

/** What the buyer needs in order to pay in crypto. */
export interface CryptoInstructions {
  network: string;
  network_label: string;
  asset: string;
  symbol: string;
  amount_atomic: string;
  amount_usd: number;
  decimals: number;
  pay_to: string;
  /** Quote this payment against, so a replayed transfer cannot be reused. */
  reference: string;
  expires_at: number;
}

const SYMBOL: Record<string, string> = {
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e": "USDC",
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": "USDC",
};

const LABEL: Record<string, string> = {
  "eip155:84532": "Base Sepolia",
  "eip155:8453": "Base",
};

/**
 * Payment instructions for a crypto checkout, on the same USDC rail the agent
 * tools settle on. Amounts are exact atomic units (6 decimals).
 */
export function cryptoInstructions(
  quote: WorkflowQuote,
  env: ProfessionalsPaymentEnv,
  reference: string,
  expiresAt: number
): { ok: true; instructions: CryptoInstructions } | { ok: false; reason: string } {
  const rail = resolveX402Config(env as never);
  if (!rail.ok) return { ok: false, reason: rail.reason };
  const { config } = rail;
  const asset = config.asset.toLowerCase();

  return {
    ok: true,
    instructions: {
      network: config.network,
      network_label: LABEL[config.network] ?? config.network,
      asset: config.asset,
      symbol: SYMBOL[asset] ?? "USDC",
      amount_atomic: toAtomicUnits(quote.price_usd),
      amount_usd: quote.price_usd,
      decimals: 6,
      pay_to: config.payTo,
      reference,
      expires_at: expiresAt,
    },
  };
}

// ── Stripe ───────────────────────────────────────────────────────────────────

/** How a checkout may be paid for. */
export type PaymentMethod = "stripe" | "crypto";

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "stripe" || value === "crypto";
}

export interface StripeCheckoutInput {
  checkoutId: string;
  tier: WorkflowTier;
  quote: WorkflowQuote;
  env: ProfessionalsPaymentEnv;
  fetch?: typeof fetch;
}

export type StripeCheckoutResult =
  | { ok: true; sessionId: string; url: string | null }
  | { ok: false; reason: string };

/**
 * Open a one-time Stripe Checkout Session for a tier.
 *
 * `mode=payment` with an inline price_data line item: no subscription, no
 * quantity, one price per tier. The secret key is read from the environment.
 */
export async function createStripeCheckout(
  input: StripeCheckoutInput
): Promise<StripeCheckoutResult> {
  const secret = input.env.STRIPE_SECRET_KEY;
  if (!secret) return { ok: false, reason: "STRIPE_SECRET_KEY is not configured" };

  const origin = (input.env.PUBLIC_ORIGIN ?? "https://clawdyclaw.com").replace(/\/+$/, "");
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${origin}/?checkout=cancelled`);
  body.set("client_reference_id", input.checkoutId);
  body.set("metadata[checkout_id]", input.checkoutId);
  body.set("metadata[tier]", input.tier);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(input.quote.price_cents));
  body.set("line_items[0][price_data][product_data][name]", tierTitle(input.tier));
  body.set("line_items[0][price_data][product_data][description]", input.quote.includes.join(" · "));

  const doFetch = input.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
  } catch (error) {
    return { ok: false, reason: `Stripe unreachable: ${message(error)}` };
  }

  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.id) {
    return { ok: false, reason: payload?.error?.message ?? `Stripe returned ${response.status}` };
  }
  return { ok: true, sessionId: payload.id, url: payload.url ?? null };
}

function tierTitle(tier: WorkflowTier): string {
  return `ClawdyClaw Professionals workflow — ${tier.toUpperCase()}`;
}

/** Clock tolerance when checking a Stripe webhook signature. */
export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Verify a Stripe webhook signature (Stripe-Signature: t=…,v1=…) against the
 * raw request body. Returns false for a missing, malformed, stale or altered
 * signature — the caller then ignores the event.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string | undefined,
  nowSeconds: number
): Promise<boolean> {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [k, v] = part.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const timestamp = Number(parts.t);
  const expected = parts.v1;
  if (!Number.isFinite(timestamp) || !expected) return false;
  if (Math.abs(nowSeconds - timestamp) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const digest = hex(new Uint8Array(mac));
  return timingSafeEqual(digest, expected);
}

/** A completed one-time Stripe Checkout session. */
export interface PaidStripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      client_reference_id?: string;
      payment_status?: string;
      metadata?: Record<string, string>;
    };
  };
}

/**
 * True when a Stripe event is a completed one-time checkout session that
 * carries the checkout reference we stamped on it.
 */
export function isPaidStripeEvent(event: unknown): event is PaidStripeEvent {
  if (!event || typeof event !== "object") return false;
  const e = event as { id?: unknown; type?: unknown; data?: unknown };
  if (typeof e.id !== "string" || e.type !== "checkout.session.completed") return false;
  if (!e.data || typeof e.data !== "object") return false;
  const object = (e.data as { object?: unknown }).object;
  return !!object && typeof object === "object";
}

/** The checkout reference carried by a Stripe session (ours, not Stripe's id). */
export function stripeCheckoutReference(event: PaidStripeEvent): string | undefined {
  const object = event.data.object;
  const reference = object.client_reference_id ?? object.metadata?.checkout_id;
  return reference && reference.length > 0 ? reference : undefined;
}

// ── Crypto confirmation ──────────────────────────────────────────────────────

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** An ERC-20 Transfer-shaped log, whatever the asset's event name is. */
interface TransferLog {
  address: string;
  topics: string[];
  data: string;
}

/** The part of a transaction receipt this module reads. */
interface ReceiptLike {
  status?: string;
  blockNumber?: string;
  logs?: TransferLog[];
}

export type CryptoConfirmResult =
  | { ok: true; amount_atomic: string; from: string; to: string; block: number }
  | { ok: false; reason: string };

export interface CryptoConfirmInput {
  env: ProfessionalsPaymentEnv;
  txHash: string;
  /** Address the buyer said they would pay from. */
  wallet: string;
  /** Asset contract the payment had to be made in. */
  asset: string;
  /** Recipient the payment had to reach. */
  payTo: string;
  /** Exact amount in atomic units. */
  amountAtomic: string;
  fetch?: typeof fetch;
}

/**
 * Confirm a crypto payment by reading its transaction receipt: the transaction
 * succeeded, and one of the asset's transfer events moved exactly the quoted
 * amount from the buyer's wallet to the recipient.
 */
export async function confirmCryptoPayment(
  input: CryptoConfirmInput
): Promise<CryptoConfirmResult> {
  const rpc = rpcUrlFor(input.env);
  if (!rpc) return { ok: false, reason: "No Base RPC configured (X402_RPC_URL or BASE_RPC_URL)" };
  if (!ADDRESS_RE.test(input.wallet)) return { ok: false, reason: "wallet is not an address" };
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.txHash)) return { ok: false, reason: "tx_hash is not a transaction hash" };

  const doFetch = input.fetch ?? fetch;
  let receipt: ReceiptLike | null;
  try {
    const response = await doFetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [input.txHash],
      }),
    });
    const rpcBody = (await response.json()) as { result?: ReceiptLike } | null;
    receipt = rpcBody?.result ?? null;
  } catch (error) {
    return { ok: false, reason: `RPC unreachable: ${message(error)}` };
  }

  if (!receipt) return { ok: false, reason: "Transaction not found on chain" };
  if (receipt.status !== "0x1") return { ok: false, reason: "Transaction reverted" };

  const expected = BigInt(input.amountAtomic);
  const asset = input.asset.toLowerCase();
  const payer = padAddress(input.wallet);
  const recipient = padAddress(input.payTo);

  for (const log of receipt.logs ?? []) {
    if (log.address?.toLowerCase() !== asset) continue;
    if (log.topics.length !== 3) continue;
    if (log.topics[1]?.toLowerCase() !== payer) continue;
    if (log.topics[2]?.toLowerCase() !== recipient) continue;
    let value: bigint;
    try {
      value = BigInt(log.data && log.data !== "0x" ? log.data : "0x0");
    } catch {
      continue;
    }
    if (value === expected) {
      return {
        ok: true,
        amount_atomic: value.toString(),
        from: input.wallet,
        to: input.payTo,
        block: Number(BigInt(receipt.blockNumber ?? "0x0")),
      };
    }
  }
  return { ok: false, reason: "No matching USDC transfer from the buyer to the recipient in this transaction" };
}

/** An address as a 32-byte log topic: 0x-prefixed, zero-padded to 64 hex. */
function padAddress(address: string): string {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

// ── Receipts ─────────────────────────────────────────────────────────────────

/** The digital receipt issued once a payment settles. */
export interface WorkflowReceipt {
  id: string;
  checkout_id: string;
  tier: WorkflowTier;
  price_usd: number;
  currency: "USD";
  method: PaymentMethod;
  reference: string;
  paid_at: number;
  includes: string[];
  /** HMAC over the receipt body, so a buyer can verify it was issued by us. */
  signature: string;
}

/** Canonical body of a receipt — everything the signature covers. */
export function receiptBody(receipt: Omit<WorkflowReceipt, "signature">): string {
  return JSON.stringify({
    id: receipt.id,
    checkout_id: receipt.checkout_id,
    tier: receipt.tier,
    price_usd: receipt.price_usd,
    currency: receipt.currency,
    method: receipt.method,
    reference: receipt.reference,
    paid_at: receipt.paid_at,
    includes: receipt.includes,
  });
}

/** Sign a receipt with the receipt secret (falls back to AUTH_SECRET). */
export async function signReceipt(
  body: string,
  env: ProfessionalsPaymentEnv
): Promise<string> {
  const secret = env.RECEIPT_SIGNING_SECRET ?? env.AUTH_SECRET;
  if (!secret) throw new Error("RECEIPT_SIGNING_SECRET or AUTH_SECRET must be set");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return hex(new Uint8Array(mac));
}

/** Verify a receipt body against its signature. */
export async function verifyReceiptSignature(
  body: string,
  signature: string,
  env: ProfessionalsPaymentEnv
): Promise<boolean> {
  const expected = await signReceipt(body, env).catch(() => "");
  return expected !== "" && timingSafeEqual(expected, signature);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Networks the workflow can be paid on, for the tiers page. */
export const PAYMENT_NETWORKS = Object.entries(X402_NETWORKS).map(([id, net]) => ({
  id,
  network: net.caip2,
  asset: net.asset,
}));
