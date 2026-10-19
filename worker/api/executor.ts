/**
 * Downstream Execution — fired only after a human grants approval.
 *
 * When a tool call needs a third-party credential, the execution context
 * pulls the DECRYPTED token from the `vault_tokens` D1 table for the
 * approving operator + provider. This prevents credential leakage and
 * honors the MCP security contract.
 */

import { getToken, decryptSecret, type VaultEnv } from "../db/vault";
import { infer, type InferContext } from "./infer";
import {
  gmailSend,
  draftOutreachEmail,
  draftReplyEmail,
  draftFollowUpEmail,
  runApifyScrape,
  scheduleFollowUp,
  type OutreachContext,
} from "./outreach";

/** Adapt the executor context for the outreach module. */
function outreachCtx(ctx: ExecutorContext): OutreachContext {
  return ctx as unknown as OutreachContext;
}

export interface ExecutionResult {
  ok: boolean;
  output: unknown;
}

export interface ExecutorContext extends VaultEnv {
  DB: D1Database;
  operator: { sub: string; email: string | null };
  CF_ACCOUNT_ID?: string;
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
      return draftOutreachEmail(outreachCtx(ctx), args);
    }

    case "send_email": {
      // Real Gmail send. HITL approval happened upstream (MCP interception
      // or task approval) — by the time this runs, a human has said yes.
      return gmailSend(
        outreachCtx(ctx),
        args.to as string,
        args.subject as string,
        args.body as string
      );
    }

    case "draft_reply": {
      return draftReplyEmail(outreachCtx(ctx), args);
    }

    case "draft_follow_up": {
      return draftFollowUpEmail(outreachCtx(ctx), args);
    }

    case "schedule_follow_up": {
      return scheduleFollowUp(outreachCtx(ctx), args);
    }

    case "run_scraper": {
      return runApifyScrape(outreachCtx(ctx), args);
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

    // ── Model inference family (openWeights via HuggingFace, CF edge, image) ──
    case "model_infer": {
      const provider = (args.provider as string) ?? "huggingface";
      const result = await infer(provider, args as { model?: string; prompt?: string; messages?: { role: string; content: string }[] }, ctx as unknown as InferContext);
      return { ok: result.ok, output: result };
    }
    case "hf_infer":
      return handleInfer(ctx, "huggingface", args);
    case "cloudflare_ai":
      return handleInfer(ctx, "cloudflare", args);
    case "flux_image":
      return handleInfer(ctx, "flux", args);

    default:
      return { ok: false, output: { error: "UNKNOWN_TOOL", tool } };
  }
}

async function handleInfer(
  ctx: ExecutorContext,
  provider: string,
  args: Record<string, unknown>
): Promise<ExecutionResult> {
  const result = await infer(provider, args as { model?: string; prompt?: string; image_prompt?: string }, ctx as unknown as InferContext);
  return { ok: result.ok, output: result };
}