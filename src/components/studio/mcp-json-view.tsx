/**
 * Agent MCP JSON Schema view — raw task records + tool definitions,
 * formatted for machine consumption.
 */
import type { Task } from "@/lib/api";

export function McpJsonView({ tasks }: { tasks: Task[] }) {
  const doc = {
    schema_version: "2024-11-05",
    host: "agents.clawdyclaw.com",
    task_queue: tasks.map((t) => {
      let payload = {};
      try {
        payload = JSON.parse(t.payload);
      } catch {
        /* keep empty */
      }
      return {
        id: t.id,
        source: t.source,
        priority: t.priority,
        action: t.action,
        status: t.status,
        payload,
        created_at: t.created_at,
      };
    }),
    tools: [
      {
        name: "list_tasks",
        method: "GET /api/v1/tasks",
        parameters: [{ name: "status", type: "string", required: false }],
      },
      {
        name: "approve_task",
        method: "POST /api/v1/tasks/:id/approve",
        parameters: [
          { name: "operator", type: "string", required: false },
          { name: "note", type: "string", required: false },
        ],
      },
      {
        name: "reject_task",
        method: "POST /api/v1/tasks/:id/reject",
        parameters: [
          { name: "operator", type: "string", required: false },
          { name: "note", type: "string", required: false },
        ],
      },
      {
        name: "execute_task",
        method: "POST /api/v1/tasks/:id/execute",
        description: "Only valid after human approval",
      },
    ],
  };

  return (
    <pre className="overflow-x-auto rounded-xl border border-silver/25 bg-obsidian/80 p-4 font-mono text-xs leading-relaxed text-emerald-300">
      {JSON.stringify(doc, null, 2)}
    </pre>
  );
}