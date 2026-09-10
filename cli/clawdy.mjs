#!/usr/bin/env node
/**
 * ClawdyClaw CLI — talk to the running edge worker from your terminal.
 *
 * Zero dependencies. Requires Node.js >= 18 (global fetch).
 *
 *   CLAWDYCLAW_BASE_URL  → default "https://clawdyclaw.logiclemonai.workers.dev"
 *   CLAWDYCLAW_TOKEN     → optional bearer token (config token, NOT a vault secret)
 *
 * Commands:
 *   status          → worker health
 *   tasks [status]  → task queue (pending/approved/rejected/executed)
 *   telemetry       → ingress + execution feed
 *   models          → model registry + connection status
 *   integrations    → integration catalog + vault status
 *   widgets         → mounted Studio dashboard widgets
 *   feed <platform> → live feed items for a platform (youtube|medium|substack|hackernoon)
 *   webhook <src> <json> → POST to the universal ingress
 *   simulate <json> → dry-run sandbox classify trace
 *   auth            → print vault connect URLs for OAuth providers
 */

const BASE_URL = process.env.CLAWDYCLAW_BASE_URL || "https://clawdyclaw.logiclemonai.workers.dev";
const TOKEN = process.env.CLAWDYCLAW_TOKEN || "";

function usage() {
  console.log(String.raw`
  ClawdyClaw edge CLI  (${BASE_URL})

  usage: clawdy <command> [args]

  status              worker health check
  tasks [status]      task queue (pending | approved | rejected | executed)
  telemetry           ingress + execution feed
  models              model registry + connection status
  integrations        integration catalog + vault status
  widgets             mounted Studio dashboard widgets
  feed <platform>     live feed items  (youtube | medium | substack | hackernoon)
  webhook <src> <json>  POST an inbound payload to /api/v1/webhook/ingress
  simulate <json>     dry-run sandbox classify trace
  auth                print vault connect URLs for OAuth providers
  help                this message
`);
}

async function api(path, opts = {}) {
  const headers = { "content-type": "application/json", ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) };
  const res = await fetch(`${BASE_URL}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  if (!res.ok) throw new Error(`[${res.status}] ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

function print(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case "status": {
      const h = await api("/api/health");
      console.log(`● worker ${h.status} · ${h.domain} · ${h.timestamp}`);
      return;
    }

    case "tasks": {
      const q = args[0] ? `?status=${encodeURIComponent(args[0])}` : "";
      const { tasks } = await api(`/api/v1/tasks${q}`);
      if (tasks.length === 0) return console.log("queue empty");
      for (const t of tasks) {
        console.log(`${t.status.padEnd(9)} ${t.id}  ${t.source.padEnd(10)} ${t.action}`);
      }
      return;
    }

    case "telemetry": {
      const data = await api("/api/v1/telemetry");
      console.log(`ingress:   ${data.ingress.length}  executions: ${data.executions.length}`);
      for (const e of data.executions.slice(0, 10)) {
        const ok = e.ok ? "✓" : "✗";
        console.log(`  ${ok} ${e.tool.padEnd(24)} ${JSON.stringify(e.result).slice(0, 120)}`);
      }
      return;
    }

    case "models": {
      const data = await api("/api/v1/models");
      console.log(`inference backbone: worker-edge · providers bound ${data.inference_backbone.providers_bound}`);
      for (const m of data.models) {
        console.log(`  ${m.connected ? "●" : "○"} ${m.name.padEnd(30)} [${m.category}] ${m.models.join(", ")}`);
      }
      return;
    }

    case "integrations": {
      const data = await api("/api/v1/integrations");
      console.log(`vault holder: ${data.user.email || data.user.sub}`);
      for (const i of data.integrations) {
        console.log(`  ${i.connected ? "●" : "○"} ${i.name.padEnd(30)} [${i.mode}] ${i.tools.join(", ")}`);
      }
      return;
    }

    case "widgets": {
      const data = await api("/api/v1/portal/widgets");
      console.log(`dashboard widgets mounted: ${data.widgets.length}`);
      for (const w of data.widgets) {
        console.log(`  ◈ ${w.name.padEnd(24)} [${w.type}] pos ${w.position}  ${JSON.stringify(w.config)}`);
      }
      return;
    }

    case "feed": {
      const [platform, configJson] = args;
      if (!platform) throw new Error("feed requires a platform: youtube | medium | substack | hackernoon");
      const config = configJson ? JSON.parse(configJson) : {};
      const data = await api(`/api/v1/feeds/${platform}?config=${encodeURIComponent(JSON.stringify(config))}`);
      if (!data.ok) {
        console.log(`${platform}: ${data.error || "no feed source"}`);
        return;
      }
      console.log(`${platform} · ${data.items.length} items · ${data.source}`);
      for (const item of data.items.slice(0, 8)) {
        console.log(`  → ${item.title}`);
      }
      return;
    }

    case "webhook": {
      const [source, payloadJson] = args;
      if (!source || !payloadJson) throw new Error("webhook requires: clawdy webhook <source> '<json>'");
      const payload = JSON.parse(payloadJson);
      const data = await api("/api/v1/webhook/ingress", {
        method: "POST",
        body: JSON.stringify({ source, payload }),
      });
      print(data);
      return;
    }

    case "simulate": {
      const [payloadJson] = args;
      if (!payloadJson) throw new Error("simulate requires: clawdy simulate '<json>'");
      const body = JSON.parse(payloadJson);
      const data = await api("/api/v1/sandbox/simulate", { method: "POST", body: JSON.stringify(body) });
      print(data);
      return;
    }

    case "auth": {
      console.log("connect URLs (paste in a browser, then re-run):");
      console.log(`  google     ${BASE_URL}/api/v1/auth/google/connect`);
      console.log(`  github     ${BASE_URL}/api/v1/auth/github/connect`);
      console.log("\napi-key providers bind through the Studio vault:");
      console.log("  https://agents.clawdyclaw.com/studio/vault");
      return;
    }

    case "help":
    case "--help":
    case "-h":
    case undefined:
      return usage();

    default:
      throw new Error(`unknown command: ${cmd}`);
  }
}

main().catch((err) => {
  process.stderr.write(`clawdy: ${err.message}\n`);
  process.exitCode = 1;
});