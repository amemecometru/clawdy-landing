/**
 * Professionals workflow payment store — one checkout row per purchase and one
 * digital receipt per settled payment. A paid checkout is the entitlement: the
 * tier it carries is what the buyer has access to.
 */

import { makeId, nowSeconds } from "../lib/brand";
import type { PaymentMethod, WorkflowTier } from "../lib/professionals-payment";

export type CheckoutStatus = "pending" | "paid" | "expired" | "failed";

/** One purchase attempt for a workflow tier. */
export interface WorkflowCheckout {
  id: string;
  owner_sub: string;
  tier: WorkflowTier;
  price_usd: number;
  price_cents: number;
  domain_cost_usd: number | null;
  method: PaymentMethod;
  status: CheckoutStatus;
  network: string | null;
  asset: string | null;
  pay_to: string | null;
  amount_atomic: string | null;
  buyer_wallet: string | null;
  reference: string;
  stripe_session_id: string | null;
  payment_reference: string | null;
  created_at: number;
  paid_at: number | null;
  expires_at: number;
}

/** The digital receipt for a settled payment. */
export interface WorkflowReceiptRow {
  id: string;
  checkout_id: string;
  owner_sub: string;
  tier: WorkflowTier;
  price_usd: number;
  method: PaymentMethod;
  reference: string;
  body: string;
  signature: string;
  created_at: number;
}

export interface NewWorkflowCheckout {
  owner_sub: string;
  tier: WorkflowTier;
  price_usd: number;
  price_cents: number;
  domain_cost_usd?: number | null;
  method: PaymentMethod;
  network?: string | null;
  asset?: string | null;
  pay_to?: string | null;
  amount_atomic?: string | null;
  buyer_wallet?: string | null;
  reference: string;
  stripe_session_id?: string | null;
  expires_at: number;
}

const CHECKOUT_COLUMNS = `id, owner_sub, tier, price_usd, price_cents, domain_cost_usd, method,
  status, network, asset, pay_to, amount_atomic, buyer_wallet, reference,
  stripe_session_id, payment_reference, created_at, paid_at, expires_at`;

function toCheckout(row: Record<string, unknown>): WorkflowCheckout {
  return {
    id: String(row.id),
    owner_sub: String(row.owner_sub),
    tier: row.tier as WorkflowTier,
    price_usd: Number(row.price_usd),
    price_cents: Number(row.price_cents),
    domain_cost_usd: row.domain_cost_usd === null || row.domain_cost_usd === undefined ? null : Number(row.domain_cost_usd),
    method: row.method as PaymentMethod,
    status: row.status as CheckoutStatus,
    network: (row.network as string | null) ?? null,
    asset: (row.asset as string | null) ?? null,
    pay_to: (row.pay_to as string | null) ?? null,
    amount_atomic: (row.amount_atomic as string | null) ?? null,
    buyer_wallet: (row.buyer_wallet as string | null) ?? null,
    reference: String(row.reference),
    stripe_session_id: (row.stripe_session_id as string | null) ?? null,
    payment_reference: (row.payment_reference as string | null) ?? null,
    created_at: Number(row.created_at),
    paid_at: row.paid_at === null || row.paid_at === undefined ? null : Number(row.paid_at),
    expires_at: Number(row.expires_at),
  };
}

/** Open a checkout for a tier. */
export async function createWorkflowCheckout(
  db: D1Database,
  input: NewWorkflowCheckout
): Promise<WorkflowCheckout> {
  const id = makeId("chk");
  const now = nowSeconds();
  await db
    .prepare(
      `INSERT INTO professionals_checkout (
        id, owner_sub, tier, price_usd, price_cents, domain_cost_usd, method, status,
        network, asset, pay_to, amount_atomic, buyer_wallet, reference,
        stripe_session_id, payment_reference, created_at, paid_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
    )
    .bind(
      id,
      input.owner_sub,
      input.tier,
      input.price_usd,
      input.price_cents,
      input.domain_cost_usd ?? null,
      input.method,
      input.network ?? null,
      input.asset ?? null,
      input.pay_to ?? null,
      input.amount_atomic ?? null,
      input.buyer_wallet ?? null,
      input.reference,
      input.stripe_session_id ?? null,
      now,
      null,
      input.expires_at
    )
    .run();

  const created = await getWorkflowCheckout(db, id);
  if (!created) throw new Error("checkout insert failed");
  return created;
}

/** One checkout by id. */
export async function getWorkflowCheckout(
  db: D1Database,
  id: string
): Promise<WorkflowCheckout | null> {
  const row = await db
    .prepare(`SELECT ${CHECKOUT_COLUMNS} FROM professionals_checkout WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  return row ? toCheckout(row) : null;
}

/**
 * One checkout by any handle it can be addressed by: its own id, the reference
 * we generated, the Stripe session id, or the payment that settled it.
 */
export async function getWorkflowCheckoutByReference(
  db: D1Database,
  reference: string
): Promise<WorkflowCheckout | null> {
  const row = await db
    .prepare(
      `SELECT ${CHECKOUT_COLUMNS} FROM professionals_checkout
       WHERE id = ? OR reference = ? OR stripe_session_id = ? OR payment_reference = ?
       LIMIT 1`
    )
    .bind(reference, reference, reference, reference)
    .first<Record<string, unknown>>();
  return row ? toCheckout(row) : null;
}

/** Every checkout for an owner, newest first. */
export async function listWorkflowCheckouts(
  db: D1Database,
  ownerSub: string,
  limit = 50
): Promise<WorkflowCheckout[]> {
  const rows = await db
    .prepare(
      `SELECT ${CHECKOUT_COLUMNS} FROM professionals_checkout
       WHERE owner_sub = ? ORDER BY created_at DESC LIMIT ?`
    )
    .bind(ownerSub, limit)
    .all<Record<string, unknown>>();
  return (rows?.results ?? []).map(toCheckout);
}

/** The most recent paid checkout for an owner — the active entitlement. */
export async function getActiveEntitlement(
  db: D1Database,
  ownerSub: string
): Promise<WorkflowCheckout | null> {
  const row = await db
    .prepare(
      `SELECT ${CHECKOUT_COLUMNS} FROM professionals_checkout
       WHERE owner_sub = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT 1`
    )
    .bind(ownerSub)
    .first<Record<string, unknown>>();
  return row ? toCheckout(row) : null;
}

/**
 * Mark a checkout paid, recording the payment reference. Returns null when the
 * checkout is already settled, so a duplicate webhook or a second crypto
 * confirmation cannot deliver the tier twice.
 */
export async function markCheckoutPaid(
  db: D1Database,
  id: string,
  paymentReference: string
): Promise<WorkflowCheckout | null> {
  const existing = await getWorkflowCheckout(db, id);
  if (!existing || existing.status === "paid") return null;

  await db
    .prepare(
      `UPDATE professionals_checkout
       SET status = 'paid', paid_at = ?, payment_reference = ?
       WHERE id = ? AND status != 'paid'`
    )
    .bind(nowSeconds(), paymentReference, id)
    .run();

  return getWorkflowCheckout(db, id);
}

/** Store the digital receipt for a settled checkout. */
export async function saveWorkflowReceipt(
  db: D1Database,
  input: {
    checkout_id: string;
    owner_sub: string;
    tier: WorkflowTier;
    price_usd: number;
    method: PaymentMethod;
    reference: string;
    body: string;
    signature: string;
  }
): Promise<WorkflowReceiptRow> {
  const existing = await getWorkflowReceipt(db, input.checkout_id);
  if (existing) return existing;
  const id = makeId("rcpt");
  await db
    .prepare(
      `INSERT INTO professionals_receipts
         (id, checkout_id, owner_sub, tier, price_usd, method, reference, body, signature, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.checkout_id,
      input.owner_sub,
      input.tier,
      input.price_usd,
      input.method,
      input.reference,
      input.body,
      input.signature,
      nowSeconds()
    )
    .run();
  const saved = await getWorkflowReceipt(db, input.checkout_id);
  if (!saved) throw new Error("receipt insert failed");
  return saved;
}

/** The receipt for a checkout, or null. */
export async function getWorkflowReceipt(
  db: D1Database,
  checkoutId: string
): Promise<WorkflowReceiptRow | null> {
  const row = await db
    .prepare(
      `SELECT id, checkout_id, owner_sub, tier, price_usd, method, reference, body, signature, created_at
       FROM professionals_receipts WHERE checkout_id = ?`
    )
    .bind(checkoutId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    id: String(row.id),
    checkout_id: String(row.checkout_id),
    owner_sub: String(row.owner_sub),
    tier: row.tier as WorkflowTier,
    price_usd: Number(row.price_usd),
    method: row.method as PaymentMethod,
    reference: String(row.reference),
    body: String(row.body),
    signature: String(row.signature),
    created_at: Number(row.created_at),
  };
}
