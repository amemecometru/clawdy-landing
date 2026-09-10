/**
 * Webhook Ingress — /api/v1/webhook/ingress
 *
 * Universal ingestion endpoint. Accepts payloads from any source
 * (Facebook, Gmail, scrapers), normalizes them into the uniform task
 * schema, classifies intent via proxy-bridge, and persists to D1.
 */

import { Hono } from "hono";
import { classify, generateTaskId } from "./proxy-bridge";
import { createTask, type NewTask } from "../db/tasks";
import { migrate } from "../db/schema";

export interface WebhookEnv {
  DB: D1Database;
}

const webhook = new Hono<{ Bindings: WebhookEnv }>();

// Ensure schema exists on first request (idempotent).
let schemaReady = false;
async function ensureSchema(db: D1Database) {
  if (!schemaReady) {
    await migrate(db);
    schemaReady = true;
  }
}

webhook.post("/ingress", async (c) => {
  await ensureSchema(c.env.DB);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const source = (body.source as string) ?? "unknown";
  const rawPayload = (body.payload as Record<string, unknown>) ?? {};

  // Normalize into the universal task schema
  const normalized: Record<string, unknown> = {
    client_name: rawPayload.client_name ?? rawPayload.name ?? rawPayload.title ?? "Unknown",
    contact: rawPayload.contact ?? rawPayload.email ?? rawPayload.phone ?? null,
    intent: rawPayload.intent ?? rawPayload.message ?? rawPayload.description ?? "",
    estimated_value: rawPayload.estimated_value ?? rawPayload.price ?? null,
    source_url: rawPayload.url ?? rawPayload.link ?? null,
  };

  // Classify against the merged raw + normalized payload so fields like
  // subject/price that don't survive normalization still drive intents.
  const classification = classify({
    source,
    payload: { ...rawPayload, ...normalized },
  });

  // Generate task
  const taskId = generateTaskId(source);
  const task: NewTask = {
    id: taskId,
    source,
    priority: classification.priority,
    action: classification.action,
    payload: {
      ...normalized,
      _classification: {
        intent: classification.intent,
        autonomy: classification.autonomy,
        confidence: classification.confidence,
      },
    },
  };

  await createTask(c.env.DB, task);

  // Log raw ingress for forensics
  await c.env.DB.prepare(
    `INSERT INTO ingress_log (source, raw_body, headers, task_id, created_at) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(
      source,
      JSON.stringify(body),
      JSON.stringify({ "content-type": c.req.header("content-type") }),
      taskId,
      Math.floor(Date.now() / 1000)
    )
    .run();

  return c.json(
    {
      task_id: taskId,
      status: "pending",
      classification: {
        intent: classification.intent,
        action: classification.action,
        priority: classification.priority,
        autonomy: classification.autonomy,
        confidence: classification.confidence,
      },
    },
    201
  );
});

export default webhook;
