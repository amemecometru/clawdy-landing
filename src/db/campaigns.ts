import { makeId, nowSeconds, parseJson, type CampaignStatus, type MessageStatus, type MessageType, type ProfessionalTier, type SequenceStatus } from "../lib/brand";

export interface ProfessionalCampaign {
  id: string;
  owner_sub: string;
  name: string;
  description: string | null;
  tier: ProfessionalTier;
  status: CampaignStatus;
  created_at: number;
  updated_at: number;
}

export interface CampaignLead {
  id: string;
  campaign_id: string;
  professional_id: string;
  sequence_step: number;
  sequence_status: SequenceStatus;
  next_action_at: number | null;
  stop_reason: string | null;
  created_at: number;
  updated_at: number;
}

export interface CampaignLeadDetail extends CampaignLead {
  first_name: string;
  last_name: string;
  email: string;
  current_role: string;
  current_company: string | null;
  target_role: string;
  target_industry: string | null;
  tier: ProfessionalTier;
  budget_range: string;
  qualification_score: number;
}

export interface CampaignMessage {
  id: string;
  campaign_lead_id: string;
  step: number;
  message_type: MessageType;
  subject: string | null;
  body: string;
  personalization: unknown;
  status: MessageStatus;
  approved_by: string | null;
  approved_at: number | null;
  sent_at: number | null;
  gmail_message_id: string | null;
  provider_response: string | null;
  created_at: number;
  updated_at: number;
}

export interface NewCampaign {
  owner_sub: string;
  name: string;
  description: string | null;
  tier: ProfessionalTier;
  status: CampaignStatus;
}

export async function createCampaign(db: D1Database, input: NewCampaign): Promise<ProfessionalCampaign> {
  const id = makeId("camp");
  const now = nowSeconds();
  await db
    .prepare(
      `INSERT INTO professional_campaigns (id, owner_sub, name, description, tier, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, input.owner_sub, input.name, input.description, input.tier, input.status, now, now)
    .run();
  return (await getCampaign(db, id, input.owner_sub))!;
}

export async function getCampaign(
  db: D1Database,
  id: string,
  ownerSub: string
): Promise<ProfessionalCampaign | null> {
  return db
    .prepare("SELECT * FROM professional_campaigns WHERE id = ? AND owner_sub = ?")
    .bind(id, ownerSub)
    .first<ProfessionalCampaign>();
}

export async function listCampaigns(
  db: D1Database,
  ownerSub: string,
  limit: number,
  offset: number
): Promise<ProfessionalCampaign[]> {
  const result = await db
    .prepare(
      `SELECT * FROM professional_campaigns WHERE owner_sub = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(ownerSub, limit, offset)
    .all<ProfessionalCampaign>();
  return result.results;
}

export async function listCampaignsForProfessional(
  db: D1Database,
  professionalId: string,
  ownerSub: string
): Promise<{ id: string; name: string; status: CampaignStatus; sequence_status: SequenceStatus; sequence_step: number }[]> {
  const result = await db
    .prepare(
      `SELECT c.id, c.name, c.status, l.sequence_status, l.sequence_step
       FROM campaign_leads l
       JOIN professional_campaigns c ON c.id = l.campaign_id
       WHERE l.professional_id = ? AND c.owner_sub = ?
       ORDER BY l.updated_at DESC`
    )
    .bind(professionalId, ownerSub)
    .all<{ id: string; name: string; status: CampaignStatus; sequence_status: SequenceStatus; sequence_step: number }>();
  return result.results;
}

export async function updateCampaign(
  db: D1Database,
  id: string,
  ownerSub: string,
  updates: Record<string, unknown>
): Promise<ProfessionalCampaign | null> {
  const allowed = new Set(["name", "description", "tier", "status"]);
  const columns: string[] = [];
  const binds: unknown[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.has(key)) continue;
    columns.push(`${key} = ?`);
    binds.push(value);
  }
  if (columns.length === 0) return getCampaign(db, id, ownerSub);
  await db
    .prepare(
      `UPDATE professional_campaigns SET ${columns.join(", ")}, updated_at = ? WHERE id = ? AND owner_sub = ?`
    )
    .bind(...binds, nowSeconds(), id, ownerSub)
    .run();
  return getCampaign(db, id, ownerSub);
}

export async function listCampaignLeads(
  db: D1Database,
  campaignId: string,
  ownerSub: string,
  limit: number,
  offset: number
): Promise<CampaignLeadDetail[]> {
  const result = await db
    .prepare(
      `SELECT l.*, p.first_name, p.last_name, p.email, p.current_role, p.current_company,
              p.target_role, p.target_industry, p.tier, p.budget_range, p.qualification_score
       FROM campaign_leads l
       JOIN professional_campaigns c ON c.id = l.campaign_id
       JOIN professionals p ON p.id = l.professional_id
       WHERE l.campaign_id = ? AND c.owner_sub = ? AND p.archived_at IS NULL
       ORDER BY l.updated_at DESC LIMIT ? OFFSET ?`
    )
    .bind(campaignId, ownerSub, limit, offset)
    .all<CampaignLeadDetail>();
  return result.results;
}

export async function getCampaignLead(
  db: D1Database,
  leadId: string,
  ownerSub: string
): Promise<CampaignLeadDetail | null> {
  return db
    .prepare(
      `SELECT l.*, p.first_name, p.last_name, p.email, p.current_role, p.current_company,
              p.target_role, p.target_industry, p.tier, p.budget_range, p.qualification_score
       FROM campaign_leads l
       JOIN professional_campaigns c ON c.id = l.campaign_id
       JOIN professionals p ON p.id = l.professional_id
       WHERE l.id = ? AND c.owner_sub = ?`
    )
    .bind(leadId, ownerSub)
    .first<CampaignLeadDetail>();
}

export async function addCampaignLeads(
  db: D1Database,
  campaignId: string,
  ownerSub: string,
  professionalIds: string[]
): Promise<{ added: number; skipped: number }> {
  const uniqueIds = [...new Set(professionalIds)];
  if (uniqueIds.length === 0) return { added: 0, skipped: 0 };
  const campaign = await getCampaign(db, campaignId, ownerSub);
  if (!campaign) return { added: 0, skipped: uniqueIds.length };

  const placeholders = uniqueIds.map(() => "?").join(", ");
  const owned = await db
    .prepare(
      `SELECT id FROM professionals
       WHERE owner_sub = ? AND archived_at IS NULL AND id IN (${placeholders})`
    )
    .bind(ownerSub, ...uniqueIds)
    .all<{ id: string }>();
  const ownedIds = owned.results.map((row) => row.id);

  const existing = ownedIds.length
    ? await db
        .prepare(
          `SELECT COUNT(*) AS total FROM campaign_leads
           WHERE campaign_id = ? AND professional_id IN (${ownedIds.map(() => "?").join(", ")})`
        )
        .bind(campaignId, ...ownedIds)
        .first<{ total: number }>()
    : null;
  const existingCount = Number(existing?.total ?? 0);

  if (ownedIds.length > 0) {
    const now = nowSeconds();
    await db.batch(
      ownedIds.map((professionalId) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO campaign_leads
              (id, campaign_id, professional_id, sequence_step, sequence_status, created_at, updated_at)
             VALUES (?, ?, ?, 0, 'pending', ?, ?)`
          )
          .bind(makeId("lead"), campaignId, professionalId, now, now)
      )
    );
  }

  return { added: Math.max(ownedIds.length - existingCount, 0), skipped: uniqueIds.length - ownedIds.length };
}

export async function setLeadSequenceState(
  db: D1Database,
  leadId: string,
  ownerSub: string,
  state: Partial<Pick<CampaignLead, "sequence_step" | "sequence_status" | "next_action_at" | "stop_reason">>
): Promise<CampaignLead | null> {
  const lead = await db
    .prepare(
      `SELECT l.* FROM campaign_leads l
       JOIN professional_campaigns c ON c.id = l.campaign_id
       WHERE l.id = ? AND c.owner_sub = ?`
    )
    .bind(leadId, ownerSub)
    .first<CampaignLead>();
  if (!lead) return null;
  const step = state.sequence_step ?? lead.sequence_step;
  const status = state.sequence_status ?? lead.sequence_status;
  const nextActionAt = state.next_action_at ?? lead.next_action_at;
  const stopReason = state.stop_reason ?? lead.stop_reason;
  await db
    .prepare(
      `UPDATE campaign_leads SET sequence_step = ?, sequence_status = ?, next_action_at = ?,
       stop_reason = ?, updated_at = ? WHERE id = ?`
    )
    .bind(step, status, nextActionAt, stopReason, nowSeconds(), leadId)
    .run();
  return db.prepare("SELECT * FROM campaign_leads WHERE id = ?").bind(leadId).first<CampaignLead>();
}

export async function getCampaignLeadByProfessional(
  db: D1Database,
  campaignId: string,
  professionalId: string,
  ownerSub: string
): Promise<CampaignLeadDetail | null> {
  return db
    .prepare(
      `SELECT l.*, p.first_name, p.last_name, p.email, p.current_role, p.current_company,
              p.target_role, p.target_industry, p.tier, p.budget_range, p.qualification_score
       FROM campaign_leads l
       JOIN professional_campaigns c ON c.id = l.campaign_id
       JOIN professionals p ON p.id = l.professional_id
       WHERE l.campaign_id = ? AND l.professional_id = ? AND c.owner_sub = ?`
    )
    .bind(campaignId, professionalId, ownerSub)
    .first<CampaignLeadDetail>();
}

export async function ensureCampaignLead(
  db: D1Database,
  campaignId: string,
  professionalId: string,
  ownerSub: string
): Promise<CampaignLeadDetail | null> {
  const existing = await getCampaignLeadByProfessional(db, campaignId, professionalId, ownerSub);
  if (existing) return existing;
  await addCampaignLeads(db, campaignId, ownerSub, [professionalId]);
  return getCampaignLeadByProfessional(db, campaignId, professionalId, ownerSub);
}

export async function createCampaignMessage(
  db: D1Database,
  lead: CampaignLead,
  input: {
    step?: number;
    message_type: MessageType;
    subject: string | null;
    body: string;
    personalization: unknown;
    status: MessageStatus;
  }
): Promise<CampaignMessage> {
  const id = makeId("msg");
  const now = nowSeconds();
  const step = Math.min(Math.max(input.step ?? lead.sequence_step, 0), 2);
  await db
    .prepare(
      `INSERT INTO campaign_messages (
        id, campaign_lead_id, step, message_type, subject, body, personalization, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      lead.id,
      step,
      input.message_type,
      input.subject,
      input.body,
      input.personalization === undefined ? null : JSON.stringify(input.personalization),
      input.status,
      now,
      now
    )
    .run();
  return (await getCampaignMessage(db, id))!;
}

export async function getCampaignMessage(db: D1Database, id: string): Promise<CampaignMessage | null> {
  const row = await db.prepare("SELECT * FROM campaign_messages WHERE id = ?").bind(id).first<CampaignMessage>();
  return row ? toMessage(row) : null;
}

export async function getOwnedCampaignMessage(
  db: D1Database,
  id: string,
  ownerSub: string
): Promise<CampaignMessage | null> {
  const row = await db
    .prepare(
      `SELECT m.* FROM campaign_messages m
       JOIN campaign_leads l ON l.id = m.campaign_lead_id
       JOIN professional_campaigns c ON c.id = l.campaign_id
       WHERE m.id = ? AND c.owner_sub = ?`
    )
    .bind(id, ownerSub)
    .first<CampaignMessage>();
  return row ? toMessage(row) : null;
}

export async function listCampaignMessages(
  db: D1Database,
  leadId: string,
  ownerSub: string
): Promise<CampaignMessage[]> {
  const result = await db
    .prepare(
      `SELECT m.* FROM campaign_messages m
       JOIN campaign_leads l ON l.id = m.campaign_lead_id
       JOIN professional_campaigns c ON c.id = l.campaign_id
       WHERE m.campaign_lead_id = ? AND c.owner_sub = ?
       ORDER BY m.step ASC, m.created_at DESC`
    )
    .bind(leadId, ownerSub)
    .all<CampaignMessage>();
  return result.results.map(toMessage);
}

export async function listCampaignMessagesForCampaign(
  db: D1Database,
  campaignId: string,
  ownerSub: string
): Promise<(CampaignMessage & { professional_id: string })[]> {
  const result = await db
    .prepare(
      `SELECT m.*, l.professional_id FROM campaign_messages m
       JOIN campaign_leads l ON l.id = m.campaign_lead_id
       JOIN professional_campaigns c ON c.id = l.campaign_id
       WHERE l.campaign_id = ? AND c.owner_sub = ?
       ORDER BY m.created_at DESC`
    )
    .bind(campaignId, ownerSub)
    .all<CampaignMessage & { professional_id: string }>();
  return result.results.map((row) => toMessage(row) as CampaignMessage & { professional_id: string });
}

export async function approveCampaignMessage(
  db: D1Database,
  messageId: string,
  ownerSub: string,
  actorSub: string
): Promise<CampaignMessage | null> {
  const message = await getOwnedCampaignMessage(db, messageId, ownerSub);
  if (!message) return null;
  if (message.status !== "draft" && message.status !== "awaiting_approval") return message;
  const now = nowSeconds();
  await db.batch([
    db
      .prepare(
        `UPDATE campaign_messages SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(actorSub, now, now, messageId),
    db
      .prepare(
        `UPDATE campaign_leads SET sequence_status = 'message_approved', updated_at = ?
         WHERE id = ? AND sequence_status = 'pending'`
      )
      .bind(now, message.campaign_lead_id),
  ]);
  return getCampaignMessage(db, messageId);
}

export async function markCampaignMessageSent(
  db: D1Database,
  messageId: string,
  ownerSub: string,
  providerResponse: string | null,
  gmailMessageId: string | null
): Promise<CampaignMessage | null> {
  const message = await getOwnedCampaignMessage(db, messageId, ownerSub);
  if (!message) return null;
  const now = nowSeconds();
  await db.batch([
    db
      .prepare(
        `UPDATE campaign_messages SET status = 'sent', sent_at = ?, provider_response = ?,
         gmail_message_id = ?, updated_at = ? WHERE id = ?`
      )
      .bind(now, providerResponse, gmailMessageId, now, messageId),
    db
      .prepare(
        `UPDATE campaign_leads SET sequence_status = 'sent', sequence_step = MIN(sequence_step + 1, 2),
         next_action_at = ?, updated_at = ? WHERE id = ?`
      )
      .bind(now + 2592000, now, message.campaign_lead_id),
  ]);
  return getCampaignMessage(db, messageId);
}

export async function markCampaignMessageFailed(
  db: D1Database,
  messageId: string,
  ownerSub: string,
  providerResponse: string | null
): Promise<CampaignMessage | null> {
  const message = await getOwnedCampaignMessage(db, messageId, ownerSub);
  if (!message) return null;
  const now = nowSeconds();
  await db
    .prepare(
      `UPDATE campaign_messages SET status = 'failed', provider_response = ?, updated_at = ? WHERE id = ?`
    )
    .bind(providerResponse, now, messageId)
    .run();
  return getCampaignMessage(db, messageId);
}

function toMessage(row: CampaignMessage): CampaignMessage {
  return {
    ...row,
    personalization: parseJson<unknown>(row.personalization as unknown as string | null, null),
  };
}
