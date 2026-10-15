/**
 * Tool Registry API — the single catalog behind every agentic capability.
 *
 *   GET  /api/v1/tools        → full tool catalog + per-tool connection status
 *   GET  /api/v1/tools/:name  → one tool's schema, HITL policy and status
 *
 * This file is the source of truth for the registry. `/mcp/v1` (mcp.ts)
 * derives its executable tool list from TOOL_DEFS entries that carry an
 * `mcpName` — so the Studio Tool Registry UI, the MCP execution surface,
 * and the discovery manifests can never drift apart.
 *
 * Status model:
 *   "live"    — callable today through /mcp/v1 tools/call
 *   "stub"    — listed + schema'd, executor returns a not-provisioned note
 *   "planned" — cataloged for the roadmap; tools/call reports "on the roadmap"
 *
 * Every high-impact tool is `intercepted: true`: instead of running, the
 * call writes a pending row to the D1 approval queue and returns a task_id.
 * Only after a human approves in the Central Station can it execute.
 */

import { Hono } from "hono";
import { getSessionUser, sessionUserOrDefault } from "../lib/session";
import { listTokens, type VaultEnv } from "../db/vault";

export interface ToolsEnv extends VaultEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
}

export type ToolCategory =
  | "communication"
  | "research"
  | "inference"
  | "creative"
  | "automation"
  | "commerce"
  | "memory"
  | "orchestration";

export type ToolStatus = "live" | "stub" | "planned";
export type ToolCostTier = "free" | "cheap" | "standard" | "premium";

export interface InputSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
}

export interface ToolDef {
  /** Registry name — stable identifier shown in Studio. */
  name: string;
  /** Execution name on /mcp/v1 tools/call. Absent = not exposed on the MCP surface yet. */
  mcpName?: string;
  category: ToolCategory;
  description: string;
  /** One-liner: why a revenue-building agent dev picks this tool. */
  useCase: string;
  /** True → the HITL interception gate holds the call for human approval. */
  intercepted: boolean;
  status: ToolStatus;
  /** Vault provider key required ("none" = no credential, "platform" = operator's own infra). */
  providerBinding: string;
  costTier: ToolCostTier;
  /** x402 price per call in USD, 6 decimal places. */
  x402_price_usd: number;
  inputSchema: InputSchema;
}

export const TOOL_DEFS: ToolDef[] = [
  // ── Orchestration (the HITL loop itself) ──────────────────────────────
  {
    name: "list_tasks",
    mcpName: "list_tasks",
    category: "orchestration",
    description: "List the HITL task queue, filterable by status.",
    useCase: "The operator's eyes — every agent action flows through this queue.",
    intercepted: false,
    status: "live",
    providerBinding: "none",
    costTier: "free",
    x402_price_usd: 0.001000,
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", description: "pending | approved | rejected | executed" } },
    },
  },
  {
    name: "classify_intent",
    mcpName: "classify_intent",
    category: "orchestration",
    description: "Run intent classification over a raw inbound payload. Read-only.",
    useCase: "Route every webhook, email and form-fill to the right agent workflow.",
    intercepted: false,
    status: "live",
    providerBinding: "none",
    costTier: "free",
    x402_price_usd: 0.005000,
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        payload: { type: "object" },
      },
      required: ["source", "payload"],
    },
  },

  // ── Communication ─────────────────────────────────────────────────────
  {
    name: "send_email",
    mcpName: "send_email",
    category: "communication",
    description: "Send a personalized outreach email. Requires human approval.",
    useCase: "Outbound sales and follow-up at agent scale — the revenue workhorse.",
    intercepted: true,
    status: "live",
    providerBinding: "google",
    costTier: "free",
    x402_price_usd: 0.250000,
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        reply_to: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "draft_reply",
    mcpName: "draft_reply",
    category: "communication",
    description: "Draft a reply to an existing thread with an LLM. Requires human approval to send.",
    useCase: "Inbox-zero agents — drafts land in the queue, you approve the send.",
    intercepted: true,
    status: "live",
    providerBinding: "google",
    costTier: "free",
    x402_price_usd: 0.050000,
    inputSchema: {
      type: "object",
      properties: {
        thread_id: { type: "string" },
        thread_text: { type: "string", description: "Full thread content, or pass messages[]" },
        messages: { type: "array", items: { type: "object" } },
        intent: { type: "string", description: "What the reply should accomplish" },
        tone: { type: "string" },
        provider: { type: "string", description: "Drafting LLM provider (default: cloudflare)" },
        model: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "draft_personalized_outreach",
    mcpName: "draft_personalized_outreach",
    category: "communication",
    description: "Draft a personalized cold-outreach email with an LLM. Requires human approval to send.",
    useCase: "Outbound sales at agent scale — personalized first-touch emails drafted per lead.",
    intercepted: true,
    status: "live",
    providerBinding: "none",
    costTier: "cheap",
    x402_price_usd: 0.250000,
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        contact: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            company: { type: "string" },
            context: { type: "string" },
          },
        },
        intent: { type: "string" },
        offer: { type: "string" },
        tone: { type: "string" },
        provider: { type: "string", description: "Drafting LLM provider (default: cloudflare)" },
        model: { type: "string" },
      },
      required: ["to"],
    },
  },
  {
    name: "draft_follow_up",
    mcpName: "draft_follow_up",
    category: "communication",
    description: "Draft a follow-up email for a previous outreach. Requires human approval to send.",
    useCase: "Never let a warm lead go cold — follow-ups drafted on schedule, you approve the send.",
    intercepted: true,
    status: "live",
    providerBinding: "none",
    costTier: "cheap",
    x402_price_usd: 0.250000,
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        previous_subject: { type: "string" },
        context: { type: "string" },
        tone: { type: "string" },
        provider: { type: "string" },
        model: { type: "string" },
      },
      required: ["to"],
    },
  },
  {
    name: "schedule_follow_up",
    mcpName: "schedule_follow_up",
    category: "communication",
    description: "Schedule a follow-up reminder. Due follow-ups become HITL approval tasks — nothing auto-sends.",
    useCase: "Set-and-forget follow-up cadence behind the HITL gate.",
    intercepted: false,
    status: "live",
    providerBinding: "none",
    costTier: "free",
    x402_price_usd: 0.250000,
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        due_in_days: { type: "number", description: "Days from now (default 3)" },
        due_at: { type: "number", description: "Unix timestamp, overrides due_in_days" },
        context: { type: "string" },
        subject_hint: { type: "string" },
        previous_subject: { type: "string" },
      },
      required: ["to"],
    },
  },
  {
    name: "search_threads",
    mcpName: "search_threads",
    category: "communication",
    description: "Search the inbox for a thread. Read-only.",
    useCase: "Give agents full inbox context before they draft a single word.",
    intercepted: false,
    status: "stub",
    providerBinding: "google",
    costTier: "free",
    x402_price_usd: 0.010000,
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "send_sms",
    category: "communication",
    description: "Send an SMS via Twilio. Requires human approval.",
    useCase: "Appointment reminders and OTP flows — the highest-ROI agent notification channel.",
    intercepted: true,
    status: "planned",
    providerBinding: "twilio",
    costTier: "cheap",
    x402_price_usd: 0.250000,
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "E.164 phone number" },
        body: { type: "string" },
      },
      required: ["to", "body"],
    },
  },
  {
    name: "post_social",
    category: "communication",
    description: "Publish a post to a connected social account. Requires human approval.",
    useCase: "Agents that run content pipelines — write once, publish everywhere.",
    intercepted: true,
    status: "planned",
    providerBinding: "social",
    costTier: "free",
    x402_price_usd: 0.100000,
    inputSchema: {
      type: "object",
      properties: {
        network: { type: "string", description: "x | facebook | linkedin | instagram" },
        text: { type: "string" },
        media_url: { type: "string" },
      },
      required: ["network", "text"],
    },
  },
  {
    name: "schedule_post",
    category: "communication",
    description: "Queue a social post for a future time. Requires human approval.",
    useCase: "A week of content scheduled in one agent run — the social autopilot.",
    intercepted: true,
    status: "planned",
    providerBinding: "social",
    costTier: "free",
    x402_price_usd: 0.100000,
    inputSchema: {
      type: "object",
      properties: {
        network: { type: "string" },
        text: { type: "string" },
        publish_at: { type: "string", description: "ISO-8601 timestamp" },
      },
      required: ["network", "text", "publish_at"],
    },
  },

  // ── Research ──────────────────────────────────────────────────────────
  {
    name: "run_scraper",
    mcpName: "run_scraper",
    category: "research",
    description: "Run an Apify actor and return structured results. Requires an Apify key in the vault.",
    useCase: "Lead lists on autopilot — scrape marketplaces into your pipeline nightly.",
    intercepted: false,
    status: "live",
    providerBinding: "apify",
    costTier: "cheap",
    x402_price_usd: 0.500000,
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Starting URL to scrape" },
        target: { type: "string", description: "Alias for url" },
        query: { type: "string" },
        actor: { type: "string", description: "Apify actor id (default: apify/web-scraper)" },
        input: { type: "object", description: "Full actor input — overrides url/query/max_pages" },
        max_pages: { type: "number", description: "Page budget (default 5)" },
        limit: { type: "number", description: "Max dataset items returned (default 25, max 100)" },
      },
      required: [],
    },
  },
  {
    name: "web_search",
    category: "research",
    description: "Live web search with cited results. Read-only.",
    useCase: "Ground every agent answer in the live web — research products that cite sources.",
    intercepted: false,
    status: "planned",
    providerBinding: "tavily",
    costTier: "cheap",
    x402_price_usd: 0.006000,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        max_results: { type: "string", description: "1-10, default 5" },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_url",
    category: "research",
    description: "Fetch a URL and return cleaned text. Read-only.",
    useCase: "Turn any page into agent-readable context — the input stage of every research pipeline.",
    intercepted: false,
    status: "planned",
    providerBinding: "none",
    costTier: "free",
    x402_price_usd: 0.010000,
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "monitor_keywords",
    category: "research",
    description: "Watch keywords across the web and enqueue hits as tasks. Read-only.",
    useCase: "Never miss a buying signal — competitor mentions and leads surface automatically.",
    intercepted: false,
    status: "planned",
    providerBinding: "tavily",
    costTier: "cheap",
    x402_price_usd: 0.250000,
    inputSchema: {
      type: "object",
      properties: {
        keywords: { type: "string", description: "comma-separated" },
        cadence: { type: "string", description: "hourly | daily" },
      },
      required: ["keywords"],
    },
  },

  // ── Inference ─────────────────────────────────────────────────────────
  {
    name: "model_infer",
    mcpName: "model_infer",
    category: "inference",
    description: "Run inference on any connected model family (provider-agnostic router).",
    useCase: "One call, any brain — agents pick the right model per task without rewiring.",
    intercepted: false,
    status: "live",
    providerBinding: "any-model",
    costTier: "cheap",
    x402_price_usd: 0.050000,
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", description: "any provider in the Models registry" },
        model: { type: "string", description: "model id; defaults per provider" },
        prompt: { type: "string" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "hf_infer",
    mcpName: "hf_infer",
    category: "inference",
    description: "Open-weights inference via HuggingFace router (llama, mistral, qwen…).",
    useCase: "The free-tier brain — capable open models for builders with no budget.",
    intercepted: false,
    status: "live",
    providerBinding: "huggingface",
    costTier: "free",
    x402_price_usd: 0.020000,
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        prompt: { type: "string" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "cloudflare_ai",
    mcpName: "cloudflare_ai",
    category: "inference",
    description: "Edge inference on the Cloudflare Workers AI backbone.",
    useCase: "Zero-key edge brains billed to your own account — the 24/7 agent default.",
    intercepted: false,
    status: "live",
    providerBinding: "platform",
    costTier: "cheap",
    x402_price_usd: 0.020000,
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "@cf/… model id" },
        prompt: { type: "string" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "tts_speak",
    category: "inference",
    description: "Text-to-speech via ElevenLabs. Returns audio.",
    useCase: "Voice agents that close deals — phone calls, voicemails and audio content on demand.",
    intercepted: false,
    status: "planned",
    providerBinding: "elevenlabs",
    costTier: "standard",
    x402_price_usd: 0.100000,
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        voice: { type: "string", description: "voice id; defaults to operator default" },
      },
      required: ["text"],
    },
  },
  {
    name: "transcribe_audio",
    category: "inference",
    description: "Speech-to-text for an audio URL or upload.",
    useCase: "Turn calls, meetings and voicemails into structured agent input.",
    intercepted: false,
    status: "planned",
    providerBinding: "groq",
    costTier: "cheap",
    x402_price_usd: 0.050000,
    inputSchema: {
      type: "object",
      properties: { audio_url: { type: "string" } },
      required: ["audio_url"],
    },
  },
  {
    name: "summarize_document",
    category: "inference",
    description: "Summarize a document URL into key points and action items.",
    useCase: "Contracts, PDFs and long threads compressed to decisions in seconds.",
    intercepted: false,
    status: "planned",
    providerBinding: "any-model",
    costTier: "cheap",
    x402_price_usd: 0.050000,
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        focus: { type: "string", description: "what to extract, e.g. 'pricing and deadlines'" },
      },
      required: ["url"],
    },
  },

  // ── Creative ──────────────────────────────────────────────────────────
  {
    name: "flux_image",
    mcpName: "flux_image",
    category: "creative",
    description: "Generate an image via FLUX.1-schnell (Cloudflare Workers AI).",
    useCase: "Agent-generated creative — ad variants, thumbnails and product shots on demand.",
    intercepted: false,
    status: "live",
    providerBinding: "platform",
    costTier: "cheap",
    x402_price_usd: 0.050000,
    inputSchema: {
      type: "object",
      properties: { prompt: { type: "string", description: "image prompt" } },
      required: ["prompt"],
    },
  },
  {
    name: "generate_video",
    category: "creative",
    description: "Text-to-video generation. Requires human approval (compute cost).",
    useCase: "Agents that ship video ads and shorts without a production crew.",
    intercepted: true,
    status: "planned",
    providerBinding: "replicate",
    costTier: "premium",
    x402_price_usd: 1.000000,
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        duration_s: { type: "string", description: "clip length in seconds" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "edit_image",
    category: "creative",
    description: "Edit or restyle an image from a URL plus an instruction.",
    useCase: "Batch creative iteration — one product shot becomes a whole campaign.",
    intercepted: false,
    status: "planned",
    providerBinding: "platform",
    costTier: "cheap",
    x402_price_usd: 0.080000,
    inputSchema: {
      type: "object",
      properties: {
        image_url: { type: "string" },
        instruction: { type: "string" },
      },
      required: ["image_url", "instruction"],
    },
  },

  // ── Automation (the widely-used processes) ────────────────────────────
  {
    name: "http_request",
    category: "automation",
    description: "Generic outbound HTTP request. Requires human approval.",
    useCase: "The universal adapter — agents talk to any API with no new integration code.",
    intercepted: true,
    status: "planned",
    providerBinding: "none",
    costTier: "free",
    x402_price_usd: 0.050000,
    inputSchema: {
      type: "object",
      properties: {
        method: { type: "string", description: "GET | POST | PUT | DELETE" },
        url: { type: "string" },
        body: { type: "object", description: "JSON body for POST/PUT" },
      },
      required: ["method", "url"],
    },
  },
  {
    name: "schedule_cron",
    category: "automation",
    description: "Schedule a recurring agent run on a cron expression. Requires human approval.",
    useCase: "Set-and-forget revenue loops — nightly lead scrapes, weekly reports, morning briefings.",
    intercepted: true,
    status: "planned",
    providerBinding: "platform",
    costTier: "free",
    x402_price_usd: 0.250000,
    inputSchema: {
      type: "object",
      properties: {
        cron: { type: "string", description: "e.g. '0 9 * * MON'" },
        task: { type: "string", description: "what the agent should do each run" },
      },
      required: ["cron", "task"],
    },
  },
  {
    name: "run_code",
    category: "automation",
    description: "Execute code inside your private Mesh sandbox (fresh workdir, timeout, scrubbed env). Requires human approval.",
    useCase: "Agents that build and ship — code runs isolated on your own node, every action audit-logged.",
    intercepted: true,
    status: "planned",
    providerBinding: "platform",
    costTier: "free",
    x402_price_usd: 0.100000,
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", description: "python | node | bash" },
        code: { type: "string" },
        timeout_s: { type: "string", description: "kill-switch, default 600" },
      },
      required: ["language", "code"],
    },
  },
  {
    name: "file_write",
    category: "automation",
    description: "Write a file into the sandbox workdir. Requires human approval.",
    useCase: "Agents that produce artifacts — reports, CSVs and code land in an isolated workdir.",
    intercepted: true,
    status: "planned",
    providerBinding: "platform",
    costTier: "free",
    x402_price_usd: 0.020000,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "relative to the task workdir" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },

  // ── Commerce (agents that collect money) ──────────────────────────────
  {
    name: "create_payment_link",
    category: "commerce",
    description: "Create a Stripe Payment Link. Requires human approval.",
    useCase: "Agents that collect money — quotes become payable links from a chat command.",
    intercepted: true,
    status: "planned",
    providerBinding: "stripe",
    costTier: "standard",
    x402_price_usd: 0.250000,
    inputSchema: {
      type: "object",
      properties: {
        amount_cents: { type: "string" },
        currency: { type: "string", description: "default usd" },
        description: { type: "string" },
      },
      required: ["amount_cents", "description"],
    },
  },
  {
    name: "check_payment",
    category: "commerce",
    description: "Check the status of a payment or payment link. Read-only.",
    useCase: "Close the loop — agents confirm payment before delivering the goods.",
    intercepted: false,
    status: "planned",
    providerBinding: "stripe",
    costTier: "free",
    x402_price_usd: 0.010000,
    inputSchema: {
      type: "object",
      properties: { payment_id: { type: "string" } },
      required: ["payment_id"],
    },
  },
  {
    name: "create_invoice",
    category: "commerce",
    description: "Draft a Stripe invoice. Requires human approval to send.",
    useCase: "B2B agent workflows — work completed Friday, invoice sent Monday, no human touched it.",
    intercepted: true,
    status: "planned",
    providerBinding: "stripe",
    costTier: "standard",
    x402_price_usd: 0.500000,
    inputSchema: {
      type: "object",
      properties: {
        customer_email: { type: "string" },
        amount_cents: { type: "string" },
        description: { type: "string" },
      },
      required: ["customer_email", "amount_cents", "description"],
    },
  },

  // ── Memory & data ─────────────────────────────────────────────────────
  {
    name: "vector_search",
    category: "memory",
    description: "Semantic search over the operator's vector store. Read-only.",
    useCase: "Agents with long memories — every past deal, doc and decision retrievable.",
    intercepted: false,
    status: "planned",
    providerBinding: "platform",
    costTier: "cheap",
    x402_price_usd: 0.010000,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        top_k: { type: "string", description: "default 5" },
      },
      required: ["query"],
    },
  },
  {
    name: "save_memory",
    category: "memory",
    description: "Persist a fact to long-term agent memory.",
    useCase: "Compounding agents — what one run learns, every future run knows.",
    intercepted: false,
    status: "planned",
    providerBinding: "platform",
    costTier: "free",
    x402_price_usd: 0.020000,
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string" },
        value: { type: "string" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "query_sheet",
    category: "memory",
    description: "Read rows from a connected spreadsheet. Read-only.",
    useCase: "Spreadsheets as databases — agents read pricing, inventory and lead lists live.",
    intercepted: false,
    status: "planned",
    providerBinding: "google",
    costTier: "free",
    x402_price_usd: 0.010000,
    inputSchema: {
      type: "object",
      properties: {
        sheet_id: { type: "string" },
        range: { type: "string", description: "e.g. 'Leads!A1:D50'" },
      },
      required: ["sheet_id", "range"],
    },
  },
  {
    name: "update_crm",
    category: "memory",
    description: "Create or update a CRM contact/deal. Requires human approval.",
    useCase: "Pipeline hygiene on autopilot — every outreach logged, every reply tracked.",
    intercepted: true,
    status: "planned",
    providerBinding: "hubspot",
    costTier: "standard",
    x402_price_usd: 0.100000,
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        properties: { type: "object", description: "fields to set" },
      },
      required: ["email"],
    },
  },
];

/** Tools exposed on the /mcp/v1 execution surface (registry name → execution name). */
export const MCP_EXECUTABLE = new Map(
  TOOL_DEFS.filter((t) => t.mcpName).map((t) => [t.mcpName as string, t])
);

/** Read-only tools skip the interception gate (informational only). */
export const READ_ONLY_TOOLS = new Set(
  TOOL_DEFS.filter((t) => t.mcpName && !t.intercepted).map((t) => t.mcpName as string)
);

const tools = new Hono<{ Bindings: ToolsEnv }>();

tools.get("/tools", async (c) => {
  const user = sessionUserOrDefault(await getSessionUser(c.env, c.req.raw));
  const tokens = await listTokens(c.env.DB, user.sub);
  const connected = new Map(tokens.map((t) => [t.provider, true]));

  return c.json({
    user: { sub: user.sub, email: user.email },
    registry: "https://clawdyclaw.com/api/v1/tools",
    execution_surface: "https://clawdyclaw.com/mcp/v1",
    counts: {
      total: TOOL_DEFS.length,
      live: TOOL_DEFS.filter((t) => t.status === "live").length,
      stub: TOOL_DEFS.filter((t) => t.status === "stub").length,
      planned: TOOL_DEFS.filter((t) => t.status === "planned").length,
      intercepted: TOOL_DEFS.filter((t) => t.intercepted).length,
    },
    tools: TOOL_DEFS.map((t) => ({
      ...t,
      connected:
        t.providerBinding === "none" || t.providerBinding === "platform" || t.providerBinding === "any-model"
          ? true
          : connected.get(t.providerBinding) ?? false,
    })),
  });
});

tools.get("/tools/:name", async (c) => {
  const name = c.req.param("name");
  const def = TOOL_DEFS.find((t) => t.name === name);
  if (!def) return c.json({ error: "unknown tool" }, 404);
  return c.json(def);
});

export default tools;
