/**
 * Outreach chain — the revenue executors.
 *
 * Phase 2 turned these from placeholders into real implementations:
 *   gmailSend               → real Gmail API send (messages/send)
 *   draftOutreachEmail      → LLM-drafted personalized outreach
 *   draftReplyEmail         → LLM-drafted thread reply
 *   draftFollowUpEmail      → LLM-drafted follow-up
 *   runApifyScrape          → real Apify actor run + dataset fetch
 *   scheduleFollowUp        → persist a follow-up reminder (cron turns due
 *                             ones into HITL approval tasks; nothing auto-sends)
 *   processDueFollowUps     → called by the Worker's scheduled (cron) handler
 *
 * Drafting defaults to the Cloudflare platform backbone (no BYOK needed —
 * uses CLOUDFLARE_API_TOKEN when present); provider/model are overridable
 * per call for BYOK operators.
 */

import { infer } from "./infer";
import { getToken, decryptSecret, type VaultEnv } from "../db/vault";
import { createTask } from "../db/tasks";

export interface OutreachContext extends VaultEnv {
  DB: D1Database;
  operator: { sub: string; email: string | null };
  CF_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

export interface OutreachResult {
  ok: boolean;
  output: unknown;
}

/** Decrypted vault token for the operator + provider, or null. */
async function vaultToken(ctx: OutreachContext, provider: string): Promise<string | null> {
  const rec = await getToken(ctx.DB, ctx, ctx.operator.sub, provider);
  if (!rec) return null;
  return decryptSecret(ctx, rec.access_token);
}

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function mimeMessage(to: string, subject: string, body: string, fromName: string): string {
  const headers = [
    `To: ${to}`,
    `From: ${fromName}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

// ── Gmail send ───────────────────────────────────────────────────────────────

/**
 * Send an email through the Gmail API (messages/send — real delivery).
 * The operator's Google OAuth token comes from the vault; HITL approval
 * happens upstream (MCP interception / task approval), so by the time this
 * runs a human has already said yes.
 */
export async function gmailSend(
  ctx: OutreachContext,
  to: string,
  subject: string,
  body: string
): Promise<OutreachResult> {
  if (!to || !subject || !body) {
    return { ok: false, output: { error: "INVALID_ARGS", message: "to, subject, and body are required" } };
  }
  const token = await vaultToken(ctx, "google");
  if (!token) {
    return {
      ok: false,
      output: {
        error: "GMAIL_TOKEN_REQUIRED",
        message: "No connected Gmail. Connect Google in the Studio Vault (OAuth), then retry.",
      },
    };
  }
  const fromName = ctx.operator.email ?? "ClawdyClaw Agent";
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64url(mimeMessage(to, subject, body, fromName)) }),
  });
  if (!res.ok) {
    return {
      ok: false,
      output: { error: "GMAIL_API_ERROR", status: res.status, detail: await res.text().catch(() => "") },
    };
  }
  const data = (await res.json()) as { id?: string; threadId?: string };
  return { ok: true, output: { sent: true, gmail_message_id: data.id, thread_id: data.threadId, to } };
}

// ── LLM drafting ─────────────────────────────────────────────────────────────

/** Pull generated text out of a raw provider response (tolerant). */
function extractText(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  // OpenAI-compatible
  const choices = o.choices as Array<{ message?: { content?: string } }> | undefined;
  if (choices?.[0]?.message?.content) return choices[0].message.content;
  // Cloudflare Workers AI REST
  const result = o.result as { response?: string } | undefined;
  if (result?.response) return result.response;
  // Anthropic
  const content = o.content as Array<{ text?: string }> | undefined;
  if (content?.[0]?.text) return content[0].text;
  // Gemini
  const candidates = o.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const gemText = candidates?.[0]?.content?.parts?.[0]?.text;
  if (gemText) return gemText;
  return null;
}

interface DraftArgs {
  provider?: string;
  model?: string;
  system: string;
  context: string;
}

/** Run the drafting LLM; returns raw text or a structured error. */
async function llmDraft(
  ctx: OutreachContext,
  args: DraftArgs
): Promise<{ text: string | null; error?: unknown }> {
  const provider = args.provider ?? "cloudflare";
  const model = args.model ?? (provider === "cloudflare" ? "@cf/meta/llama-3.1-8b-instruct" : undefined);
  const result = await infer(
    provider,
    {
      model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.context },
      ],
    },
    ctx as unknown as Parameters<typeof infer>[2],
    0
  );
  if (!result.ok) return { text: null, error: result.output };
  const text = extractText(result.output);
  if (!text) return { text: null, error: { error: "EMPTY_DRAFT", detail: "LLM returned no text" } };
  return { text };
}

/**
 * Parse a draft into {subject, body}. The model is asked for
 * "SUBJECT: <line>" then "BODY:" — parse defensively, fall back to
 * treating the whole text as the body.
 */
function parseDraft(text: string): { subject: string; body: string } {
  const subjMatch = text.match(/^SUBJECT:\s*(.+)$/m);
  const bodyMatch = text.match(/^BODY:\s*\n?([\s\S]*)$/m);
  if (subjMatch && bodyMatch) {
    return { subject: subjMatch[1].trim(), body: bodyMatch[1].trim() };
  }
  return { subject: "", body: text.trim() };
}

const OUTREACH_SYSTEM = `You are a sales outreach copywriter for an AI automation agency. Write short, human, specific cold emails — no hype, no buzzword stuffing, no fake personalization. Keep it under 120 words. Output exactly:
SUBJECT: <subject line>
BODY:
<email body>`;

export async function draftOutreachEmail(
  ctx: OutreachContext,
  args: Record<string, unknown>
): Promise<OutreachResult> {
  const contact = args.contact as Record<string, unknown> | undefined;
  const to = (args.to as string) ?? (contact?.email as string) ?? "";
  if (!to) return { ok: false, output: { error: "INVALID_ARGS", message: "to (or contact.email) is required" } };

  const context = [
    `Recipient: ${contact?.name ?? to}`,
    contact?.company ? `Company: ${contact.company}` : null,
    contact?.context ? `Context: ${contact.context}` : null,
    args.intent ? `Goal: ${args.intent}` : null,
    args.offer ? `Offer: ${args.offer}` : null,
    args.tone ? `Tone: ${args.tone}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { text, error } = await llmDraft(ctx, { system: OUTREACH_SYSTEM, context, provider: args.provider as string | undefined, model: args.model as string | undefined });
  if (!text) return { ok: false, output: error };
  const { subject, body } = parseDraft(text);
  return { ok: true, output: { to, subject, body, status: "draft_ready" } };
}

const REPLY_SYSTEM = `You are an inbox assistant drafting email replies. Match the thread's tone, be concise, and move the conversation toward a concrete next step (usually a short call). Output exactly:
SUBJECT: <subject line, or Re: <original> if replying>
BODY:
<reply body>`;

export async function draftReplyEmail(
  ctx: OutreachContext,
  args: Record<string, unknown>
): Promise<OutreachResult> {
  const threadText =
    (args.thread_text as string) ??
    ((args.messages as Array<{ from?: string; body?: string }>)
      ?.map((m) => `From ${m.from ?? "unknown"}: ${m.body ?? ""}`)
      .join("\n---\n") as string) ??
    "";
  if (!threadText) {
    return { ok: false, output: { error: "INVALID_ARGS", message: "thread_text (or messages[]) is required" } };
  }
  const context = [
    `Thread:\n${threadText}`,
    args.intent ? `Reply goal: ${args.intent}` : null,
    args.tone ? `Tone: ${args.tone}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { text, error } = await llmDraft(ctx, { system: REPLY_SYSTEM, context, provider: args.provider as string | undefined, model: args.model as string | undefined });
  if (!text) return { ok: false, output: error };
  const { subject, body } = parseDraft(text);
  return {
    ok: true,
    output: { thread_id: args.thread_id ?? null, subject, draft_body: body, status: "draft_ready" },
  };
}

const FOLLOWUP_SYSTEM = `You are writing a short follow-up email. Reference the previous outreach naturally, add one new reason to reply (a result, an insight, a deadline), and keep it under 80 words. Output exactly:
SUBJECT: <subject line>
BODY:
<email body>`;

export async function draftFollowUpEmail(
  ctx: OutreachContext,
  args: Record<string, unknown>
): Promise<OutreachResult> {
  const to = args.to as string;
  if (!to) return { ok: false, output: { error: "INVALID_ARGS", message: "to is required" } };
  const context = [
    `Recipient: ${to}`,
    args.previous_subject ? `Previous subject: ${args.previous_subject}` : null,
    args.context ? `Context: ${args.context}` : null,
    args.tone ? `Tone: ${args.tone}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { text, error } = await llmDraft(ctx, { system: FOLLOWUP_SYSTEM, context, provider: args.provider as string | undefined, model: args.model as string | undefined });
  if (!text) return { ok: false, output: error };
  const { subject, body } = parseDraft(text);
  return { ok: true, output: { to, subject, body, status: "draft_ready" } };
}

// ── Apify scraping ───────────────────────────────────────────────────────────

const APIFY_BASE = "https://api.apify.com/v2";
const SCRAPE_POLL_MS = 4000;
const SCRAPE_MAX_POLLS = 15;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run an Apify actor and return dataset items. Default actor is
 * apify/web-scraper; pass args.actor to override and args.input for full
 * actor input. Polls up to ~60s; if the run is still going, returns the
 * runId/datasetId so the caller can check back.
 */
export async function runApifyScrape(
  ctx: OutreachContext,
  args: Record<string, unknown>
): Promise<OutreachResult> {
  const token = await vaultToken(ctx, "apify");
  if (!token) {
    return {
      ok: false,
      output: {
        error: "APIFY_TOKEN_REQUIRED",
        message: "No Apify key. Connect Apify in the Studio Vault, then retry.",
      },
    };
  }
  const actor = ((args.actor as string) ?? "apify/web-scraper").replace("/", "~");
  const url = (args.url as string) ?? (args.target as string) ?? "";
  const input =
    (args.input as Record<string, unknown>) ??
    {
      startUrls: url ? [{ url }] : [],
      maxCrawlPages: (args.max_pages as number) ?? 5,
      ...(args.query ? { searchQuery: args.query } : {}),
    };
  if (!url && !args.input) {
    return { ok: false, output: { error: "INVALID_ARGS", message: "url (or target), or full actor input, is required" } };
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const startRes = await fetch(`${APIFY_BASE}/acts/${actor}/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!startRes.ok) {
    return {
      ok: false,
      output: { error: "APIFY_START_FAILED", status: startRes.status, detail: await startRes.text().catch(() => "") },
    };
  }
  const started = (await startRes.json()) as { data?: { id?: string; defaultDatasetId?: string } };
  const runId = started.data?.id;
  const datasetId = started.data?.defaultDatasetId;
  if (!runId) return { ok: false, output: { error: "APIFY_START_FAILED", detail: "no run id returned" } };

  let status = "";
  for (let i = 0; i < SCRAPE_MAX_POLLS; i++) {
    await sleep(SCRAPE_POLL_MS);
    const r = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, { headers });
    const j = (await r.json().catch(() => null)) as { data?: { status?: string } } | null;
    status = j?.data?.status ?? "";
    if (["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(status)) break;
  }
  if (status !== "SUCCEEDED") {
    return {
      ok: status === "SUCCEEDED",
      output: {
        status: status || "RUNNING",
        run_id: runId,
        dataset_id: datasetId,
        note:
          status === "SUCCEEDED"
            ? undefined
            : "Run still in progress (or failed) — poll actor-runs/{run_id} or re-run with a smaller page budget.",
      },
    };
  }

  const limit = Math.min((args.limit as number) ?? 25, 100);
  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?limit=${limit}&clean=true&format=json`,
    { headers }
  );
  if (!itemsRes.ok) {
    return {
      ok: false,
      output: { error: "APIFY_DATASET_FAILED", status: itemsRes.status, run_id: runId, dataset_id: datasetId },
    };
  }
  const items = (await itemsRes.json().catch(() => [])) as unknown[];
  return { ok: true, output: { status: "SUCCEEDED", run_id: runId, count: items.length, items } };
}

// ── Follow-up scheduling ─────────────────────────────────────────────────────

export interface FollowUpRow {
  id: string;
  owner_sub: string;
  contact: string | null;
  channel: string;
  due_at: number;
  payload: string | null;
  status: string;
}

/**
 * Schedule a follow-up. This only writes a reminder row — the Worker's
 * scheduled (cron) handler later turns due follow-ups into HITL approval
 * tasks. Nothing sends without a human approving the draft.
 */
export async function scheduleFollowUp(
  ctx: OutreachContext,
  args: Record<string, unknown>
): Promise<OutreachResult> {
  const to = args.to as string;
  if (!to) return { ok: false, output: { error: "INVALID_ARGS", message: "to is required" } };

  const now = Math.floor(Date.now() / 1000);
  const dueAt =
    (args.due_at as number) ??
    now + Math.floor(((args.due_in_days as number) ?? 3) * 86400);
  if (dueAt <= now) {
    return { ok: false, output: { error: "INVALID_ARGS", message: "due_at must be in the future" } };
  }
  const id = `fu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const payload = JSON.stringify({
    to,
    subject_hint: args.subject_hint ?? null,
    context: args.context ?? null,
    previous_subject: args.previous_subject ?? null,
  });
  await ctx.DB.prepare(
    `INSERT INTO follow_ups (id, owner_sub, contact, channel, due_at, payload, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
  )
    .bind(id, ctx.operator.sub, to, (args.channel as string) ?? "email", dueAt, payload, now)
    .run();

  return {
    ok: true,
    output: { scheduled: true, follow_up_id: id, to, due_at: dueAt, due_iso: new Date(dueAt * 1000).toISOString() },
  };
}

/**
 * Cron entrypoint: find due follow-ups, enqueue one HITL approval task per
 * contact (drafting happens at execute-time via draft_follow_up), mark them
 * queued so they aren't re-enqueued. Auto-send is deliberately NOT here —
 * the human approves every follow-up from the task queue.
 */
export async function processDueFollowUps(db: D1Database): Promise<{ checked: number; queued: number }> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .prepare(`SELECT * FROM follow_ups WHERE status = 'pending' AND due_at <= ? ORDER BY due_at ASC LIMIT 25`)
    .bind(now)
    .all<FollowUpRow>();

  let queued = 0;
  for (const row of rows.results ?? []) {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payload ?? "{}") as Record<string, unknown>;
    } catch {
      /* keep empty */
    }
    const taskId = `fu_${row.id}`;
    await createTask(db, {
      id: taskId,
      source: "followup-cron",
      priority: "high",
      action: "draft_follow_up",
      payload: {
        tool: "draft_follow_up",
        args: {
          to: row.contact,
          context: payload.context ?? null,
          previous_subject: payload.previous_subject ?? null,
          follow_up_id: row.id,
        },
        _classification: { intent: "follow_up_due", autonomy: "review", confidence: 0.99 },
      },
    });
    await db.prepare(`UPDATE follow_ups SET status = 'queued' WHERE id = ?`).bind(row.id).run();
    queued++;
  }
  return { checked: (rows.results ?? []).length, queued };
}
