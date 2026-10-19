/**
 * x402 payment rail — prices, the 402 payment-required body, facilitator
 * verification and settlement, gateway payment-context validation, idempotency
 * records, Bazaar discovery metadata, and the buyer-side client.
 *
 * Everything x402 lives in this module so the settlement rail can be swapped
 * without touching callers (src/api/mcp.ts only calls the functions below).
 *
 * Rail: USDC on Base. 6 decimals, so one USD = 1_000_000 atomic units.
 * Settlement network is chosen from the environment:
 *   X402_NETWORK=base-sepolia (default) → CAIP-2 eip155:84532
 *   X402_NETWORK=base + X402_MAINNET=true → CAIP-2 eip155:8453
 *
 * Verification and settlement are performed by the official x402 SDK
 * (@x402/core resource server + @x402/evm exact scheme, HTTP facilitator).
 * EIP-3009 signature checking, the 402/verify/settle flow, and the wire shapes
 * are the SDK's job — nothing here reimplements them.
 *
 * Transport: the SDK's MCP helper (@x402/mcp createPaymentWrapper) settles as
 * soon as the handler it wraps returns, which here would charge a HITL-
 * intercepted call at approval-queue time rather than at execution, and it
 * answers a challenge with a JSON-RPC error instead of the HTTP 402 this
 * surface returns. The resource-server calls underneath it — build the 402,
 * match the requirements, verify, settle — are used directly instead, which
 * keeps the HITL gate between verification and settlement.
 */

import { TOOL_DEFS } from "../api/tools";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import type {
  Network,
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  ResourceInfo,
  SettleResponse,
} from "@x402/core/types";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";

/** x402 protocol version this gate speaks. */
export const X402_VERSION = 2;

/** Scheme name for exact payment on a specific network. */
export const X402_SCHEME = "exact";

/** Atomic units per USD — USDC has 6 decimals on Base. */
const ATOMIC_PER_USD = 1_000_000;

/** Decimal places in a USDC amount. */
const ATOMIC_PER_USD_DIGITS = 6;

/** Payment-required window handed to the buyer, in seconds. */
export const X402_MAX_TIMEOUT_SECONDS = 60;

/**
 * Settlement networks this rail knows how to charge on, by name.
 *
 * Both assets are USDC (6 decimals). Testnet USDC for a buyer wallet comes from
 * the Circle testnet faucet: https://faucet.circle.com/ — pick Base Sepolia and
 * fund the wallet you pass in as X402_BUYER_PRIVATE_KEY. Wallet keys are read
 * from the environment only; no key or faucet secret lives in this repository.
 */
export const X402_NETWORKS = {
  "base-sepolia": {
    caip2: "eip155:84532" as Network,
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  base: {
    caip2: "eip155:8453" as Network,
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
} as const;

/** Network name used when X402_NETWORK is unset. */
export const X402_DEFAULT_NETWORK = "base-sepolia" as const;

/**
 * Settlement facilitator used when X402_FACILITATOR_URL is unset.
 *
 * PayAI, not the public x402.org facilitator — the latter failed roughly one
 * call in three. Supports base-sepolia (v1) and eip155:84532 (v2 exact),
 * carries the bazaar extension, needs no API key, and is free on testnet.
 * Override per-environment with the X402_FACILITATOR_URL secret.
 */
export const X402_DEFAULT_FACILITATOR = "https://facilitator.payai.network";

/** USDC on Base mainnet (the Base Sepolia asset is in X402_NETWORKS). */
export const X402_ASSET = X402_NETWORKS.base.asset;

/** Network CAIP-2 identifiers, keyed by network name. */
export type X402NetworkName = keyof typeof X402_NETWORKS;

/** Tool names → price per call in USD, 6 decimal places (from the registry). */
const PRICE_USD: ReadonlyMap<string, number> = new Map(
  TOOL_DEFS.map((t) => [t.name, t.x402_price_usd])
);

/**
 * Price of one call in USD, or null when the tool is not in the registry.
 * Registry `name` is the key; MCP execution names are identical by construction.
 */
export function priceUsd(toolName: string): number | null {
  return PRICE_USD.get(toolName) ?? null;
}

/**
 * Whether a call to this tool must pass the payment gate.
 * $0 tools and tools absent from the registry skip it entirely.
 */
export function requiresPayment(usd: number | null): boolean {
  return usd !== null && usd > 0;
}

/**
 * Convert a USD price to USDC atomic units as a decimal string.
 *
 * Scaled at the 6-decimal wire precision via string math rather than
 * `Math.ceil(usd * 1e6)`: binary floats drift upward on ~1% of 6-decimal
 * prices (0.000123 * 1e6 === 123.00000000000001), which a ceil would
 * overcharge by one atomic unit. Splitting on the decimal point keeps the
 * conversion exact.
 */
export function toAtomicUnits(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new RangeError(`Invalid USD price: ${usd}`);
  }
  const [whole, frac = ""] = usd.toFixed(6).split(".");
  const micros = BigInt(whole || "0") * BigInt(ATOMIC_PER_USD) + BigInt(frac.padEnd(6, "0"));
  return micros.toString();
}

// ── Environment ──────────────────────────────────────────────────────────────

/** Environment bindings and vars the x402 rail reads. */
export interface X402Env {
  /** Recipient wallet. The only source of `payTo` — never hardcoded. */
  X402_PAY_TO_ADDRESS?: string;
  /** Facilitator base URL (defaults to the public testnet facilitator). */
  X402_FACILITATOR_URL?: string;
  /** "base-sepolia" (default) or "base". */
  X402_NETWORK?: string;
  /** Exactly "true" selects mainnet. Any other value (or unset) stays on testnet. */
  X402_MAINNET?: string;
  /** Exactly "true" disables the gate locally. Never a production setting. */
  X402_DEV_BYPASS?: string;
  /** Per-request facilitator timeout in milliseconds (default 20000). */
  X402_FACILITATOR_TIMEOUT_MS?: string;
  /** JWKS endpoint for Cloudflare Monetization Gateway PAYMENT-CONTEXT JWTs. */
  X402_PAYMENT_CONTEXT_JWKS_URL?: string;
  /** Expected PAYMENT-CONTEXT `iss` claim. */
  X402_PAYMENT_CONTEXT_ISSUER?: string;
  /** Expected PAYMENT-CONTEXT `aud` claim (defaults to the request resource URL). */
  X402_PAYMENT_CONTEXT_AUDIENCE?: string;
  /** KV namespace holding idempotency records. */
  X402_IDEMPOTENCY?: KVNamespace;
  /** Buyer wallet key, used only by withX402Client / the testnet script. */
  X402_BUYER_PRIVATE_KEY?: string;
  /** RPC URL for buyer-side reads (permit2 allowances). */
  X402_BUYER_RPC_URL?: string;
}

/** A fully resolved settlement rail: network, asset, recipient, facilitator. */
export interface X402Config {
  networkName: X402NetworkName;
  network: Network;
  asset: string;
  payTo: string;
  facilitatorUrl: string;
  timeoutMs: number;
  mainnet: boolean;
}

/** Result of resolving the rail from the environment. */
export type X402ConfigResult = { ok: true; config: X402Config } | { ok: false; reason: string };

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Whether mainnet settlement is explicitly enabled. */
export function mainnetEnabled(env: X402Env): boolean {
  return env.X402_MAINNET === "true";
}

/**
 * The settlement network named by the environment.
 *
 * base-sepolia is the default; base (mainnet) additionally requires
 * X402_MAINNET=true, so a stray X402_NETWORK=base alone never spends real money.
 * Anything unrecognised fails closed.
 */
export function resolveNetworkName(
  env: X402Env
): { ok: true; name: X402NetworkName } | { ok: false; reason: string } {
  const requested = (env.X402_NETWORK ?? X402_DEFAULT_NETWORK).trim();
  const mainnet = mainnetEnabled(env);

  if (requested !== X402_DEFAULT_NETWORK && requested !== "base") {
    return { ok: false, reason: `X402_NETWORK=${JSON.stringify(requested)} is not a known network` };
  }
  if (requested === "base" && !mainnet) {
    return { ok: false, reason: "X402_NETWORK=base requires X402_MAINNET=true" };
  }
  return { ok: true, name: mainnet ? "base" : (requested as X402NetworkName) };
}

/**
 * Resolve the settlement rail from the environment: network, asset,
 * recipient and facilitator.
 */
export function resolveX402Config(env: X402Env): X402ConfigResult {
  const networkResult = resolveNetworkName(env);
  if (!networkResult.ok) return networkResult;

  const mainnet = mainnetEnabled(env);
  const network = X402_NETWORKS[networkResult.name];

  const payTo = (env.X402_PAY_TO_ADDRESS ?? "").trim();
  if (!ADDRESS_RE.test(payTo)) {
    return { ok: false, reason: "X402_PAY_TO_ADDRESS is missing or not a 20-byte address" };
  }

  const timeoutMs = Number(env.X402_FACILITATOR_TIMEOUT_MS ?? "");
  if (env.X402_FACILITATOR_TIMEOUT_MS && (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)) {
    return { ok: false, reason: "X402_FACILITATOR_TIMEOUT_MS must be a positive integer" };
  }

  const facilitatorUrl = (env.X402_FACILITATOR_URL ?? X402_DEFAULT_FACILITATOR).trim().replace(/\/+$/, "");

  return {
    ok: true,
    config: {
      networkName: networkResult.name,
      network: network.caip2,
      asset: network.asset,
      payTo,
      facilitatorUrl,
      timeoutMs: Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20_000,
      mainnet,
    },
  };
}

/**
 * Whether the payment gate is disabled. Local testing only — never enable in
 * production; an unset, empty, or non-"true" value fails closed (gate on).
 */
export function devBypassEnabled(env: { X402_DEV_BYPASS?: string }): boolean {
  return env.X402_DEV_BYPASS === "true";
}

// ── Payment requirements + the 402 body ──────────────────────────────────────

/** Resource metadata advertised alongside the payment options. */
export function resourceInfo(url: string, description?: string): ResourceInfo {
  return { url, description, mimeType: "application/json" };
}

/** EVM exact scheme, used for asset/EIP-712 lookups and server registration. */
const exactScheme = new ExactEvmScheme();

/**
 * Render an atomic amount back as a 6-decimal string, the exact inverse of
 * toAtomicUnits(): "20000" becomes "0.020000".
 */
function atomicToDecimal(micros: string): string {
  const padded = micros.padStart(ATOMIC_PER_USD_DIGITS + 1, "0");
  return `${padded.slice(0, -ATOMIC_PER_USD_DIGITS)}.${padded.slice(-ATOMIC_PER_USD_DIGITS)}`;
}

/**
 * The payment options for one call: scheme, network, amount in atomic units,
 * asset, recipient and timeout.
 *
 * toAtomicUnits() owns the price conversion; its result is rendered back to a
 * decimal string and handed to the SDK, whose own string math lands on the same
 * integer. The asset address and its EIP-712 domain (name/version) come from
 * the SDK's asset table for the configured network. Requirements are built here
 * rather than through buildPaymentRequirements() so the 402 path needs no
 * facilitator round trip — the literal is what that call returns.
 */
export async function paymentRequirements(
  usd: number,
  config: X402Config
): Promise<PaymentRequirements> {
  const parsed = await exactScheme.parsePrice(atomicToDecimal(toAtomicUnits(usd)), config.network);
  if (parsed.asset.toLowerCase() !== config.asset.toLowerCase()) {
    throw new Error(
      `Asset ${parsed.asset} resolved for ${config.network} does not match the configured USDC asset ${config.asset}`
    );
  }
  return {
    scheme: exactScheme.scheme,
    network: config.network,
    asset: parsed.asset,
    amount: parsed.amount,
    payTo: config.payTo,
    maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
    extra: parsed.extra ?? {},
  };
}

/**
 * Bazaar discovery metadata for a tool, published in the 402 body's
 * `extensions` so the Bazaar can index the tool instead of a static manifest.
 */
export function discoveryExtension(toolName: string): Record<string, unknown> {
  const tool = TOOL_DEFS.find((t) => t.name === toolName);
  return declareDiscoveryExtension({
    toolName: tool?.mcpName ?? toolName,
    description: tool?.description,
    transport: "mcp",
    inputSchema: (tool?.inputSchema ?? { type: "object" }) as Record<string, unknown>,
  });
}

// ── Resource server (SDK) ────────────────────────────────────────────────────

const serverCache = new Map<string, x402ResourceServer>();

/**
 * Resource server for one facilitator URL + network, built once per isolate.
 * Registered: the EVM `exact` scheme for the configured network, and the Bazaar
 * resource-server extension that enriches discovery metadata.
 */
function resourceServerFor(config: X402Config): x402ResourceServer {
  const cacheKey = `${config.facilitatorUrl}|${config.network}`;
  const cached = serverCache.get(cacheKey);
  if (cached) return cached;

  const server = new x402ResourceServer(
    new HTTPFacilitatorClient({ url: config.facilitatorUrl, timeoutMs: config.timeoutMs })
  )
    .register(config.network, exactScheme)
    .registerExtension(bazaarResourceServerExtension);

  serverCache.set(cacheKey, server);
  return server;
}

// ── Payment payload extraction ───────────────────────────────────────────────

/** v2 header carrying the signed payment payload; v1 name kept for old clients. */
const PAYMENT_SIGNATURE_HEADERS = ["payment-signature", "x-payment"] as const;

/** Header Cloudflare Monetization Gateway adds after its own verification. */
const PAYMENT_CONTEXT_HEADER = "payment-context";

/** Header carrying the settlement receipt back to the buyer. */
export const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";

/** Header carrying the 402 payment-required declaration. */
export const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";

/** MCP request `_meta` key carrying the payment payload. */
const MCP_PAYMENT_META_KEY = "x402/payment";

/**
 * Read the signed payment payload from a request: the v2 PAYMENT-SIGNATURE
 * header, the legacy X-PAYMENT header, or the MCP `_meta["x402/payment"]`
 * entry. Returns null when absent, not base64, not JSON, or not an object.
 */
export function extractPaymentPayload(
  req: Request,
  meta?: Record<string, unknown>
): PaymentPayload | null {
  const fromMeta = meta?.[MCP_PAYMENT_META_KEY];
  if (fromMeta && typeof fromMeta === "object") return fromMeta as PaymentPayload;

  let encoded: string | null = null;
  for (const name of PAYMENT_SIGNATURE_HEADERS) {
    encoded = req.headers.get(name);
    if (encoded) break;
  }
  if (!encoded) return null;

  try {
    const parsed = JSON.parse(atob(encoded)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as PaymentPayload;
  } catch {
    return null;
  }
}

/**
 * Build the payment-required body a caller receives with the 402.
 * The wire shape is produced by the SDK resource server.
 */
export async function paymentRequiredBody(
  toolName: string,
  usd: number,
  ctx: { config: X402Config; resource: string }
): Promise<PaymentRequired> {
  const server = resourceServerFor(ctx.config);
  const requirements = await paymentRequirements(usd, ctx.config);
  return server.createPaymentRequiredResponse(
    [requirements],
    resourceInfo(ctx.resource, `${toolName} — $${usd.toFixed(6)} USD`),
    `Payment required for tool: ${toolName}`,
    discoveryExtension(toolName),
    { toolName, transport: "mcp" }
  );
}

/** Response headers to attach to a 402 payment-required response. */
export function paymentRequiredHeaders(body: PaymentRequired): Record<string, string> {
  return {
    [PAYMENT_REQUIRED_HEADER]: encodePaymentRequiredHeader(body),
    "cache-control": "no-store",
  };
}

// ── PAYMENT-CONTEXT (Cloudflare Monetization Gateway) ────────────────────────

/** Pinned JWKS published by the Monetization Gateway. */
export const X402_PAYMENT_CONTEXT_JWKS_URL = "https://payments.cloudflare.com/certs";

/** Expected `iss` when the environment does not override it. */
export const X402_PAYMENT_CONTEXT_ISSUER = "https://payments.cloudflare.com";

/** Claims carried by the gateway's payment-context JWT. */
export interface PaymentContextClaims extends JWTPayload {
  scheme?: string;
  amount?: string;
}

export type PaymentContextResult =
  | { ok: true; claims: PaymentContextClaims }
  | { ok: false; reason: string };

/** Injection seam so tests can verify against a local key instead of the JWKS. */
export interface PaymentContextOptions {
  jwksUrl?: string;
  issuer?: string;
  audience?: string;
  /** Expected amount in atomic units — the JWT must authorize exactly this. */
  amount?: string;
  /** Expected scheme — the JWT must authorize the scheme this gate charges. */
  scheme?: string;
  /** Local key resolver, replacing the remote JWKS fetch. */
  getKey?: JWTVerifyGetKey;
}

let remoteJwks: JWTVerifyGetKey | null = null;
let remoteJwksUrl = "";

function keyResolver(opts: PaymentContextOptions): JWTVerifyGetKey {
  if (opts.getKey) return opts.getKey;
  const url = opts.jwksUrl ?? X402_PAYMENT_CONTEXT_JWKS_URL;
  if (!remoteJwks || remoteJwksUrl !== url) {
    remoteJwks = createRemoteJWKSet(new URL(url));
    remoteJwksUrl = url;
  }
  return remoteJwks;
}

/**
 * Validate a Monetization Gateway PAYMENT-CONTEXT JWT.
 *
 * The header is a JWT signed by the gateway with Ed25519, checked against the
 * pinned JWKS; expiry/not-before come from the standard claims. The `amount`,
 * `scheme` and audience must match what this call was quoted, so a context
 * minted for another resource or another price cannot be replayed here.
 *
 * A missing header is not an error here: the caller decides whether this
 * deployment is gateway-fronted. Anything that is present but not verifiable
 * fails closed.
 */
export async function verifyPaymentContext(
  token: string | null | undefined,
  opts: PaymentContextOptions
): Promise<PaymentContextResult> {
  if (!token) return { ok: false, reason: "Missing PAYMENT-CONTEXT header" };

  try {
    const { payload } = await jwtVerify(token, keyResolver(opts), {
      algorithms: ["EdDSA"],
      issuer: opts.issuer ?? X402_PAYMENT_CONTEXT_ISSUER,
      ...(opts.audience ? { audience: opts.audience } : {}),
    });

    const claims = payload as PaymentContextClaims;
    if (opts.audience && claims.aud !== opts.audience) {
      return { ok: false, reason: `PAYMENT-CONTEXT audience mismatch: ${String(claims.aud)}` };
    }
    if (opts.scheme && claims.scheme !== opts.scheme) {
      return { ok: false, reason: `PAYMENT-CONTEXT scheme mismatch: ${String(claims.scheme)}` };
    }
    if (opts.amount !== undefined && claims.amount !== opts.amount) {
      return { ok: false, reason: `PAYMENT-CONTEXT amount mismatch: ${String(claims.amount)}` };
    }
    return { ok: true, claims };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PAYMENT-CONTEXT validation failed";
    return { ok: false, reason: `PAYMENT-CONTEXT rejected: ${reason}` };
  }
}

// ── Verification + settlement ────────────────────────────────────────────────

/** A payment the facilitator accepted, plus what it was accepted against. */
export interface VerifiedPayment {
  /** Tool the payment was quoted for. */
  toolName: string;
  payload: PaymentPayload;
  requirements: PaymentRequirements;
  paymentRequired: PaymentRequired;
  extensions: Record<string, unknown>;
  payer?: string;
  idempotencyKey?: string;
}

/** Outcome of a payment-authorization check. */
export type X402Verification =
  | ({ ok: true } & VerifiedPayment)
  | { ok: false; reason: string };

/** Inputs for one gate decision on one tool call. */
export interface VerifyX402Options {
  toolName: string;
  usd: number;
  env: X402Env;
  /** Resource URL advertised in the 402 (origin + /mcp/v1). */
  resource: string;
  /** MCP request params._meta, when the call arrived over MCP. */
  meta?: Record<string, unknown>;
  /** True when the request is fronted by the Monetization Gateway. */
  gatewayFronted?: boolean;
  config?: X402Config;
}

const IDEMPOTENCY_HEADERS = ["idempotency-key", "x-idempotency-key"] as const;
const IDEMPOTENCY_META_KEYS = ["idempotency-key", "x402/idempotency-key"] as const;

/**
 * The caller's idempotency key, from the Idempotency-Key header or the MCP
 * `_meta` entry. Absent means the caller did not ask for replay protection.
 */
export function idempotencyKeyFrom(req: Request, meta?: Record<string, unknown>): string | null {
  for (const name of IDEMPOTENCY_HEADERS) {
    const value = req.headers.get(name)?.trim();
    if (value) return value.slice(0, 200);
  }
  for (const key of IDEMPOTENCY_META_KEYS) {
    const value = meta?.[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 200);
  }
  return null;
}

/**
 * Verify a call's payment against the facilitator.
 *
 * The payment payload must match the quoted requirements exactly (scheme,
 * network, asset, amount, recipient); the facilitator then checks the EIP-3009
 * signature and balance coverage. Every failure — absent header, malformed
 * proof, unmatched requirements, facilitator error or timeout, invalid
 * signature — returns `{ok: false}` so the caller answers 402 and never runs.
 */
export async function verifyX402Payment(
  req: Request,
  opts: VerifyX402Options
): Promise<X402Verification> {
  const configResult = opts.config ? { ok: true as const, config: opts.config } : resolveX402Config(opts.env);
  if (!configResult.ok) return { ok: false, reason: configResult.reason };

  const config = configResult.config;
  const paymentPayload = extractPaymentPayload(req, opts.meta);
  if (!paymentPayload) {
    return { ok: false, reason: "Missing or malformed payment signature header" };
  }
  if (paymentPayload.x402Version !== X402_VERSION) {
    return { ok: false, reason: `Unsupported x402 version: ${String(paymentPayload.x402Version)}` };
  }

  let requirements: PaymentRequirements;
  try {
    requirements = await paymentRequirements(opts.usd, config);
  } catch (error) {
    return { ok: false, reason: `Payment requirements could not be built: ${describe(error)}` };
  }
  const extensions = discoveryExtension(opts.toolName);

  if (opts.gatewayFronted) {
    const context = await verifyPaymentContext(req.headers.get(PAYMENT_CONTEXT_HEADER), {
      amount: requirements.amount,
      scheme: requirements.scheme,
      audience: opts.env.X402_PAYMENT_CONTEXT_AUDIENCE ?? opts.resource,
      ...(opts.env.X402_PAYMENT_CONTEXT_JWKS_URL
        ? { jwksUrl: opts.env.X402_PAYMENT_CONTEXT_JWKS_URL }
        : {}),
      ...(opts.env.X402_PAYMENT_CONTEXT_ISSUER
        ? { issuer: opts.env.X402_PAYMENT_CONTEXT_ISSUER }
        : {}),
    });
    if (!context.ok) return { ok: false, reason: context.reason };
  }

  const server = resourceServerFor(config);
  let paymentRequired: PaymentRequired;
  try {
    paymentRequired = await server.createPaymentRequiredResponse(
      [requirements],
      resourceInfo(opts.resource, `${opts.toolName} — $${opts.usd.toFixed(6)} USD`),
      undefined,
      extensions,
      { toolName: opts.toolName, transport: "mcp" }
    );
  } catch (error) {
    return { ok: false, reason: `Payment requirements could not be built: ${describe(error)}` };
  }

  // Exact match on scheme / network / asset / amount / recipient: a payload
  // signed for a different price, asset, chain or payTo never reaches verify.
  const matched = server.findMatchingRequirements(paymentRequired.accepts, paymentPayload);
  if (!matched) {
    return { ok: false, reason: "Payment does not match the quoted payment requirements" };
  }

  try {
    const result = await server.verifyPayment(paymentPayload, matched, extensions, {
      toolName: opts.toolName,
      transport: "mcp",
    });
    if (!result.isValid) {
      return {
        ok: false,
        reason: `Facilitator rejected the payment: ${result.invalidReason ?? result.invalidMessage ?? "invalid"}`,
      };
    }
    const idempotencyKey = idempotencyKeyFrom(req, opts.meta);
    return {
      ok: true,
      toolName: opts.toolName,
      payload: paymentPayload,
      requirements: matched,
      paymentRequired,
      extensions,
      ...(result.payer ? { payer: result.payer } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };
  } catch (error) {
    return { ok: false, reason: `Facilitator verification failed: ${describe(error)}` };
  }
}

/**
 * Settle a verified payment through the facilitator.
 *
 * Callers settle only after the tool actually produced its result; a call that
 * was intercepted for HITL approval returns before this point and is not
 * charged. A failed settlement is reported to the caller, not swallowed.
 */
export async function settleVerifiedPayment(
  verified: VerifiedPayment,
  opts: { env: X402Env; config?: X402Config }
): Promise<SettleResponse> {
  const configResult = opts.config ? { ok: true as const, config: opts.config } : resolveX402Config(opts.env);
  if (!configResult.ok) throw new Error(configResult.reason);
  const server = resourceServerFor(configResult.config);
  return server.settlePayment(verified.payload, verified.requirements, verified.extensions, {
    toolName: verified.toolName,
    transport: "mcp",
  });
}

/** Headers announcing a completed settlement to the buyer. */
export function settlementHeaders(settlement: SettleResponse): Record<string, string> {
  return { [PAYMENT_RESPONSE_HEADER]: encodePaymentResponseHeader(settlement) };
}

// ── Idempotency ──────────────────────────────────────────────────────────────

/**
 * Replay protection for paid calls. Records are written on settlement — the
 * point where money has moved — and a replayed key returns the stored result
 * without re-executing the tool or settling a second time.
 *
 * Storage: KV (X402_IDEMPOTENCY) when bound, which is shared across isolates;
 * an in-memory map with a TTL otherwise, which only protects a single isolate.
 */
export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>;
  put(key: string, record: IdempotencyRecord): Promise<void>;
}

/** One settled call, keyed by idempotency key + tool + argument fingerprint. */
export interface IdempotencyRecord {
  tool: string;
  fingerprint: string;
  /** Serialized tool result, returned byte-for-byte on replay. */
  result: string;
  settlement: SettleResponse;
  createdAt: number;
}

/** How long a replay record stays honoured without bound. */
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const memoryRecords = new Map<string, { record: IdempotencyRecord; expiresAt: number }>();

/** KV-backed store when bound, in-memory with TTL otherwise. */
export function createIdempotencyStore(env: X402Env): IdempotencyStore {
  const kv = env.X402_IDEMPOTENCY;
  if (!kv) {
    return {
      async get(key) {
        const hit = memoryRecords.get(key);
        if (!hit) return null;
        if (hit.expiresAt <= Date.now()) {
          memoryRecords.delete(key);
          return null;
        }
        return hit.record;
      },
      async put(key, record) {
        memoryRecords.set(key, { record, expiresAt: Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000 });
      },
    };
  }
  const prefix = "x402:idem:";
  return {
    async get(key) {
      const raw = await kv.get(prefix + key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as IdempotencyRecord;
      } catch {
        return null;
      }
    },
    async put(key, record) {
      await kv.put(prefix + key, JSON.stringify(record), { expirationTtl: IDEMPOTENCY_TTL_SECONDS });
    },
  };
}

/** Stable fingerprint of the tool arguments, for key reuse with other params. */
export function paramsFingerprint(toolName: string, args: Record<string, unknown>): string {
  return `${toolName}:${stableStringify(args)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** Outcome of a replay lookup. */
export type IdempotencyLookup =
  | { status: "miss" }
  | { status: "replay"; record: IdempotencyRecord }
  | { status: "conflict" };

/**
 * Look up a prior call under the same idempotency key.
 * A key reused with different arguments is a conflict, not a replay.
 */
export async function lookupIdempotent(
  store: IdempotencyStore,
  key: string,
  fingerprint: string
): Promise<IdempotencyLookup> {
  const record = await store.get(key);
  if (!record) return { status: "miss" };
  return record.fingerprint === fingerprint ? { status: "replay", record } : { status: "conflict" };
}

/** Write the record a later replay of this call will be served from. */
export async function recordIdempotent(
  store: IdempotencyStore,
  key: string,
  record: IdempotencyRecord
): Promise<void> {
  await store.put(key, record);
}

// ── Buyer side ───────────────────────────────────────────────────────────────

/** Confirmation callback: sees the quoted requirements before money moves. */
export type X402Confirm = (paymentRequired: PaymentRequired) => boolean | Promise<boolean> | null;

export interface X402BuyerOptions {
  env: X402Env;
  /**
   * Confirmation callback. Return true to pay, false to decline. Passing null
   * auto-pays without asking: any seller on the route can drain the wallet up
   * to the spend cap in a single call, so use a callback for live wallets.
   */
  confirm: X402Confirm | null;
  /** Per-payment USD cap (SDK spend control). Default "$1". */
  maxAmountUsd?: string;
  /** Assets the buyer will pay in, on top of the SDK's known defaults. */
  allowedAssets?: { network: Network; asset: string; maxAmountPerPayment?: string }[];
  /** Underlying fetch, for tests and proxies. */
  fetch?: typeof fetch;
  config?: X402Config;
}

/** What a buyer callback gets: a fetch that settles 402s, and what it paid. */
export interface X402BuyerContext {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Requirements the buyer was asked to pay for, oldest first. */
  readonly paid: readonly PaymentRequired[];
}

/**
 * Run an outbound call as an x402 buyer: answer 402 challenges by signing and
 * paying them, then hand the paid fetch to `run`.
 *
 * The signing key comes from X402_BUYER_PRIVATE_KEY and never leaves this
 * function. Spend controls (asset allowlist + per-payment cap) are configured
 * on the client, so a hostile seller's quote cannot exceed them.
 */
export async function withX402Client<T>(
  options: X402BuyerOptions,
  run: (ctx: X402BuyerContext) => Promise<T>
): Promise<T> {
  // A buyer only needs to know which chain it pays on; the recipient is the
  // seller's, so the payTo half of resolveX402Config() does not apply here.
  let payNetwork = options.config?.network;
  if (!payNetwork) {
    const name = resolveNetworkName(options.env);
    if (!name.ok) throw new Error(name.reason);
    payNetwork = X402_NETWORKS[name.name].caip2;
  }

  const privateKey = options.env.X402_BUYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("X402_BUYER_PRIVATE_KEY is not set");

  const { privateKeyToAccount } = await import("viem/accounts");
  const signer = privateKeyToAccount(privateKey as `0x${string}`);

  const client = x402Client.fromConfig({
    schemes: [],
    spendControls: {
      maxAmountPerPayment: options.maxAmountUsd ?? "$1",
      ...(options.allowedAssets ? { allowedAssets: options.allowedAssets } : {}),
    },
  });
  registerExactEvmScheme(client, {
    signer,
    networks: [payNetwork],
    ...(options.env.X402_BUYER_RPC_URL ? { schemeOptions: { rpcUrl: options.env.X402_BUYER_RPC_URL } } : {}),
  });
  const http = new x402HTTPClient(client);
  const baseFetch = options.fetch ?? fetch;

  const paid: PaymentRequired[] = [];

  const paidFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await baseFetch(input, init);
    if (response.status !== 402) return response;

    const paymentRequired = http.getPaymentRequiredResponse((name) => response.headers.get(name));
    const decision = options.confirm ? await options.confirm(paymentRequired) : null;
    if (decision === false) {
      throw new Error("x402 payment declined by the confirmation callback");
    }

    const paymentPayload = await http.createPaymentPayload(paymentRequired);
    const headers = new Headers(init?.headers);
    for (const [name, value] of Object.entries(http.encodePaymentSignatureHeader(paymentPayload))) {
      headers.set(name, value);
    }
    paid.push(paymentRequired);
    return baseFetch(input, { ...init, headers });
  };

  return run({ fetch: paidFetch, paid });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}