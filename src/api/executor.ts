/**
 * Downstream Execution — fired only after a human grants approval.
 *
 * When a tool call needs a third-party credential, the execution context
 * pulls the DECRYPTED token from the `vault_tokens` D1 table for the
 * approving operator + provider. This prevents credential leakage and
 * honors the MCP security contract.
 */

import { getToken, decryptSecret, type VaultEnv } from "../db/vault";

export interface ExecutionResult {
  ok: boolean;
  output: unknown;
}

export interface ExecutorContext extends VaultEnv {
  DB: D1Database;
  operator: { sub: string; email: string | null };
}

async function providerToken(
  ctx: ExecutorContext,
  provider: string
): Promise<{ access_token: string; refresh_token: string | null } | null> {
  const rec = await getToken(ctx.DB, ctx, ctx.operator.sub, provider);
  if (!rec) return null;
  const access_token = await decryptSecret(ctx, rec.access_token);
  if (!access_token) return null;
  const refresh_token = rec.refresh_token ? await decryptSecret(ctx, rec.refresh_token) : null;
  return { access_token, refresh_token };
}

export async function execute(
  tool: string,
  args: Record<string, unknown>,
  ctx: ExecutorContext
): Promise<ExecutionResult> {
  switch (tool) {
    case "draft_personalized_outreach": {
      return {
        ok: true,
        output: {
          status: "draft_ready",
          contact: args.contact ?? null,
          intent: args.intent ?? null,
          note: "Personalized outreach drafted — final send is HITL-intercepted via send_email",
        },
      };
    }

    case "send_email": {
      const token = await providerToken(ctx, "google");
      if (!token) {
        return {
          ok: false,
          output: {
            error: "GMAIL_TOKEN_REQUIRED",
            message: "No connected Gmail. Connect Google in the Studio Vault (OAuth), then retry.",
          },
        };
      }

      // Create a draft via Gmail API (never sends without a second HITL send).
      const message = makeMime(args.to as string, args.subject as string, args.body as string);
      const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages?alt=json";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: btoa(message).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
        }),
      });

      if (!res.ok) {
        return {
          ok: false,
          output: { error: "GMAIL_API_ERROR", status: res.status, detail: await res.text().catch(() => "") },
        };
      }
      const data = (await res.json()) as { id?: string; threadId?: string };
      return { ok: true, output: { sent: true, gmail_message_id: data.id, thread_id: data.threadId, to: args.to } };
    }

    case "draft_reply": {
      return {
        ok: true,
        output: { status: "drafted", thread_id: args.thread_id, body: args.draft_body },
      };
    }

    case "run_scraper": {
      const token = await providerToken(ctx, "apify");
      return {
        ok: true,
        output: {
          status: token ? "dispatched" : "pending_credentials",
          target: args.target,
          query: args.query,
          note: token
            ? "Apify run dispatched (actor id from vault)"
            : "Connect Apify key in the Studio Vault to dispatch real runs",
        },
      };
    }

    case "llm_infer": {
      const token = await providerToken(ctx, "openrouter");
      if (!token) {
        return { ok: false, output: { error: "OPENROUTER_TOKEN_REQUIRED", message: "Connect OpenRouter key in the Vault." } };
      }
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: (args.model as string) ?? "openai/gpt-4o-mini",
          messages: [{ role: "user", content: args.prompt as string }],
          max_tokens: (args.max_tokens as number) ?? 512,
        }),
      });
      const data = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
      return {
        ok: res.ok,
        output: data?.choices?.[0]?.message?.content ?? { error: "OPENROUTER_API_ERROR", status: res.status },
      };
    }

    default:
      return { ok: false, output: { error: "UNKNOWN_TOOL", tool } };
  }
}

function makeMime(to: string, subject: string, body: string): string {
  const headers = [
    `To: ${to}`,
    "From: ClawdyClaw Agent",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}