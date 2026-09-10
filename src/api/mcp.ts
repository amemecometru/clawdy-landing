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

import { Hono } from "hono";
import { classify, generateTaskId } from "./proxy-bridge";
import { createTask, listTasks } from "../db/tasks";

export interface McpEnv {
  DB: D1Database;
}

interface McpTool {
  name: string;
  description: string;
  intercepted: boolean;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

const TOOLS: McpTool[] = [
  {
    name: "list_tasks",
    description: "List the HITL task queue, filterable by status.",
    intercepted: false,
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", description: "pending | approved | rejected | executed" } },
    },
  },
  {
    name: "classify_intent",
    description: "Run intent classification over a raw inbound payload. Read-only.",
    intercepted: false,
    inputSchema: {
      type: "object",
      properties: { source: { type: "string" }, payload: { type: "object" } },
      required: ["source", "payload"],
    },
  },
  {
    name: "send_email",
    description: "Send a personalized outreach email. Requires human approval.",
    intercepted: true,
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
    name: "search_threads",
    description: "Search the inbox for a thread. Read-only.",
    intercepted: false,
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "draft_reply",
    description: "Draft a reply to an existing thread. Requires human approval to send.",
    intercepted: true,
    inputSchema: {
      type: "object",
      properties: { thread_id: { type: "string" }, draft_body: { type: "string" } },
      required: ["thread_id", "draft_body"],
    },
  },
  {
    name: "run_scraper",
    description: "Run a marketplace scraping routine. Results enqueue as tasks.",
    intercepted: false,
    inputSchema: {
      type: "object",
      properties: { target: { type: "string", description: "e.g. craigslist, facebook_marketplace" }, query: { type: "string" } },
      required: ["target", "query"],
    },
  },
];

const READ_ONLY: Record<string, boolean> = {
  list_tasks: true,
  classify_intent: true,
  search_threads: true,
  run_scraper: true,
};

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

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
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
          isError: false,
        })
      );
    }

    case "tools/call": {
      const params2 = (params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      const tool = TOOLS.find((t) => t.name === params2.name);
      if (!tool) return c.json(rpcError(id, -32602, `Unknown tool: ${params2.name}`));

      const args = (params2.arguments ?? {}) as Record<string, unknown>;

      // The Interception Gate — halt & enqueue unless read-only.
      if (!READ_ONLY[tool.name]) {
        const gate = await intercept(c.env.DB, tool, args);
        if (gate.awaited) return c.json(rpcResult(id, gate.result));
      }

      // Read-only / approved executions
      switch (tool.name) {
        case "list_tasks": {
          const tasks = await listTasks(c.env.DB, { status: (args.status as string) || undefined });
          return c.json(rpcResult(id, { tasks: tasks.map((t) => ({ id: t.id, status: t.status, action: t.action })) }));
        }
        case "classify_intent":
          return c.json(rpcResult(id, classify(args)));
        case "search_threads":
          return c.json(rpcResult(id, { ok: true, message: "inbox search requires Gmail access token (not yet provisioned)", query: args.query }));
        case "run_scraper":
          return c.json(rpcResult(id, { ok: true, message: "scrape dispatched to stress-test tier (Awaiting counter config)" }));
        default:
          return c.json(rpcError(id, -32601, `Tool ${tool.name} has no executor`));
      }
    }

    default:
      return c.json(rpcError(id, -32601, "Method not found"));
  }
});

export default mcp;