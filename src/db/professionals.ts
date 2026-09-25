import {
  makeId,
  normalizeTld,
  nowSeconds,
  parseJson,
  stringifyJson,
  type ProfessionalTier,
  type ProfessionalStatus,
  type SiteStatus,
} from "../lib/brand";

export interface Professional {
  id: string;
  owner_sub: string;
  first_name: string;
  last_name: string;
  email: string;
  current_role: string;
  current_company: string | null;
  years_experience: number | null;
  target_role: string;
  target_industry: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  resume_content: string | null;
  source: string;
  status: ProfessionalStatus;
  tier: ProfessionalTier;
  domain_preference: string | null;
  domain_tld: string;
  domain_custom_tld: string | null;
  professional_email: string | null;
  budget_range: string;
  notes: string | null;
  qualification_score: number;
  qualified_at: number | null;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
}

export interface ProfessionalSite {
  id: string;
  professional_id: string;
  tier: ProfessionalTier;
  status: SiteStatus;
  hero_headline: string | null;
  hero_tagline: string | null;
  about_summary: string | null;
  profile_image_url: string | null;
  domain_name: string | null;
  domain_tld: string;
  domain_status: string;
  domain_registrar: string | null;
  domain_nameservers: unknown;
  site_url: string | null;
  professional_email: string | null;
  email_routing_status: string;
  email_inbound_target: string | null;
  portfolio_items: unknown;
  meta_description: string | null;
  og_title: string | null;
  og_image: string | null;
  submitted_for_review_at: number | null;
  approved_by: string | null;
  approved_at: number | null;
  approval_notes: string | null;
  deployed_at: number | null;
  deployed_by: string | null;
  last_updated_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface SiteSection {
  id: string;
  professional_site_id: string;
  section_type: string;
  tier_minimum: ProfessionalTier;
  content: unknown;
  display_order: number;
  enabled: boolean;
  created_at: number;
}

export interface ProfessionalFilters {
  status?: string;
  tier?: string;
  source?: string;
  createdAfter?: number;
  limit: number;
  offset: number;
}

export interface NewProfessional {
  owner_sub: string;
  first_name: string;
  last_name: string;
  email: string;
  current_role: string;
  current_company: string | null;
  years_experience: number | null;
  target_role: string;
  target_industry: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  resume_content: string | null;
  source: string;
  status: ProfessionalStatus;
  tier: ProfessionalTier;
  domain_preference: string | null;
  domain_tld: string;
  domain_custom_tld: string | null;
  professional_email: string | null;
  budget_range: string;
  notes: string | null;
  qualification_score: number;
  qualified_at: number | null;
}

export async function createProfessional(db: D1Database, input: NewProfessional): Promise<Professional> {
  const id = makeId("prof");
  const now = nowSeconds();
  await db
    .prepare(
      `INSERT INTO professionals (
        id, owner_sub, first_name, last_name, email, current_role, current_company,
        years_experience, target_role, target_industry, linkedin_url, resume_url,
        resume_content, source, status, tier, domain_preference, domain_tld,
        domain_custom_tld, professional_email, budget_range, notes,
        qualification_score, qualified_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.owner_sub,
      input.first_name,
      input.last_name,
      input.email,
      input.current_role,
      input.current_company,
      input.years_experience,
      input.target_role,
      input.target_industry,
      input.linkedin_url,
      input.resume_url,
      input.resume_content,
      input.source,
      input.status,
      input.tier,
      input.domain_preference,
      input.domain_tld,
      input.domain_custom_tld,
      input.professional_email,
      input.budget_range,
      input.notes,
      input.qualification_score,
      input.qualified_at,
      now,
      now
    )
    .run();
  return (await getProfessional(db, id, input.owner_sub))!;
}

export async function getProfessional(
  db: D1Database,
  id: string,
  ownerSub: string
): Promise<Professional | null> {
  return db
    .prepare("SELECT * FROM professionals WHERE id = ? AND owner_sub = ?")
    .bind(id, ownerSub)
    .first<Professional>();
}

export async function getProfessionalById(db: D1Database, id: string): Promise<Professional | null> {
  return db.prepare("SELECT * FROM professionals WHERE id = ?").bind(id).first<Professional>();
}

export async function listProfessionals(
  db: D1Database,
  ownerSub: string,
  filters: ProfessionalFilters
): Promise<Professional[]> {
  const clauses = ["owner_sub = ?", "archived_at IS NULL"];
  const binds: unknown[] = [ownerSub];
  if (filters.status) {
    clauses.push("status = ?");
    binds.push(filters.status);
  }
  if (filters.tier) {
    clauses.push("tier = ?");
    binds.push(filters.tier);
  }
  if (filters.source) {
    clauses.push("source = ?");
    binds.push(filters.source);
  }
  if (filters.createdAfter !== undefined) {
    clauses.push("created_at >= ?");
    binds.push(filters.createdAfter);
  }
  const result = await db
    .prepare(
      `SELECT * FROM professionals WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(...binds, filters.limit, filters.offset)
    .all<Professional>();
  return result.results;
}

const PROFESSIONAL_UPDATE_FIELDS = new Set([
  "first_name",
  "last_name",
  "email",
  "current_role",
  "current_company",
  "years_experience",
  "target_role",
  "target_industry",
  "linkedin_url",
  "resume_url",
  "resume_content",
  "source",
  "status",
  "tier",
  "domain_preference",
  "domain_tld",
  "domain_custom_tld",
  "professional_email",
  "budget_range",
  "notes",
]);

export async function updateProfessional(
  db: D1Database,
  id: string,
  ownerSub: string,
  updates: Record<string, unknown>
): Promise<Professional | null> {
  const columns: string[] = [];
  const binds: unknown[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!PROFESSIONAL_UPDATE_FIELDS.has(key)) continue;
    columns.push(`${key} = ?`);
    binds.push(key === "domain_tld" ? normalizeTld(value) : value);
  }
  if (columns.length === 0) return getProfessional(db, id, ownerSub);
  const now = nowSeconds();
  await db
    .prepare(
      `UPDATE professionals SET ${columns.join(", ")}, updated_at = ? WHERE id = ? AND owner_sub = ?`
    )
    .bind(...binds, now, id, ownerSub)
    .run();
  return getProfessional(db, id, ownerSub);
}

export async function archiveProfessional(
  db: D1Database,
  id: string,
  ownerSub: string
): Promise<number | null> {
  const professional = await getProfessional(db, id, ownerSub);
  if (!professional) return null;
  const now = nowSeconds();
  await db.batch([
    db
      .prepare(
        `UPDATE professionals SET status = 'cancelled', archived_at = ?, updated_at = ?
         WHERE id = ? AND owner_sub = ?`
      )
      .bind(now, now, id, ownerSub),
    db
      .prepare(
        `UPDATE professional_sites SET status = 'archived', last_updated_at = ?, updated_at = ?
         WHERE professional_id = ?`
      )
      .bind(now, now, id),
    db
      .prepare(
        `UPDATE campaign_leads SET sequence_status = 'stopped', stop_reason = 'professional_archived', updated_at = ?
         WHERE professional_id = ?`
      )
      .bind(now, id),
    db
      .prepare(
        `UPDATE professional_subscriptions SET status = 'cancelled', cancel_reason = 'professional_archived', cancelled_at = ?, updated_at = ?
         WHERE professional_id = ?`
      )
      .bind(now, now, id),
  ]);
  return now;
}

export async function listProfessionalSites(
  db: D1Database,
  professionalId: string,
  ownerSub: string
): Promise<ProfessionalSite[]> {
  const result = await db
    .prepare(
      `SELECT s.* FROM professional_sites s
       JOIN professionals p ON p.id = s.professional_id
       WHERE s.professional_id = ? AND p.owner_sub = ? AND p.archived_at IS NULL
       ORDER BY s.created_at DESC`
    )
    .bind(professionalId, ownerSub)
    .all<ProfessionalSite>();
  return result.results.map(toSite);
}

export async function getProfessionalSite(
  db: D1Database,
  id: string,
  ownerSub: string
): Promise<ProfessionalSite | null> {
  const row = await db
    .prepare(
      `SELECT s.* FROM professional_sites s
       JOIN professionals p ON p.id = s.professional_id
       WHERE s.id = ? AND p.owner_sub = ? AND p.archived_at IS NULL`
    )
    .bind(id, ownerSub)
    .first<ProfessionalSite>();
  return row ? toSite(row) : null;
}

export async function createProfessionalSite(
  db: D1Database,
  professional: Professional,
  domainName: string | null,
  domainTld: string
): Promise<ProfessionalSite> {
  const id = makeId("site");
  const now = nowSeconds();
  await db
    .prepare(
      `INSERT INTO professional_sites (
        id, professional_id, tier, status, domain_name, domain_tld, domain_status,
        email_routing_status, last_updated_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'draft', ?, ?, 'checking', 'pending', ?, ?, ?)`
    )
    .bind(
      id,
      professional.id,
      professional.tier,
      domainName,
      normalizeTld(domainTld),
      now,
      now,
      now
    )
    .run();
  return (await getProfessionalSite(db, id, professional.owner_sub))!;
}

const SITE_UPDATE_FIELDS = new Set([
  "hero_headline",
  "hero_tagline",
  "about_summary",
  "profile_image_url",
  "domain_name",
  "domain_tld",
  "domain_status",
  "domain_registrar",
  "site_url",
  "professional_email",
  "email_routing_status",
  "email_inbound_target",
  "meta_description",
  "og_title",
  "og_image",
]);

const SITE_JSON_FIELDS = new Set(["domain_nameservers", "portfolio_items"]);

export async function updateProfessionalSite(
  db: D1Database,
  id: string,
  ownerSub: string,
  updates: Record<string, unknown>
): Promise<ProfessionalSite | null> {
  const columns: string[] = [];
  const binds: unknown[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!SITE_UPDATE_FIELDS.has(key) && !SITE_JSON_FIELDS.has(key)) continue;
    columns.push(`${key} = ?`);
    binds.push(
      key === "domain_tld"
        ? normalizeTld(value)
        : SITE_JSON_FIELDS.has(key)
          ? stringifyJson(value)
          : value
    );
  }
  if (columns.length === 0) return getProfessionalSite(db, id, ownerSub);
  const now = nowSeconds();
  await db
    .prepare(
      `UPDATE professional_sites SET ${columns.join(", ")}, last_updated_at = ?, updated_at = ?
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM professionals p WHERE p.id = professional_sites.professional_id AND p.owner_sub = ?
       )`
    )
    .bind(...binds, now, now, id, ownerSub)
    .run();
  return getProfessionalSite(db, id, ownerSub);
}

export async function setSiteReviewState(
  db: D1Database,
  id: string,
  ownerSub: string,
  state: "awaiting_approval" | "approved" | "draft",
  actorSub: string,
  note: string | null
): Promise<ProfessionalSite | null> {
  const site = await getProfessionalSite(db, id, ownerSub);
  if (!site) return null;
  const now = nowSeconds();
  if (state === "awaiting_approval") {
    await db
      .prepare(
        `UPDATE professional_sites SET status = 'awaiting_approval', submitted_for_review_at = ?,
         approved_by = NULL, approved_at = NULL, last_updated_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(now, now, now, id)
      .run();
  } else if (state === "approved") {
    await db
      .prepare(
        `UPDATE professional_sites SET status = 'approved', approved_by = ?, approved_at = ?,
         approval_notes = ?, last_updated_at = ?, updated_at = ? WHERE id = ?`
      )
      .bind(actorSub, now, note, now, now, id)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE professional_sites SET status = 'draft', approved_by = NULL, approved_at = NULL,
         approval_notes = ?, last_updated_at = ?, updated_at = ? WHERE id = ?`
      )
      .bind(note, now, now, id)
      .run();
  }
  return getProfessionalSite(db, id, ownerSub);
}

export async function setSiteDomain(
  db: D1Database,
  id: string,
  ownerSub: string,
  domainName: string,
  tld: string,
  status: "available" | "reserved" | "failed",
  registrar: string | null
): Promise<ProfessionalSite | null> {
  const now = nowSeconds();
  await db
    .prepare(
      `UPDATE professional_sites SET domain_name = ?, domain_tld = ?, domain_status = ?,
       domain_registrar = ?, last_updated_at = ?, updated_at = ?
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM professionals p WHERE p.id = professional_sites.professional_id AND p.owner_sub = ?
       )`
    )
    .bind(domainName, normalizeTld(tld), status, registrar, now, now, id, ownerSub)
    .run();
  return getProfessionalSite(db, id, ownerSub);
}

export async function setSiteEmailRouting(
  db: D1Database,
  id: string,
  ownerSub: string,
  email: string,
  inboundTarget: string,
  status: "pending" | "configured" | "failed"
): Promise<ProfessionalSite | null> {
  const now = nowSeconds();
  await db
    .prepare(
      `UPDATE professional_sites SET professional_email = ?, email_inbound_target = ?,
       email_routing_status = ?, last_updated_at = ?, updated_at = ?
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM professionals p WHERE p.id = professional_sites.professional_id AND p.owner_sub = ?
       )`
    )
    .bind(email, inboundTarget, status, now, now, id, ownerSub)
    .run();
  return getProfessionalSite(db, id, ownerSub);
}

export async function listSiteSections(
  db: D1Database,
  siteId: string,
  ownerSub: string
): Promise<SiteSection[]> {
  const result = await db
    .prepare(
      `SELECT sec.* FROM professional_site_sections sec
       JOIN professional_sites s ON s.id = sec.professional_site_id
       JOIN professionals p ON p.id = s.professional_id
       WHERE sec.professional_site_id = ? AND p.owner_sub = ? AND p.archived_at IS NULL
       ORDER BY sec.display_order ASC`
    )
    .bind(siteId, ownerSub)
    .all<SiteSection>();
  return result.results.map((row) => ({
    ...row,
    content: parseJson<unknown>(row.content as string | null, {}),
    enabled: Boolean(row.enabled),
  }));
}

export async function listSubscriptions(
  db: D1Database,
  professionalId: string,
  ownerSub: string
): Promise<unknown[]> {
  const result = await db
    .prepare(
      `SELECT sub.* FROM professional_subscriptions sub
       JOIN professionals p ON p.id = sub.professional_id
       WHERE sub.professional_id = ? AND p.owner_sub = ? AND p.archived_at IS NULL
       ORDER BY sub.created_at DESC`
    )
    .bind(professionalId, ownerSub)
    .all();
  return result.results;
}

export async function seedSiteSections(
  db: D1Database,
  siteId: string,
  seeds: { section_type: string; tier_minimum: ProfessionalTier; content: string; display_order: number }[]
): Promise<void> {
  if (seeds.length === 0) return;
  const now = nowSeconds();
  await db.batch(
    seeds.map((seed) =>
      db
        .prepare(
          `INSERT INTO professional_site_sections
            (id, professional_site_id, section_type, tier_minimum, content, display_order, enabled, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
        )
        .bind(makeId("sec"), siteId, seed.section_type, seed.tier_minimum, seed.content, seed.display_order, now)
    )
  );
}

export async function replaceSiteSections(
  db: D1Database,
  siteId: string,
  ownerSub: string,
  sections: { section_type: string; tier_minimum: ProfessionalTier; content: string; display_order: number }[]
): Promise<SiteSection[] | null> {
  const site = await getProfessionalSite(db, siteId, ownerSub);
  if (!site) return null;
  const now = nowSeconds();
  const statements = [
    db
      .prepare(
        `DELETE FROM professional_site_sections WHERE professional_site_id = ?`
      )
      .bind(siteId),
  ];
  for (const section of sections) {
    statements.push(
      db
        .prepare(
          `INSERT INTO professional_site_sections
            (id, professional_site_id, section_type, tier_minimum, content, display_order, enabled, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
        )
        .bind(
          makeId("sec"),
          siteId,
          section.section_type,
          section.tier_minimum,
          section.content,
          section.display_order,
          now
        )
    );
  }
  await db.batch(statements);
  return listSiteSections(db, siteId, ownerSub);
}

function toSite(row: ProfessionalSite): ProfessionalSite {
  return {
    ...row,
    domain_nameservers: parseJson<unknown>(row.domain_nameservers as string | null, null),
    portfolio_items: parseJson<unknown>(row.portfolio_items as string | null, null),
  };
}
