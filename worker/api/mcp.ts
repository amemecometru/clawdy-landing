/**
 * MCP Tool Server — JSON-RPC 2.0 over HTTP.
 *
 * Serves the Model Context Protocol surface at /mcp/v1:
 *   tools/list — enumerate operational tools with JSON schemas
 *   tools/call — invoke a tool (naming the caller / intent)
 *
 * THE INTERCEPTION GATE (HITL enforcement):
 * Every high-impact tool is marked `intercepted: true`. Instead of running,
 * it writes a pending row to the D1 approval queue and returns the task_id.
 * Only after a human approves via the Central Station (and the task reaches
 * "approved") can the task be executed through /api/v1/tasks/:id/execute.
 */

import { Hono, type Context } from "hono";
import { classify, generateTaskId } from "./proxy-bridge";
import { createTask, listTasks } from "../db/tasks";
import { execute } from "./executor";
import { getSessionUser, type SessionUser } from "../lib/session";
import {
  createIdempotencyStore,
  devBypassEnabled,
  discoveryExtension,
  idempotencyKeyFrom,
  lookupIdempotent,
  paramsFingerprint,
  paymentRequiredBody,
  paymentRequiredHeaders,
  priceUsd,
  recordIdempotent,
  requiresPayment,
  resolveX402Config,
  settlementHeaders,
  settleVerifiedPayment,
  toAtomicUnits,
  verifyX402Payment,
  type IdempotencyRecord,
  type VerifiedPayment,
  type X402Config,
  type X402Env,
} from "../lib/x402";
import { TOOL_DEFS, READ_ONLY_TOOLS, type ToolDef } from "./tools";

export interface McpEnv extends X402Env {
  DB: D1Database;
  SESSIONS?: KVNamespace;
}

interface McpTool {
  name: string;
  description: string;
  intercepted: boolean;
  inputSchema: ToolDef["inputSchema"];
}

/**
 * Executable tools, derived from the Tool Registry (tools.ts) — the single
 * source of truth. Registry entries without an `mcpName` are catalog-only
 * (planned/stub) and are not exposed on the execution surface.
 */
const TOOLS: McpTool[] = TOOL_DEFS.filter((t) => t.mcpName).map((t) => ({
  name: t.mcpName as string,
  description: t.description,
  intercepted: t.intercepted,
  inputSchema: t.inputSchema,
}));

/** Read-only tools skip the interception gate (derived from the registry). */
const READ_ONLY: Record<string, boolean> = Object.fromEntries(
  [...READ_ONLY_TOOLS].map((name) => [name, true])
);

function evalBlocked(args: Record<string, unknown>): boolean {
  const { execute = false } = args;
  return execute === true;
}

function rpcResult(id: unknown, result: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    result: { content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result) }] },
  };
}

/**
 * Build the executor context for an MCP caller — passes through the
 * platform bindings (vault cipher key, Cloudflare account/token) so
 * vault decryption and the platform model fallback work over MCP.
 * The operator is always the signed-in caller (tools/call is session-gated).
 */
function execCtx(c: Context<{ Bindings: McpEnv }>, caller: SessionUser) {
  const env = c.env as unknown as Record<string, unknown>;
  return {
    DB: c.env.DB,
    VAULT_CIPHER_KEY: env.VAULT_CIPHER_KEY as string | undefined,
    CF_ACCOUNT_ID: env.CF_ACCOUNT_ID as string | undefined,
    CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN as string | undefined,
    operator: caller,
  } as unknown as Parameters<typeof execute>[2];
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * Answer a replayed paid call with the record written when it first settled.
 * The stored body is returned verbatim, so the caller sees the original
 * response and the tool is neither re-executed nor charged again.
 */
function replayResponse(record: IdempotencyRecord): Response {
  return new Response(record.result, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x402-idempotent-replay": "true",
      "x402-settlement-transaction": record.settlement.transaction,
    },
  });
}

/**
 * The Interception Gate. If `force` (real execution) is not explicitly
 * granted for an intercepted tool, we halt and enqueue a pending task.
 */
async function intercept(
  db: D1Database,
  tool: McpTool,
  args: Record<string, unknown>
): Promise<{ awaited: boolean; result: unknown }> {
  if (!tool.intercepted || evalBlocked({ ...args, force: args.force })) {
    return { awaited: false, result: null };
  }

  const taskId = generateTaskId("mcp");
  const classification = classify({
    source: "mcp",
    intent: `requesting ${tool.name}`,
    payload: { ...args },
  });

  await createTask(db, {
    id: taskId,
    source: "mcp",
    priority: "high",
    action: tool.name,
    payload: {
      tool: tool.name,
      args,
      _classification: {
        intent: classification.intent,
        autonomy: "review",
        confidence: 0.99,
      },
    },
  });

  return {
    awaited: true,
    result: {
      status: "pending_approval",
      message: `HITL interception: ${tool.name} requires human approval before execution`,
      task_id: taskId,
      review_endpoint: `/api/v1/tasks/${taskId}`,
    },
  };
}

const mcp = new Hono<{ Bindings: McpEnv }>();

mcp.post("/", async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json(rpcError(null, -32700, "Parse error"));
  }
  const { jsonrpc, id, method, params } = body ?? {};
  if (jsonrpc !== "2.0") return c.json(rpcError(id, -32600, "Invalid Request"));

  switch (method) {
    case "tools/list": {
      return c.json(
        rpcResult(id, {
          tools: TOOLS.map(({ name, description, inputSchema, intercepted }) => ({
            name,
            description: intercepted ? `${description} [HITL-INTERCEPTED]` : description,
            inputSchema,
          })),
          // Bazaar discovery documents for the whole catalogue. A 402 challenge
          // carries the same document for the tool it was issued against; this
          // is where an agent finds the tools that are catalogued but not yet
          // callable, together with the price each one will be charged.
          discovery: TOOL_DEFS.map((tool) => ({
            tool: tool.name,
            mcp_name: tool.mcpName ?? null,
            price_usd: tool.x402_price_usd,
            price_atomic: toAtomicUnits(tool.x402_price_usd),
            extensions: discoveryExtension(tool.name),
          })),
          isError: false,
        })
      );
    }

    case "tools/call": {
      // Session gate — tools/list stays public as discovery, but INVOCATION
      // requires a signed-in operator. Fail closed when the session store
      // is unavailable: no SESSIONS binding means no one to trust.
      // (JSON-RPC error shape, HTTP 401.)
      const caller = c.env.SESSIONS
        ? await getSessionUser(c.env as { SESSIONS: KVNamespace }, c.req.raw)
        : null;
      if (!caller) {
        return c.json(rpcError(id, -32000, "Unauthorized: sign in at clawdyclaw.com to call tools"), 401);
      }

      const params2 = (params ?? {}) as {
        name?: string;
        arguments?: Record<string, unknown>;
        _meta?: Record<string, unknown>;
      };
      const tool = TOOLS.find((t) => t.name === params2.name);
      if (!tool) return c.json(rpcError(id, -32602, `Unknown tool: ${params2.name}`));

      const args = (params2.arguments ?? {}) as Record<string, unknown>;
      const resource = new URL(c.req.url).origin + "/mcp/v1";

      // The x402 Payment Gate — priced tools require payment authorization.
      // Runs after the session gate: 401 (who are you) precedes 402 (pay me).
      // $0 tools skip the gate; X402_DEV_BYPASS=true skips it for local testing.
      //
      // The gate order continues below: a verified payment precedes the
      // Interception Gate, and settlement happens only once the tool actually
      // produced a result.
      const usd = priceUsd(tool.name);
      const store = createIdempotencyStore(c.env);
      const fingerprint = paramsFingerprint(tool.name, args);
      const idempotencyKey = idempotencyKeyFrom(c.req.raw, params2._meta);
      let railConfig: X402Config | undefined;
      let verified: VerifiedPayment | undefined;
      if (requiresPayment(usd) && !devBypassEnabled(c.env)) {
        const rail = resolveX402Config(c.env);
        if (!rail.ok) return c.json(rpcError(id, -32003, `x402 rail not configured: ${rail.reason}`), 503);
        railConfig = rail.config;

        const verification = await verifyX402Payment(c.req.raw, {
          toolName: tool.name,
          usd: usd as number,
          env: c.env,
          resource,
          meta: params2._meta,
          config: railConfig,
          gatewayFronted: c.req.header("payment-context") !== undefined,
        });
        if (!verification.ok) {
          // A retry of an already-settled call arrives carrying the same signed
          // authorization, whose nonce the chain has since spent, so the
          // facilitator rejects it. The stored record answers that retry: the
          // idempotency key is the caller's own secret and the tool arguments
          // have to match the record exactly.
          if (idempotencyKey) {
            const replay = await lookupIdempotent(store, idempotencyKey, fingerprint);
            if (replay.status === "replay") return replayResponse(replay.record);
          }
          const body = await paymentRequiredBody(tool.name, usd as number, {
            config: rail.config,
            resource,
          }).catch(() => null);
          if (!body) {
            return c.json(rpcError(id, -32003, "x402 rail could not quote this call"), 503);
          }
          return c.json(body, 402, paymentRequiredHeaders(body));
        }
        verified = verification;
      }

      // A paid call that verifies again under a key already on record: serve
      // the original result, so the tool does not run and no second payment is
      // taken. This sits above the Interception Gate so a retry of an already
      // settled call does not queue the task a second time.
      if (idempotencyKey) {
        const lookup = await lookupIdempotent(store, idempotencyKey, fingerprint);
        if (lookup.status === "replay") return replayResponse(lookup.record);
        if (lookup.status === "conflict") {
          return c.json(
            rpcError(id, -32001, "Idempotency key was already used with different arguments"),
            409
          );
        }
      }

      // The Interception Gate — halt & enqueue unless read-only.
      // An intercepted call has not run yet, so it is answered without
      // settling: the queue entry is not the paid result.
      if (!READ_ONLY[tool.name]) {
        const gate = await intercept(c.env.DB, tool, args);
        if (gate.awaited) return c.json(rpcResult(id, gate.result));
      }

      // Read-only / approved executions
      let payload: unknown;
      switch (tool.name) {
        case "list_tasks": {
          const tasks = await listTasks(c.env.DB, { status: (args.status as string) || undefined });
          payload = { tasks: tasks.map((t) => ({ id: t.id, status: t.status, action: t.action })) };
          break;
        }
        case "classify_intent":
          payload = classify(args);
          break;
        case "search_threads":
          payload = {
            ok: true,
            message: "inbox search requires Gmail access token (not yet provisioned)",
            query: args.query,
          };
          break;
        case "model_infer":
        case "hf_infer":
        case "cloudflare_ai":
        case "flux_image":
        default: {
          // Any other registered (non-intercepted) tool routes through the
          // executor — new executor tools work over MCP with no code change
          // here. Tools with no executor surface as -32601.
          const result = await execute(tool.name, args, execCtx(c, caller));
          const out = result.output as { error?: string } | null;
          if (!result.ok && out && typeof out === "object" && out.error === "UNKNOWN_TOOL") {
            return c.json(rpcError(id, -32601, `Tool ${tool.name} has no executor`));
          }
          payload = result.output;
          break;
        }
      }

      // Settlement — only a call that produced a result is charged. A failed
      // settlement withholds the result rather than serving an unpaid one.
      let settlement: Awaited<ReturnType<typeof settleVerifiedPayment>> | undefined;
      if (verified) {
        settlement = await settleVerifiedPayment(verified, { env: c.env, config: railConfig });
        if (!settlement.success) {
          return c.json(
            rpcError(id, -32002, `Payment settlement failed: ${settlement.errorReason ?? "unknown"}`),
            402
          );
        }
      }

      const base = rpcResult(id, payload);
      const body = settlement
        ? { ...base, result: { ...base.result, _meta: { "x402/payment-response": settlement } } }
        : base;

      // The replay record holds the exact bytes this caller is about to get, so
      // a retry under the same key returns the same response body.
      if (idempotencyKey && verified && settlement) {
        const record: IdempotencyRecord = {
          tool: tool.name,
          fingerprint,
          result: JSON.stringify(body),
          settlement,
          createdAt: Date.now(),
        };
        await recordIdempotent(store, idempotencyKey, record);
      }

      return c.json(body, 200, settlement ? settlementHeaders(settlement) : undefined);
    }

    default:
      return c.json(rpcError(id, -32601, "Method not found"));
  }
});

export default mcp;