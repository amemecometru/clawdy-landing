/**
 * Outreach Campaign API — /api/v1/campaigns
 *
 * Owner-scoped campaign management with a 3-step HITL-gated outreach sequence:
 *
 *   step 0 → discovery message
 *   step 1 → warm follow-up
 *   step 2 → no-reply follow-up
 *
 * Messages are never delivered from this worker. Sending is simulated and the
 * result is persisted on the campaign_messages row so the sequence state can be
 * advanced without contacting any email provider.
 */

import { Hono, type Context } from "hono";
import { getSessionUser, type SessionUser } from "../lib/session";
import { gmailSend, type OutreachContext } from "./outreach";
import { ensureSessionIdentity, sessionIdentityExists } from "../db/sessions";
import {
  boundedInteger,
  integerValue,
  isCampaignStatus,
  isMessageType,
  isProfessionalTier,
  nowSeconds,
  optionalText,
  readJsonObject,
  textValue,
  type MessageType,
} from "../lib/brand";
import {
  addCampaignLeads,
  approveCampaignMessage,
  createCampaign,
  createCampaignMessage,
  ensureCampaignLead,
  getCampaign,
  getCampaignLead,
  getOwnedCampaignMessage,
  listCampaignLeads,
  listCampaignMessages,
  listCampaignMessagesForCampaign,
  listCampaigns,
  markCampaignMessageSent,
  updateCampaign,
  type CampaignLeadDetail,
} from "../db/campaigns";

export interface CampaignEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  VAULT_CIPHER_KEY?: string;
}

type CampaignApp = Hono<{ Bindings: CampaignEnv; Variables: { owner: SessionUser } }>;
type CampaignContext = Context<{ Bindings: CampaignEnv; Variables: { owner: SessionUser } }>;

const campaigns: CampaignApp = new Hono<{
  Bindings: CampaignEnv;
  Variables: { owner: SessionUser };
}>();

campaigns.use("*", async (c, next) => {
  const user = await getSessionUser(c.env, c.req.raw);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (!(await sessionIdentityExists(c.env.DB, user.sub))) {
    await ensureSessionIdentity(c.env.DB, user);
  }
  c.set("owner", user);
  await next();
});

const STEP_MESSAGE_TYPES: MessageType[] = ["discovery", "warm_reply", "no_reply_followup"];

export function buildDefaultMessage(
  lead: CampaignLeadDetail,
  step: number
): { message_type: MessageType; subject: string; body: string } {
  const firstName = lead.first_name;
  const target = lead.target_role;
  const current = lead.current_role;
  if (step <= 0) {
    return {
      message_type: STEP_MESSAGE_TYPES[0],
      subject: `Quick question about your next move`,
      body: [
        `Hi ${firstName},`,
        "",
        `I noticed you're working as a ${current} and heading toward ${target}.`,
        "I run a small studio that builds personal brand sites for people making that exact move — a clean one-page site with your work, your positioning, and an address you can put in your outreach.",
        "Would you be open to a 15-minute call next week? If it's not relevant, no problem at all.",
        "",
        "— Clawdy Studio",
      ].join("\n"),
    };
  }
  if (step === 1) {
    return {
      message_type: STEP_MESSAGE_TYPES[1],
      subject: `Re: your personal brand site`,
      body: [
        `Hi ${firstName},`,
        "",
        "Following up briefly — the sites I build usually go live in about a week and cost less than a single coaching package.",
        `If a ${target} narrative is what you're working on, I can send a two-page outline of what yours would look like. No charge, no obligation.`,
        "",
        "Worth a short call?",
        "",
        "— Clawdy Studio",
      ].join("\n"),
    };
  }
  return {
    message_type: STEP_MESSAGE_TYPES[2],
    subject: `Closing the loop`,
    body: [
      `Hi ${firstName},`,
      "",
      "One last note so I don't clutter your inbox. I'll assume this isn't the right time and close it out here.",
      "If things change down the road, my door is open.",
      "",
      "Best,",
      "Clawdy Studio",
    ].join("\n"),
  };
}

campaigns.get("/", async (c) => {
  const limit = boundedInteger(c.req.query("limit"), 50, 1, 200);
  const offset = boundedInteger(c.req.query("offset"), 0, 0, 100000);
  const results = await listCampaigns(c.env.DB, c.get("owner").sub, limit, offset);
  return c.json({ campaigns: results, count: results.length, limit, offset });
});

campaigns.post("/", async (c) => {
  const body = await readJsonObject(c.req.raw);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const name = textValue(body.name);
  if (!name) return c.json({ error: "name is required" }, 400);
  const tier = textValue(body.tier) ?? "basic";
  if (!isProfessionalTier(tier)) return c.json({ error: "Invalid tier" }, 400);
  const status = textValue(body.status) ?? "draft";
  if (!isCampaignStatus(status)) return c.json({ error: "Invalid status" }, 400);

  const campaign = await createCampaign(c.env.DB, {
    owner_sub: c.get("owner").sub,
    name,
    description: optionalText(body.description),
    tier,
    status,
  });

  let leads: { added: number; skipped: number } = { added: 0, skipped: 0 };
  if (Array.isArray(body.professional_ids)) {
    const ids = body.professional_ids.filter((id): id is string => typeof id === "string" && id.length > 0);
    leads = await addCampaignLeads(c.env.DB, campaign.id, c.get("owner").sub, ids);
  }
  return c.json({ campaign, leads }, 201);
});

campaigns.get("/:id", async (c) => {
  const owner = c.get("owner").sub;
  const campaign = await getCampaign(c.env.DB, c.req.param("id"), owner);
  if (!campaign) return c.json({ error: "Campaign not found" }, 404);
  const leads = await listCampaignLeads(c.env.DB, campaign.id, owner, 200, 0);
  const messages = await listCampaignMessagesForCampaign(c.env.DB, campaign.id, owner);
  return c.json({
    campaign,
    leads,
    messages,
    counts: {
      leads: leads.length,
      pending: leads.filter((lead) => lead.sequence_status === "pending").length,
      sent: leads.filter((lead) => lead.sequence_status === "sent").length,
      positive: leads.filter((lead) => lead.sequence_status === "positive").length,
    },
  });
});

campaigns.patch("/:id", async (c) => {
  const owner = c.get("owner").sub;
  const body = await readJsonObject(c.req.raw);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  if (!(await getCampaign(c.env.DB, c.req.param("id"), owner))) {
    return c.json({ error: "Campaign not found" }, 404);
  }
  if (body.status !== undefined && !isCampaignStatus(body.status)) {
    return c.json({ error: "Invalid status" }, 400);
  }
  if (body.tier !== undefined && !isProfessionalTier(body.tier)) {
    return c.json({ error: "Invalid tier" }, 400);
  }
  const updates: Record<string, unknown> = {};
  for (const field of ["name", "description", "status", "tier"] as const) {
    if (body[field] === undefined) continue;
    updates[field] = body[field] === null ? null : optionalText(body[field]);
  }
  const campaign = await updateCampaign(c.env.DB, c.req.param("id"), owner, updates);
  return c.json({ campaign });
});

campaigns.get("/:id/leads", async (c) => {
  const owner = c.get("owner").sub;
  if (!(await getCampaign(c.env.DB, c.req.param("id"), owner))) {
    return c.json({ error: "Campaign not found" }, 404);
  }
  const limit = boundedInteger(c.req.query("limit"), 100, 1, 500);
  const offset = boundedInteger(c.req.query("offset"), 0, 0, 100000);
  const leads = await listCampaignLeads(c.env.DB, c.req.param("id"), owner, limit, offset);
  return c.json({ leads, count: leads.length, limit, offset });
});

campaigns.post("/:id/leads", async (c) => {
  const owner = c.get("owner").sub;
  const body = await readJsonObject(c.req.raw);
  if (!body || !Array.isArray(body.professional_ids)) {
    return c.json({ error: "professional_ids array is required" }, 400);
  }
  if (!(await getCampaign(c.env.DB, c.req.param("id"), owner))) {
    return c.json({ error: "Campaign not found" }, 404);
  }
  const ids = body.professional_ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  const result = await addCampaignLeads(c.env.DB, c.req.param("id"), owner, ids);
  return c.json(result);
});

async function loadLead(c: CampaignContext): Promise<CampaignLeadDetail | null> {
  const owner = c.get("owner").sub;
  const campaignId = c.req.param("id") ?? "";
  const leadId = c.req.param("leadId") ?? "";
  const campaign = await getCampaign(c.env.DB, campaignId, owner);
  if (!campaign) return null;
  const lead = await getCampaignLead(c.env.DB, leadId, owner);
  if (!lead || lead.campaign_id !== campaign.id) return null;
  return lead;
}

campaigns.get("/:id/leads/:leadId", async (c) => {
  const lead = await loadLead(c);
  if (!lead) return c.json({ error: "Campaign lead not found" }, 404);
  const messages = await listCampaignMessages(c.env.DB, lead.id, c.get("owner").sub);
  return c.json({ lead, messages });
});

campaigns.post("/:id/leads/:leadId/messages", async (c) => {
  const lead = await loadLead(c);
  if (!lead) return c.json({ error: "Campaign lead not found" }, 404);
  if (["stopped", "unsubscribe", "negative", "positive"].includes(lead.sequence_status)) {
    return c.json({ error: `Lead is ${lead.sequence_status} and cannot receive messages` }, 409);
  }
  if (lead.sequence_step > 2) {
    return c.json({ error: "Sequence is complete" }, 409);
  }

  const body = (await readJsonObject(c.req.raw)) ?? {};
  const defaultMessage = buildDefaultMessage(lead, lead.sequence_step);
  const messageType = textValue(body.message_type) ?? defaultMessage.message_type;
  if (!isMessageType(messageType)) return c.json({ error: "Invalid message_type" }, 400);
  const status = textValue(body.status) ?? "awaiting_approval";
  if (status !== "draft" && status !== "awaiting_approval") {
    return c.json({ error: "Messages must start as draft or awaiting_approval" }, 400);
  }

  const message = await createCampaignMessage(c.env.DB, lead, {
    message_type: messageType,
    subject: textValue(body.subject) ?? defaultMessage.subject,
    body: textValue(body.body) ?? defaultMessage.body,
    personalization: { lead_id: lead.id, professional_id: lead.professional_id, step: lead.sequence_step },
    status,
  });
  return c.json({ message, lead }, 201);
});

campaigns.post("/:id/message/:step", async (c) => {
  const owner = c.get("owner").sub;
  const campaignId = c.req.param("id") ?? "";
  const step = integerValue(c.req.param("step"));
  if (step === undefined || step < 0 || step > 2) {
    return c.json({ error: "step must be 0, 1 or 2" }, 400);
  }
  if (!(await getCampaign(c.env.DB, campaignId, owner))) {
    return c.json({ error: "Campaign not found" }, 404);
  }
  const body = await readJsonObject(c.req.raw);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const professionalId = textValue(body.professional_id);
  if (!professionalId) return c.json({ error: "professional_id is required" }, 400);

  const lead = await ensureCampaignLead(c.env.DB, campaignId, professionalId, owner);
  if (!lead) return c.json({ error: "Professional not found in this workspace" }, 404);
  if (["stopped", "unsubscribe", "negative", "positive"].includes(lead.sequence_status)) {
    return c.json({ error: `Lead is ${lead.sequence_status} and cannot receive messages` }, 409);
  }

  const defaultMessage = buildDefaultMessage(lead, step);
  const messageType = textValue(body.message_type) ?? defaultMessage.message_type;
  if (!isMessageType(messageType)) return c.json({ error: "Invalid message_type" }, 400);
  const message = await createCampaignMessage(c.env.DB, lead, {
    step,
    message_type: messageType,
    subject: textValue(body.subject) ?? defaultMessage.subject,
    body: textValue(body.body) ?? defaultMessage.body,
    personalization: {
      ...(body.personalization && typeof body.personalization === "object"
        ? (body.personalization as Record<string, unknown>)
        : {}),
      lead_id: lead.id,
      professional_id: lead.professional_id,
      step,
    },
    status: "awaiting_approval",
  });
  return c.json({ message }, 201);
});

const approveMessage = async (c: CampaignContext): Promise<Response> => {
  const owner = c.get("owner").sub;
  const messageId = c.req.param("messageId") ?? "";
  const campaign = await getCampaign(c.env.DB, c.req.param("id") ?? "", owner);
  if (!campaign) return c.json({ error: "Campaign not found" }, 404);
  const message = await approveCampaignMessage(c.env.DB, messageId, owner, owner);
  if (!message) return c.json({ error: "Message not found" }, 404);
  return c.json({ message, status: "approved", approved_at: message.approved_at });
};

campaigns.post("/:id/message/:messageId/approve", approveMessage);
campaigns.post("/messages/:messageId/approve", async (c) => {
  const owner = c.get("owner").sub;
  const message = await approveCampaignMessage(c.env.DB, c.req.param("messageId"), owner, owner);
  if (!message) return c.json({ error: "Message not found" }, 404);
  return c.json({ message, decision: "approved" });
});

campaigns.post("/:id/message/:messageId/send_dry_run", async (c) => {
  const owner = c.get("owner").sub;
  const campaign = await getCampaign(c.env.DB, c.req.param("id") ?? "", owner);
  if (!campaign) return c.json({ error: "Campaign not found" }, 404);
  const message = await getOwnedCampaignMessage(c.env.DB, c.req.param("messageId") ?? "", owner);
  if (!message) return c.json({ error: "Message not found" }, 404);
  return c.json({
    status: "sent (mock)",
    simulated: true,
    persisted: false,
    message,
    simulated_provider_response: {
      provider: "none",
      accepted: true,
      provider_message_id: `simulated-${message.id}`,
      queued_at: nowSeconds(),
      note: "Dry run only: nothing was delivered and no sequence state changed.",
    },
  });
});

const sendMessage = async (c: CampaignContext): Promise<Response> => {
  const owner = c.get("owner");
  const messageId = c.req.param("messageId") ?? "";
  const message = await getOwnedCampaignMessage(c.env.DB, messageId, owner.sub);
  if (!message) return c.json({ error: "Message not found" }, 404);
  if (message.status !== "approved") {
    return c.json({ error: `Message must be approved before sending (current: ${message.status})` }, 409);
  }
  if (!message.subject || !message.body) {
    return c.json({ error: "Message has no subject/body to send" }, 422);
  }
  const lead = await getCampaignLead(c.env.DB, message.campaign_lead_id, owner.sub);
  const to = lead?.email;
  if (!to) return c.json({ error: "Lead has no email address" }, 422);

  // Real Gmail send — the message was human-approved, so this is the HITL
  // green light. Owner's Google token comes from the vault.
  const ctx: OutreachContext = {
    DB: c.env.DB,
    VAULT_CIPHER_KEY: c.env.VAULT_CIPHER_KEY,
    operator: { sub: owner.sub, email: owner.email ?? null },
  };
  const result = await gmailSend(ctx, to, message.subject, message.body);
  if (!result.ok) {
    return c.json({ error: "Send failed", detail: result.output }, 502);
  }
  const out = result.output as { gmail_message_id?: string };
  const sent = await markCampaignMessageSent(
    c.env.DB,
    messageId,
    owner.sub,
    JSON.stringify({
      simulated: false,
      provider: "gmail",
      gmail_message_id: out.gmail_message_id ?? null,
      sent_at: nowSeconds(),
    }),
    out.gmail_message_id ?? null
  );
  return c.json({ message: sent, simulated: false });
};

campaigns.post("/:id/message/:messageId/send", sendMessage);
campaigns.post("/messages/:messageId/send", sendMessage);

campaigns.post("/:id/send_dry_run", async (c) => {
  const owner = c.get("owner").sub;
  const campaign = await getCampaign(c.env.DB, c.req.param("id"), owner);
  if (!campaign) return c.json({ error: "Campaign not found" }, 404);
  if (campaign.status === "completed") {
    return c.json({ error: "Campaign is completed and cannot be dry run" }, 409);
  }

  const leads = await listCampaignLeads(c.env.DB, campaign.id, owner, 500, 0);
  const previews = leads
    .filter((lead) => !["stopped", "unsubscribe", "negative", "positive"].includes(lead.sequence_status))
    .map((lead) => {
      const message = buildDefaultMessage(lead, lead.sequence_step);
      return {
        lead_id: lead.id,
        professional_id: lead.professional_id,
        step: lead.sequence_step,
        message_type: message.message_type,
        subject: message.subject,
        body: message.body,
        requires_approval: true,
        blocked: lead.sequence_step > 2,
      };
    });

  return c.json({
    campaign_id: campaign.id,
    simulated: true,
    persisted: false,
    messages_that_would_send: previews.filter((preview) => !preview.blocked).length,
    blocked: previews.filter((preview) => preview.blocked).length,
    previews,
  });
});

export default campaigns;
