/**
 * Professionals workflow payment — /api/v1/professionals/payment
 *
 * One-time purchase of a workflow tier by a human buyer:
 *   GET  /tiers                     the four tiers, priced, with the crypto rule
 *   POST /checkout                  open a checkout (stripe | crypto)
 *   GET  /checkout                  this buyer's checkouts
 *   GET  /checkout/:id              one checkout, with its receipt when paid
 *   POST /checkout/:id/crypto       confirm a crypto payment (tx hash)
 *   GET  /entitlement               what the buyer has paid for and may use
 *   POST /stripe/webhook            Stripe settlement callback (signature-checked)
 *
 * One price per tier, one payment, one delivery — no seat, no subscription.
 */

import { Hono, type Context } from "hono";
import { getSessionUser } from "../lib/session";
import { ensureSessionIdentity, sessionIdentityExists } from "../db/sessions";
import {
  createStripeCheckout,
  cryptoInstructions,
  isPaidStripeEvent,
  isPaymentMethod,
  isWorkflowTier,
  quoteWorkflow,
  stripeCheckoutReference,
  receiptBody,
  signReceipt,
  verifyReceiptSignature,
  verifyStripeSignature,
  WORKFLOW_TIER_DEFS,
  WORKFLOW_TIERS,
  type ProfessionalsPaymentEnv,
  type WorkflowQuote,
} from "../lib/professionals-payment";
import {
  createWorkflowCheckout,
  getActiveEntitlement,
  getWorkflowCheckout,
  getWorkflowCheckoutByReference,
  listWorkflowCheckouts,
  markCheckoutPaid,
  saveWorkflowReceipt,
  type WorkflowCheckout,
} from "../db/professionals-payment";
import { confirmCryptoPayment } from "../lib/professionals-payment";

/** How long a checkout stays payable. */
const CHECKOUT_TTL_SECONDS = 24 * 60 * 60;

type App = Hono<{ Bindings: ProfessionalsPaymentEnv; Variables: { owner_sub: string } }>;
type Ctx = Context<{ Bindings: ProfessionalsPaymentEnv; Variables: { owner_sub: string } }>;

const payment: App = new Hono<{ Bindings: ProfessionalsPaymentEnv; Variables: { owner_sub: string } }>();

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

/** Public view of a checkout, without internal columns. */
function checkoutView(checkout: WorkflowCheckout, receipt: unknown = null) {
  return {
    id: checkout.id,
    tier: checkout.tier,
    price_usd: checkout.price_usd,
    currency: "USD",
    method: checkout.method,
    status: checkout.status,
    network: checkout.network,
    asset: checkout.asset,
    amount_atomic: checkout.amount_atomic,
    pay_to: checkout.pay_to,
    buyer_wallet: checkout.buyer_wallet,
    reference: checkout.reference,
    created_at: checkout.created_at,
    paid_at: checkout.paid_at,
    expires_at: checkout.expires_at,
    receipt,
  };
}

/** The public tiers list, priced with the crypto rule applied. */
function tiersView() {
  return {
    tiers: WORKFLOW_TIERS.map((tier) => {
      const quote = quoteWorkflow(tier);
      return {
        tier,
        price_usd: quote.price_usd,
        price_cents: quote.price_cents,
        components: quote.components,
        includes: quote.includes,
        one_time: true,
        subscription: false,
      };
    }),
  };
}

/** Settle a checkout and issue its digital receipt. Idempotent by status. */
async function deliver(c: Ctx, checkout: WorkflowCheckout, paymentReference: string) {
  const paid = await markCheckoutPaid(c.env.DB, checkout.id, paymentReference);
  if (!paid) {
    const already = await getWorkflowCheckout(c.env.DB, checkout.id);
    return { ok: false as const, checkout: already, reason: "already paid" };
  }

  const quote = quoteWorkflow(paid.tier, {
    ...(paid.domain_cost_usd !== null ? { domainCostUsd: paid.domain_cost_usd } : {}),
  });
  const body = receiptBody({
    id: paid.id,
    checkout_id: paid.id,
    tier: paid.tier,
    price_usd: paid.price_usd,
    currency: "USD",
    method: paid.method,
    reference: paid.payment_reference ?? paymentReference,
    paid_at: paid.paid_at ?? now(),
    includes: quote.includes,
  });
  const signature = await signReceipt(body, c.env);
  const receipt = await saveWorkflowReceipt(c.env.DB, {
    checkout_id: paid.id,
    owner_sub: paid.owner_sub,
    tier: paid.tier,
    price_usd: paid.price_usd,
    method: paid.method,
    reference: paid.payment_reference ?? paymentReference,
    body,
    signature,
  });
  return { ok: true as const, checkout: paid, receipt };
}

payment.get("/tiers", (c) => c.json(tiersView()));

// The Stripe webhook is called by Stripe, not a signed-in buyer.
payment.post("/stripe/webhook", async (c) => {
  const raw = await c.req.text();
  const signature = c.req.header("stripe-signature");
  if (!(await verifyStripeSignature(raw, signature, c.env.STRIPE_WEBHOOK_SECRET, now()))) {
    return c.json({ error: "Invalid Stripe signature" }, 400);
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  if (!isPaidStripeEvent(event)) return c.json({ received: true, ignored: true });

  const session = event.data.object;
  const reference = stripeCheckoutReference(event);
  if (!reference) return c.json({ error: "Stripe event has no checkout reference" }, 400);

  const checkout = await getWorkflowCheckoutByReference(c.env.DB, reference);
  if (!checkout) return c.json({ error: "Unknown checkout" }, 404);
  if (checkout.status === "paid") return c.json({ received: true, already_paid: true });

  const settled = await deliver(c, checkout, session.id ?? reference);
  return c.json({
    received: true,
    checkout_id: checkout.id,
    tier: settled.checkout?.tier ?? checkout.tier,
    delivered: settled.ok,
  });
});

payment.use("*", async (c, next) => {
  const user = c.env.SESSIONS ? await getSessionUser(c.env as { SESSIONS: KVNamespace }, c.req.raw) : null;
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (!(await sessionIdentityExists(c.env.DB, user.sub))) await ensureSessionIdentity(c.env.DB, user);
  c.set("owner_sub", user.sub);
  await next();
});

payment.get("/checkout", async (c) => {
  const checkouts = await listWorkflowCheckouts(c.env.DB, c.get("owner_sub"));
  return c.json({ checkouts: checkouts.map((row) => checkoutView(row)) });
});

payment.post("/checkout", async (c) => {
  const body = await readJson(c.req.raw);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);

  const tier = text(body.tier);
  if (!isWorkflowTier(tier)) {
    return c.json({ error: `tier must be one of ${WORKFLOW_TIERS.join(", ")}` }, 400);
  }
  const method = text(body.method) ?? "stripe";
  if (!isPaymentMethod(method)) return c.json({ error: "method must be stripe or crypto" }, 400);

  const domainCost = typeof body.domain_cost_usd === "number" ? body.domain_cost_usd : undefined;
  if (domainCost !== undefined && (!Number.isFinite(domainCost) || domainCost < 0)) {
    return c.json({ error: "domain_cost_usd must be a non-negative number" }, 400);
  }
  const quote = quoteWorkflow(tier, domainCost !== undefined ? { domainCostUsd: domainCost } : {});
  const wallet = text(body.wallet);

  if (method === "stripe") {
    const checkout = await createWorkflowCheckout(c.env.DB, {
      owner_sub: c.get("owner_sub"),
      tier,
      price_usd: quote.price_usd,
      price_cents: quote.price_cents,
      domain_cost_usd: domainCost ?? null,
      method,
      reference: `stripe:${tier}:${crypto.randomUUID()}`,
      expires_at: now() + CHECKOUT_TTL_SECONDS,
    });

    const session = await createStripeCheckout({
      checkoutId: checkout.id,
      tier,
      quote,
      env: c.env,
    });
    if (!session.ok) return c.json({ error: session.reason, checkout_id: checkout.id }, 502);

    return c.json({
      checkout: checkoutView(checkout),
      stripe: { session_id: session.sessionId, url: session.url },
    });
  }

  // Crypto
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return c.json({ error: "wallet is required for crypto payment" }, 400);
  }
  const reference = `crypto:${tier}:${crypto.randomUUID()}`;
  const instructions = cryptoInstructions(quote, c.env, reference, now() + CHECKOUT_TTL_SECONDS);
  if (!instructions.ok) return c.json({ error: instructions.reason }, 503);

  const checkout = await createWorkflowCheckout(c.env.DB, {
    owner_sub: c.get("owner_sub"),
    tier,
    price_usd: quote.price_usd,
    price_cents: quote.price_cents,
    domain_cost_usd: domainCost ?? null,
    method,
    network: instructions.instructions.network,
    asset: instructions.instructions.asset,
    pay_to: instructions.instructions.pay_to,
    amount_atomic: instructions.instructions.amount_atomic,
    buyer_wallet: wallet,
    reference,
    expires_at: instructions.instructions.expires_at,
  });

  return c.json({
    checkout: checkoutView(checkout),
    instructions: instructions.instructions,
  });
});

payment.get("/checkout/:id", async (c) => {
  const checkout = await getWorkflowCheckout(c.env.DB, c.req.param("id"));
  if (!checkout || checkout.owner_sub !== c.get("owner_sub")) {
    return c.json({ error: "Checkout not found" }, 404);
  }
  const receipt = await import("../db/professionals-payment").then((m) =>
    m.getWorkflowReceipt(c.env.DB, checkout.id)
  );
  return c.json({ checkout: checkoutView(checkout, receipt) });
});

payment.post("/checkout/:id/crypto", async (c) => {
  const checkout = await getWorkflowCheckout(c.env.DB, c.req.param("id"));
  if (!checkout || checkout.owner_sub !== c.get("owner_sub")) {
    return c.json({ error: "Checkout not found" }, 404);
  }
  if (checkout.method !== "crypto") return c.json({ error: "Not a crypto checkout" }, 400);
  if (checkout.status === "paid") return c.json({ error: "Checkout already paid" }, 409);
  if (!checkout.asset || !checkout.pay_to || !checkout.amount_atomic || !checkout.buyer_wallet) {
    return c.json({ error: "Checkout has no payment instructions" }, 409);
  }

  const body = await readJson(c.req.raw);
  const txHash = text(body?.tx_hash);
  if (!txHash) return c.json({ error: "tx_hash is required" }, 400);

  const confirmed = await confirmCryptoPayment({
    env: c.env,
    txHash,
    wallet: checkout.buyer_wallet,
    asset: checkout.asset,
    payTo: checkout.pay_to,
    amountAtomic: checkout.amount_atomic,
  });
  if (!confirmed.ok) return c.json({ error: confirmed.reason }, 402);

  const settled = await deliver(c, checkout, txHash);
  if (!settled.ok) return c.json({ error: settled.reason }, 409);

  return c.json({
    checkout: checkoutView(settled.checkout as WorkflowCheckout, settled.receipt),
    payment: {
      tx_hash: txHash,
      amount_atomic: confirmed.amount_atomic,
      block: confirmed.block,
      network: checkout.network,
    },
  });
});

payment.get("/entitlement", async (c) => {
  const checkout = await getActiveEntitlement(c.env.DB, c.get("owner_sub"));
  if (!checkout) {
    return c.json({ entitled: false, tier: null, includes: [], message: "No paid workflow yet" });
  }
  const quote: WorkflowQuote = quoteWorkflow(checkout.tier, {
    ...(checkout.domain_cost_usd !== null ? { domainCostUsd: checkout.domain_cost_usd } : {}),
  });
  return c.json({
    entitled: true,
    tier: checkout.tier,
    price_paid_usd: checkout.price_usd,
    method: checkout.method,
    paid_at: checkout.paid_at,
    includes: quote.includes,
    checkout_id: checkout.id,
  });
});

payment.get("/receipt/:id/verify", async (c) => {
  const { getWorkflowReceipt } = await import("../db/professionals-payment");
  const receipt = await getWorkflowReceipt(c.env.DB, c.req.param("id"));
  if (!receipt) return c.json({ error: "Receipt not found" }, 404);
  return c.json({
    valid: await verifyReceiptSignature(receipt.body, receipt.signature, c.env),
    receipt: JSON.parse(receipt.body) as Record<string, unknown>,
    signature: receipt.signature,
  });
});

export default payment;
export { WORKFLOW_TIER_DEFS };
