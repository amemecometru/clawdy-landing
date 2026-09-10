/**
 * Telemetry API — /api/v1/telemetry
 *
 * Structured activity feed drawn from the D1 `ingress_log` and `executions`
 * tables. Powers the Studio Telemetry section in both Operator and MCP views.
 */

import { Hono } from "hono";

export interface TelemetryEnv {
  DB: D1Database;
}

const telemetry = new Hono<{ Bindings: TelemetryEnv }>();

telemetry.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200);

  const ingress = await c.env.DB
    .prepare("SELECT id, source, raw_body, headers, task_id, created_at FROM ingress_log ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all<{ id: number; source: string; raw_body: string; headers: string | null; task_id: string | null; created_at: number }>();

  const executions = await c.env.DB
    .prepare("SELECT id, task_id, tool, args, result, ok, created_at FROM executions ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all<{ id: string; task_id: string; tool: string; args: string; result: string | null; ok: number; created_at: number }>();

  return c.json({
    ingress: ingress.results,
    executions: executions.results,
    generated_at: Date.now(),
  });
});

export default telemetry;