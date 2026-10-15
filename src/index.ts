/**
 * ClawdyClaw — Cloudflare Worker entry point.
 *
 * Hono-based edge server for the ClawdyClaw agency platform.
 * Static SPA assets are served automatically by Cloudflare's asset routing
 * (configured in wrangler.jsonc). This Worker handles all /api/* traffic,
 * including:
 *
 *   /api/auth/*          → shared identity (Google OAuth + sessions)
 *   /api/health          → liveness probe
 *   /api/v1/webhook/*    → universal ingestion endpoint
 *   /api/v1/tasks/*      → HITL task queue (approve / reject / execute)
 *
 * Domain dispatch happens at the edge: the same Worker serves
 * clawdyclaw.com (marketing) and agents.clawdyclaw.com (Central Station
 * Studio). Client-side routing handles which SPA view is shown.
 */

import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { createAuthRouter } from "./auth/auth";
import webhook from "./api/webhook";
import tasks from "./api/tasks";
import mcp from "./api/mcp";
import integrations from "./api/integrations";
import telemetry from "./api/telemetry";
import sandbox from "./api/sandbox";
import feeds from "./api/feeds";
import models from "./api/models";
import tools from "./api/tools";
import professionals from "./api/professionals";
import professionalsPayment from "./api/professionals-payment";
import campaigns from "./api/campaigns";
import qualify from "./api/qualify";
import { migrate } from "./db/schema";

// ── Env bindings ──────────────────────────────────────────────────────────────

export interface ClawdyEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AUTH_SECRET: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  VAULT_CIPHER_KEY?: string;
  CF_ACCOUNT_ID?: string;
  /** Encrypted Worker secret (dashboard Settings > Variables). Never in repo. */
  CLOUDFLARE_API_TOKEN?: string;
  /** x402 settlement recipient — the only source of `payTo`. */
  X402_PAY_TO_ADDRESS?: string;
  /** Facilitator base URL (defaults to the public testnet facilitator). */
  X402_FACILITATOR_URL?: string;
  /** "base-sepolia" (default) or "base". */
  X402_NETWORK?: string;
  /** Exactly "true" selects mainnet settlement. */
  X402_MAINNET?: string;
  /** Exactly "true" disables the payment gate (local testing only). */
  X402_DEV_BYPASS?: string;
  /** Per-request facilitator timeout in milliseconds. */
  X402_FACILITATOR_TIMEOUT_MS?: string;
  /** JWKS endpoint for Monetization Gateway PAYMENT-CONTEXT JWTs. */
  X402_PAYMENT_CONTEXT_JWKS_URL?: string;
  /** Expected PAYMENT-CONTEXT issuer. */
  X402_PAYMENT_CONTEXT_ISSUER?: string;
  /** Expected PAYMENT-CONTEXT audience. */
  X402_PAYMENT_CONTEXT_AUDIENCE?: string;
  /** KV namespace holding paid-call idempotency records. */
  X402_IDEMPOTENCY?: KVNamespace;
  /** Base RPC for reading crypto payment receipts (workflow payment). */
  BASE_RPC_URL?: string;
  /** Stripe secret + webhook signing secret (workflow payment). */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Signs digital receipts; falls back to AUTH_SECRET. */
  RECEIPT_SIGNING_SECRET?: string;
  /** Origin Stripe redirects back to after checkout. */
  PUBLIC_ORIGIN?: string;
}

// ── Root app ──────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: ClawdyEnv }>();

// CORS for all /api/* routes (studio cross-origin calls, webhook sources)
app.use("/api/*", cors({
  origin: ["https://clawdyclaw.com", "https://agents.clawdyclaw.com", "http://localhost:5173"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  credentials: true,
}));

// ── Auth (shared identity across both hosts) ──────────────────────────────────

app.route("/api/auth", createAuthRouter());

// ── Webhook Ingress ───────────────────────────────────────────────────────────

app.route("/api/v1/webhook", webhook);

// ── Task Queue (HITL) ─────────────────────────────────────────────────────────

app.route("/api/v1/tasks", tasks);

// ── Integrations & Auth Vault (OAuth broker) ─────────────────────────────────

app.route("/api/v1", integrations);

// ── Telemetry feed (ingress_log + executions) ────────────────────────────────

app.route("/api/v1/telemetry", telemetry);

// ── Sandbox simulate (dry-run webhook) ───────────────────────────────────────

app.route("/api/v1/sandbox", sandbox);

// ── WidgetFeed + platform feeds (live RSS + webhook events) ──────────────────

app.route("/api/v1", feeds);

// ── Models registry (Cloudflare backbone + openWeights + legacy) ─────────────

app.route("/api/v1", models);

// ── Tool registry (agentic capability catalog; backs /mcp/v1) ────────────────

app.route("/api/v1", tools);

// ── Professional Personal Brand Sites ────────────────────────────────────────

app.route("/api/v1/professionals", professionals);

// ── Professionals workflow payment (one-time tier purchase) ───────────────────
// Mounted under the professionals prefix so a paid checkout sits next to the
// workflow it unlocks.

app.route("/api/v1/professionals/payment", professionalsPayment);

// ── Outreach campaigns (HITL-gated 3-step sequence) ───────────────────────────

app.route("/api/v1/campaigns", campaigns);

// ── Lead qualification (public, stateless) ───────────────────────────────────

app.route("/api/v1/qualify", qualify);

// ── MCP Tool Server (JSON-RPC over HTTP) ──────────────────────────────────────
// Mounted explicitly (not via route()) so both the bare and trailing-slash
// forms dispatch to the MCP router regardless of asset-routing quirks.

const MCP_PATH = "/mcp/v1";
const callMcp = async (c: Context<{ Bindings: ClawdyEnv }>): Promise<Response> => {
  const url = new URL(c.req.url);
  url.pathname = "/";
  url.search = "";
  return mcp.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
};
app.post(MCP_PATH, callMcp);
app.post(`${MCP_PATH}/`, callMcp);

// Serve the MCP discovery manifest (asset routing hands it here via run_worker_first)
app.get("/mcp/v1/manifest.json", (c) =>
  c.json({
    name: "clawdyclaw-bridge",
    version: "1.0.0",
    protocol: "2024-11-05",
    servers: {
      mcp: {
        url: "https://clawdyclaw.com/mcp/v1",
        capabilities: {
          tools: {
            list_tasks: { description: "List the HITL task queue" },
            classify_intent: { description: "Classify an inbound payload" },
            send_email: { description: "Send personalized outreach (HITL-intercepted)" },
            search_threads: { description: "Search inbox threads" },
            draft_reply: { description: "Draft a reply (HITL-intercepted)" },
            run_scraper: { description: "Dispatch a marketplace scrape" },
            model_infer: { description: "Run inference on any connected model family" },
            hf_infer: { description: "Open-weights inference via HuggingFace router" },
            cloudflare_ai: { description: "Edge inference on Cloudflare Workers AI" },
            flux_image: { description: "Generate an image via FLUX.1-schnell" },
          },
        },
      },
    },
    semantic: "@id: clawdyclaw/bridge#mcp",
  })
);

// ── Health check ──────────────────────────────────────────────────────────────

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    domain: new URL(c.req.url).hostname,
    timestamp: new Date().toISOString(),
  })
);

// ── Everything else: static assets are handled by CF asset routing ────────────

// CF Asset serving strips hidden (dot) paths, so the well-known MCP discovery
// document is served explicitly from the worker.
const WELL_KNOWN_MCP = {
  name: "clawdyclaw",
  version: "1.1.0",
  type: "service-node",
  endpoints: {
    mcp: "https://clawdyclaw.com/mcp/v1/manifest.json",
    rpc: "https://clawdyclaw.com/mcp/v1",
    protocol: "https://clawdyclaw.com/.well-known/",
  },
  capabilities: {
    tools: [
      "list_tasks",
      "classify_intent",
      "send_email",
      "search_threads",
      "draft_reply",
      "run_scraper",
      "model_infer",
      "hf_infer",
      "cloudflare_ai",
      "flux_image",
    ],
    models: {
      registry: "https://clawdyclaw.com/api/v1/models",
      providers: ["cloudflare", "meta", "openai", "anthropic", "gemini", "grok", "deepseek", "mistral", "qwen", "kimi", "zai", "groq", "together", "cohere", "perplexity", "amazon", "openrouter", "unorouter", "freellmapi", "huggingface", "flux", "elevenlabs"],
      backbone: "worker-edge",
    },
    tool_registry: {
      registry: "https://clawdyclaw.com/api/v1/tools",
      categories: ["communication", "research", "inference", "creative", "automation", "commerce", "memory", "orchestration"],
    },
    feeds: {
      widgets: "https://clawdyclaw.com/api/v1/portal/widgets",
      streams: ["youtube", "medium", "substack", "hackernoon"],
      webhook_events: ["x", "facebook"],
    },
    hitl: {
      enforcement: "interception-gate",
      intercepted: ["send_email", "draft_reply"],
      approval_queue: "https://clawdyclaw.com/api/v1/tasks",
    },
    settlement: ["lightning", "evm-402", "agentic-wallet"],
  },
  "@context": "https://schema.org",
};

app.get("/.well-known/mcp.json", (c) =>
  c.json(WELL_KNOWN_MCP, 200, { "content-type": "application/json; charset=utf-8" })
);

app.all("*", (c) => c.json({ error: "Not found" }, 404));

// ── Bootstrap: ensure D1 schema is applied ────────────────────────────────────

let dbReady = false;

async function ensureDB(db: D1Database) {
  if (!dbReady) {
    await migrate(db);
    dbReady = true;
  }
}

// ── Export for Cloudflare Workers ──────────────────────────────────────────────

export default {
  async fetch(request: Request, env: ClawdyEnv, ctx: ExecutionContext): Promise<Response> {
    await ensureDB(env.DB);
    return app.fetch(request, env, ctx);
  },
  /**
   * Scheduled (cron) handler — configure the cadence in the dashboard
   * (Worker > Triggers > Cron Triggers), e.g. every 15 minutes.
   * Turns due follow-ups into HITL approval tasks. Nothing auto-sends:
   * every follow-up still needs a human approval before execute().
   */
  async scheduled(_event: ScheduledEvent, env: ClawdyEnv, _ctx: ExecutionContext): Promise<void> {
    await ensureDB(env.DB);
    const { processDueFollowUps } = await import("./api/outreach");
    const { checked, queued } = await processDueFollowUps(env.DB);
    console.log(`[cron] follow-ups checked=${checked} queued=${queued}`);
  },
};