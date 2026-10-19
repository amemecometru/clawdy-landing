/**
 * Sandbox API — /api/v1/sandbox/simulate
 *
 * Dry-runs an inbound payload through the full normalization + classification
 * pipeline without persisting a live task. Returns the step-by-step trace so
 * the Studio Sandbox can show Operators and MCP consumers exactly what the
 * worker would do.
 */

import { Hono } from "hono";
import { classify, generateTaskId } from "./proxy-bridge";

export interface SandboxEnv {
  DB: D1Database;
}

const sandbox = new Hono<{ Bindings: SandboxEnv }>();

sandbox.post("/simulate", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const source = (body.source as string) ?? "unknown";
  const rawPayload = (body.payload as Record<string, unknown>) ?? {};

  const trace: Array<{ step: string; detail: unknown }> = [
    { step: "ingress", detail: { source, received_fields: Object.keys(rawPayload) } },
  ];

  // 1. Normalization
  const normalized: Record<string, unknown> = {
    client_name: rawPayload.client_name ?? rawPayload.name ?? rawPayload.title ?? "Unknown",
    contact: rawPayload.contact ?? rawPayload.email ?? rawPayload.phone ?? null,
    intent: rawPayload.intent ?? rawPayload.message ?? rawPayload.description ?? "",
    estimated_value: rawPayload.estimated_value ?? rawPayload.price ?? null,
    source_url: rawPayload.url ?? rawPayload.link ?? null,
  };
  trace.push({ step: "normalize", detail: normalized });

  // 2. Classification
  const classification = classify({ source, payload: { ...rawPayload, ...normalized } });
  trace.push({
    step: "classify",
    detail: {
      intent: classification.intent,
      action: classification.action,
      priority: classification.priority,
      autonomy: classification.autonomy,
      confidence: classification.confidence,
    },
  });

  // 3. Proposed task (not persisted)
  const task_id = generateTaskId(source);
  const proposed = {
    task_id,
    source,
    status: "pending",
    classification,
    payload: { ...normalized, _classification: classification },
  };
  trace.push({ step: "enqueue", detail: proposed });

  return c.json({
    sandbox: true,
    trace,
    proposed_task: proposed,
  });
});

export default sandbox;