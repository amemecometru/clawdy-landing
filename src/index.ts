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
}

// ── Root app ──────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: ClawdyEnv }>();

// CORS for all /api/* routes (studio cross-origin calls, webhook sources)
app.use("/api/*", cors({
  origin: ["https://clawdyclaw.com", "https://agents.clawdyclaw.com", "http://localhost:5173"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
};