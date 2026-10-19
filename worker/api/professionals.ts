/**
 * Professional Brand Sites API — /api/v1/professionals
 *
 * Owner-scoped CRUD for professional leads, qualification scoring, site drafts,
 * tier-aware content sections, and the simulated domain / email-routing steps.
 * Domain registration and email delivery are simulated: nothing is purchased
 * and no external provider is contacted.
 */

import { Hono, type Context } from "hono";
import { getSessionUser, type SessionUser } from "../lib/session";
import { ensureSessionIdentity, sessionIdentityExists } from "../db/sessions";
import { qualifyProfessional, qualificationNextSteps } from "../lib/qualify";
import {
  buildDefaultSections,
  boundedInteger,
  domainAddonPrice,
  isBudgetRange,
  isProfessionalSource,
  isProfessionalStatus,
  isProfessionalTier,
  isValidDomainName,
  isValidEmail,
  mockDomainAvailable,
  normalizeDomainName,
  normalizeTld,
  numberValue,
  nowSeconds,
  optionalText,
  readJsonObject,
  textValue,
  type ProfessionalTier,
  tierMonthlyPrice,
  tierSetupPrice,
} from "../lib/brand";
import {
  archiveProfessional,
  createProfessional,
  createProfessionalSite,
  getProfessional,
  getProfessionalSite,
  listProfessionalSites,
  listProfessionals,
  listSiteSections,
  listSubscriptions,
  replaceSiteSections,
  seedSiteSections,
  setSiteEmailRouting,
  setSiteDomain,
  setSiteReviewState,
  updateProfessional,
  updateProfessionalSite,
  type Professional,
} from "../db/professionals";
import { listCampaignsForProfessional } from "../db/campaigns";

export interface ProfessionalEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
}

type ProfessionalApp = Hono<{ Bindings: ProfessionalEnv; Variables: { owner: SessionUser } }>;
type ProfessionalContext = Context<{ Bindings: ProfessionalEnv; Variables: { owner: SessionUser } }>;

const professionals: ProfessionalApp = new Hono<{
  Bindings: ProfessionalEnv;
  Variables: { owner: SessionUser };
}>();

async function resolveOwner(env: ProfessionalEnv, request: Request): Promise<SessionUser | null> {
  const user = await getSessionUser(env, request);
  if (!user) return null;
  if (!(await sessionIdentityExists(env.DB, user.sub))) {
    await ensureSessionIdentity(env.DB, user);
  }
  return user;
}

professionals.use("*", async (c, next) => {
  const user = await resolveOwner(c.env, c.req.raw);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("owner", user);
  await next();
});

professionals.get("/", async (c) => {
  const owner = c.get("owner");
  const limit = boundedInteger(c.req.query("limit"), 50, 1, 200);
  const offset = boundedInteger(c.req.query("offset"), 0, 0, 100000);
  const results = await listProfessionals(c.env.DB, owner.sub, {
    status: c.req.query("status") ?? undefined,
    tier: c.req.query("tier") ?? undefined,
    source: c.req.query("source") ?? undefined,
    createdAfter: numberValue(c.req.query("created_after")),
    limit,
    offset,
  });
  return c.json({ professionals: results, count: results.length, limit, offset });
});

professionals.post("/", async (c) => {
  const body = await readJsonObject(c.req.raw);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);

  const firstName = textValue(body.first_name);
  const lastName = textValue(body.last_name);
  const email = textValue(body.email);
  const currentRole = textValue(body.current_role);
  const targetRole = textValue(body.target_role);
  if (!firstName || !lastName || !email || !currentRole || !targetRole) {
    return c.json(
      { error: "first_name, last_name, email, current_role and target_role are required" },
      400
    );
  }
  if (!isValidEmail(email)) return c.json({ error: "email is not a valid address" }, 400);

  const source = textValue(body.source) ?? "manual";
  if (!isProfessionalSource(source)) return c.json({ error: "Invalid source" }, 400);
  const budgetRange = textValue(body.budget_range) ?? "flexible";
  if (!isBudgetRange(budgetRange)) return c.json({ error: "Invalid budget_range" }, 400);
  const requestedTier = textValue(body.tier);
  if (requestedTier !== undefined && !isProfessionalTier(requestedTier)) {
    return c.json({ error: "Invalid tier" }, 400);
  }
  const status = textValue(body.status) ?? "lead";
  if (!isProfessionalStatus(status)) return c.json({ error: "Invalid status" }, 400);

  const yearsExperience = numberValue(body.years_experience) ?? null;
  const qualification = qualifyProfessional({
    current_role: currentRole,
    target_role: targetRole,
    years_experience: yearsExperience ?? 0,
    source,
    budget_range: budgetRange,
  });
  const tier = requestedTier ?? qualification.tier_recommendation;
  const now = nowSeconds();

  const professional = await createProfessional(c.env.DB, {
    owner_sub: c.get("owner").sub,
    first_name: firstName,
    last_name: lastName,
    email,
    current_role: currentRole,
    current_company: optionalText(body.current_company),
    years_experience: yearsExperience === null ? null : Math.max(0, Math.trunc(yearsExperience)),
    target_role: targetRole,
    target_industry: optionalText(body.target_industry),
    linkedin_url: optionalText(body.linkedin_url),
    resume_url: optionalText(body.resume_url),
    resume_content: optionalText(body.resume_content),
    source,
    status: qualification.qualified && status === "lead" ? "qualified" : status,
    tier,
    domain_preference: optionalText(body.domain_preference),
    domain_tld: normalizeTld(textValue(body.domain_tld) ?? ".com"),
    domain_custom_tld: optionalText(body.domain_custom_tld),
    professional_email: optionalText(body.professional_email),
    budget_range: budgetRange,
    notes: optionalText(body.notes),
    qualification_score: qualification.score,
    qualified_at: qualification.qualified ? now : null,
  });

  return c.json(
    { professional, qualification: { ...qualification, next_steps: qualificationNextSteps(qualification) } },
    201
  );
});

professionals.get("/:id", async (c) => {
  const professional = await getProfessional(c.env.DB, c.req.param("id"), c.get("owner").sub);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  const [sites, campaigns, subscriptions] = await Promise.all([
    listProfessionalSites(c.env.DB, professional.id, c.get("owner").sub),
    listCampaignsForProfessional(c.env.DB, professional.id, c.get("owner").sub),
    listSubscriptions(c.env.DB, professional.id, c.get("owner").sub),
  ]);
  return c.json({ professional, sites, campaigns, subscriptions });
});

const updateProfessionalHandler = async (c: ProfessionalContext): Promise<Response> => {
  const body = await readJsonObject(c.req.raw);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const professionalId = c.req.param("id") ?? "";
  const existing = await getProfessional(c.env.DB, professionalId, c.get("owner").sub);
  if (!existing) return c.json({ error: "Professional not found" }, 404);

  const updates: Record<string, unknown> = {};
  const textFields = [
    "first_name",
    "last_name",
    "email",
    "current_role",
    "current_company",
    "target_role",
    "target_industry",
    "linkedin_url",
    "resume_url",
    "resume_content",
    "domain_preference",
    "domain_custom_tld",
    "professional_email",
    "notes",
  ] as const;
  for (const field of textFields) {
    if (body[field] === undefined) continue;
    updates[field] = body[field] === null ? null : optionalText(body[field]);
  }
  if (body.years_experience !== undefined) {
    updates.years_experience =
      body.years_experience === null ? null : Math.max(0, Math.trunc(numberValue(body.years_experience) ?? 0));
  }
  if (body.tier !== undefined) {
    if (!isProfessionalTier(body.tier)) return c.json({ error: "Invalid tier" }, 400);
    updates.tier = body.tier;
  }
  if (body.source !== undefined) {
    if (!isProfessionalSource(body.source)) return c.json({ error: "Invalid source" }, 400);
    updates.source = body.source;
  }
  if (body.budget_range !== undefined) {
    if (!isBudgetRange(body.budget_range)) return c.json({ error: "Invalid budget_range" }, 400);
    updates.budget_range = body.budget_range;
  }
  if (body.status !== undefined) {
    if (!isProfessionalStatus(body.status)) return c.json({ error: "Invalid status" }, 400);
    updates.status = body.status;
  }
  if (body.email !== undefined && typeof updates.email === "string" && !isValidEmail(updates.email)) {
    return c.json({ error: "email is not a valid address" }, 400);
  }

  const updated = await updateProfessional(c.env.DB, existing.id, c.get("owner").sub, updates);
  return c.json({ professional: updated });
};

professionals.put("/:id", updateProfessionalHandler);
professionals.patch("/:id", updateProfessionalHandler);

const archiveHandler = async (c: ProfessionalContext): Promise<Response> => {
  const owner = c.get("owner").sub;
  const archivedAt = await archiveProfessional(c.env.DB, c.req.param("id") ?? "", owner);
  if (archivedAt === null) return c.json({ error: "Professional not found" }, 404);
  return c.json({ archived: true, archived_at: archivedAt });
};

professionals.post("/:id/archive", archiveHandler);
professionals.delete("/:id", archiveHandler);

professionals.post("/:id/qualify", async (c) => {
  const owner = c.get("owner").sub;
  const professional = await getProfessional(c.env.DB, c.req.param("id"), owner);
  if (!professional) return c.json({ error: "Professional not found" }, 404);

  const result = qualifyProfessional({
    current_role: professional.current_role,
    target_role: professional.target_role,
    years_experience: professional.years_experience ?? 0,
    source: professional.source,
    budget_range: professional.budget_range,
  });
  const now = nowSeconds();
  const updated = await updateProfessional(c.env.DB, professional.id, owner, {
    status: result.qualified ? "qualified" : "lead",
    tier: result.tier_recommendation,
    qualification_score: result.score,
  });
  if (result.qualified && !professional.qualified_at) {
    await c.env.DB.prepare(
      "UPDATE professionals SET qualified_at = ? WHERE id = ? AND owner_sub = ?"
    ).bind(now, professional.id, owner).run();
  }
  return c.json({
    qualification: { ...result, next_steps: qualificationNextSteps(result) },
    professional: updated,
  });
});

professionals.get("/:id/sites", async (c) => {
  const owner = c.get("owner").sub;
  const professional = await getProfessional(c.env.DB, c.req.param("id"), owner);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  const sites = await listProfessionalSites(c.env.DB, professional.id, owner);
  return c.json({ sites, count: sites.length });
});

professionals.post("/:id/sites", async (c) => {
  const owner = c.get("owner").sub;
  const professional = await getProfessional(c.env.DB, c.req.param("id"), owner);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  const body = (await readJsonObject(c.req.raw)) ?? {};

  const domainName = normalizeDomainName(body.domain_name);
  if (domainName && !isValidDomainName(domainName)) {
    return c.json({ error: "domain_name must be a valid hostname label" }, 400);
  }
  const tld = normalizeTld(textValue(body.domain_tld) ?? professional.domain_tld);
  const site = await createProfessionalSite(c.env.DB, professional, domainName || null, tld);
  const sections = buildDefaultSections(
    {
      first_name: professional.first_name,
      last_name: professional.last_name,
      current_role: professional.current_role,
      target_role: professional.target_role,
    },
    professional.tier
  );
  await seedSiteSections(c.env.DB, site.id, sections);
  await c.env.DB.prepare(
    "UPDATE professionals SET status = 'in_design', updated_at = ? WHERE id = ? AND owner_sub = ? AND status = 'qualified'"
  ).bind(nowSeconds(), professional.id, owner).run();

  const pricing = {
    setup: tierSetupPrice(professional.tier),
    monthly: tierMonthlyPrice(professional.tier),
  };
  return c.json({ site: await getProfessionalSite(c.env.DB, site.id, owner), pricing }, 201);
});

async function loadSite(
  c: Context<{ Bindings: ProfessionalEnv; Variables: { owner: SessionUser } }>
): Promise<{ professional: Professional | null; site: Awaited<ReturnType<typeof getProfessionalSite>> }> {
  const owner = c.get("owner").sub;
  const professionalId = c.req.param("id") ?? "";
  const siteId = c.req.param("siteId") ?? "";
  const professional = await getProfessional(c.env.DB, professionalId, owner);
  if (!professional) return { professional: null, site: null };
  const site = await getProfessionalSite(c.env.DB, siteId, owner);
  if (!site || site.professional_id !== professional.id) return { professional, site: null };
  return { professional, site };
}

professionals.get("/:id/sites/:siteId", async (c) => {
  const owner = c.get("owner").sub;
  const { professional, site } = await loadSite(c);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  if (!site) return c.json({ error: "Site not found" }, 404);
  const sections = await listSiteSections(c.env.DB, site.id, owner);
  return c.json({ site, sections });
});

professionals.patch("/:id/sites/:siteId", async (c) => {
  const owner = c.get("owner").sub;
  const body = await readJsonObject(c.req.raw);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { professional, site } = await loadSite(c);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  if (!site) return c.json({ error: "Site not found" }, 404);
  if (site.status === "live" || site.status === "archived") {
    return c.json({ error: `Site is ${site.status} and cannot be edited` }, 409);
  }

  const updates: Record<string, unknown> = {};
  for (const field of [
    "hero_headline",
    "hero_tagline",
    "about_summary",
    "profile_image_url",
    "site_url",
    "professional_email",
    "email_inbound_target",
    "meta_description",
    "og_title",
    "og_image",
    "domain_status",
    "domain_registrar",
    "email_routing_status",
  ] as const) {
    if (body[field] === undefined) continue;
    updates[field] = body[field] === null ? null : optionalText(body[field]);
  }
  if (body.portfolio_items !== undefined) updates.portfolio_items = body.portfolio_items;
  if (body.domain_nameservers !== undefined) updates.domain_nameservers = body.domain_nameservers;
  const updated = await updateProfessionalSite(c.env.DB, site.id, owner, updates);
  return c.json({ site: updated });
});

professionals.put("/:id/sites/:siteId/sections", async (c) => {
  const owner = c.get("owner").sub;
  const body = await readJsonObject(c.req.raw);
  if (!body || !Array.isArray(body.sections)) {
    return c.json({ error: "sections array is required" }, 400);
  }
  const { professional, site } = await loadSite(c);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  if (!site) return c.json({ error: "Site not found" }, 404);

  const sections: {
    section_type: string;
    tier_minimum: ProfessionalTier;
    content: string;
    display_order: number;
  }[] = [];
  let order = 0;
  for (const entry of body.sections) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const sectionType = textValue(record.section_type);
    if (!sectionType) continue;
    const tierMinimum = isProfessionalTier(record.tier_minimum) ? record.tier_minimum : "basic";
    const content = typeof record.content === "string" ? record.content : JSON.stringify(record.content ?? {});
    sections.push({ section_type: sectionType, tier_minimum: tierMinimum, content, display_order: order });
    order += 1;
  }
  const replaced = await replaceSiteSections(c.env.DB, site.id, owner, sections);
  return c.json({ sections: replaced });
});

const submitForApproval = async (c: ProfessionalContext): Promise<Response> => {
  const owner = c.get("owner").sub;
  const { professional, site } = await loadSite(c);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  if (!site) return c.json({ error: "Site not found" }, 404);
  if (site.status === "awaiting_approval" || site.status === "approved") {
    return c.json({ error: `Site is already ${site.status}` }, 409);
  }
  const sections = await listSiteSections(c.env.DB, site.id, owner);
  if (sections.length === 0) return c.json({ error: "Site has no content sections to submit" }, 409);
  const updated = await setSiteReviewState(c.env.DB, site.id, owner, "awaiting_approval", owner, null);
  return c.json({
    site: updated,
    status: "awaiting_approval",
    submitted_at: updated?.submitted_for_review_at ?? nowSeconds(),
  });
};

professionals.post("/:id/sites/:siteId/submit_for_approval", submitForApproval);
professionals.post("/:id/sites/:siteId/submit", submitForApproval);

const approveSite = async (c: ProfessionalContext): Promise<Response> => {
  const owner = c.get("owner").sub;
  const { professional, site } = await loadSite(c);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  if (!site) return c.json({ error: "Site not found" }, 404);
  if (site.status !== "awaiting_approval") {
    return c.json({ error: `Site must be awaiting_approval (current: ${site.status})` }, 409);
  }
  const body = (await readJsonObject(c.req.raw)) ?? {};
  const note = optionalText(body.note);
  const updated = await setSiteReviewState(c.env.DB, site.id, owner, "approved", owner, note);
  return c.json({
    site: updated,
    status: "approved",
    approved_at: updated?.approved_at ?? nowSeconds(),
    approved_by: owner,
  });
};

professionals.post("/:id/sites/:siteId/approve", approveSite);

const rejectSite = async (c: ProfessionalContext): Promise<Response> => {
  const owner = c.get("owner").sub;
  const { professional, site } = await loadSite(c);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  if (!site) return c.json({ error: "Site not found" }, 404);
  if (site.status !== "awaiting_approval") {
    return c.json({ error: `Site must be awaiting_approval (current: ${site.status})` }, 409);
  }
  const body = (await readJsonObject(c.req.raw)) ?? {};
  const reason = optionalText(body.reason) ?? optionalText(body.note) ?? "Changes requested";
  const updated = await setSiteReviewState(c.env.DB, site.id, owner, "draft", owner, reason);
  return c.json({ site: updated, status: "draft", rejection_reason: reason });
};

professionals.post("/:id/sites/:siteId/reject", rejectSite);

const checkDomain = async (c: ProfessionalContext): Promise<Response> => {
  const owner = c.get("owner").sub;
  const body = (await readJsonObject(c.req.raw)) ?? {};
  const { professional, site } = await loadSite(c);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  if (!site) return c.json({ error: "Site not found" }, 404);

  const requested = body.domain_name ?? c.req.query("domain_name") ?? site.domain_name ?? professional.domain_preference;
  const domainName = normalizeDomainName(requested);
  if (!domainName || !isValidDomainName(domainName)) {
    return c.json({ error: "domain_name must be a valid hostname label" }, 400);
  }
  const tld = normalizeTld(
    textValue(body.domain_tld) ?? c.req.query("tld") ?? site.domain_tld
  );
  const available = mockDomainAvailable(domainName, tld);
  const price = domainAddonPrice(tld);
  await updateProfessionalSite(c.env.DB, site.id, owner, {
    domain_name: domainName,
    domain_tld: tld,
    domain_status: available ? "available" : "registered",
  });
  return c.json({
    domain_name: domainName,
    domain_tld: tld,
    available,
    status: available ? "available" : "registered",
    price,
    registrar: available ? "simulated" : null,
    simulated: true,
  });
};

professionals.post("/:id/sites/:siteId/check_domain", checkDomain);
professionals.post("/:id/sites/:siteId/domain/check", checkDomain);

const reserveDomain = async (c: ProfessionalContext): Promise<Response> => {
  const owner = c.get("owner").sub;
  const body = (await readJsonObject(c.req.raw)) ?? {};
  const { professional, site } = await loadSite(c);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  if (!site) return c.json({ error: "Site not found" }, 404);
  if (site.domain_name === null) {
    return c.json({ error: "Run a domain check before reserving" }, 409);
  }
  const domainName = normalizeDomainName(body.domain_name ?? site.domain_name);
  const tld = normalizeTld(textValue(body.domain_tld) ?? site.domain_tld);
  const reserved = mockDomainAvailable(domainName, tld);
  const nameservers = ["ns1.cloudflare-dns.com", "ns2.cloudflare-dns.com"];
  if (reserved) {
    await updateProfessionalSite(c.env.DB, site.id, owner, { domain_nameservers: nameservers });
  }
  const updated = await setSiteDomain(
    c.env.DB,
    site.id,
    owner,
    domainName,
    tld,
    reserved ? "reserved" : "failed",
    reserved ? "simulated" : null
  );
  if (!reserved) {
    return c.json({ error: "Domain is not available", status: "failed" }, 409);
  }
  return c.json({
    site: updated,
    domain_name: `${domainName}${tld}`,
    status: "reserved",
    nameservers,
    price: domainAddonPrice(tld),
    expires_at: nowSeconds() + 2592000,
    simulated: true,
  });
};

professionals.post("/:id/sites/:siteId/reserve_domain", reserveDomain);
professionals.post("/:id/sites/:siteId/domain/reserve", reserveDomain);

const configureEmail = async (c: ProfessionalContext): Promise<Response> => {
  const owner = c.get("owner").sub;
  const body = (await readJsonObject(c.req.raw)) ?? {};
  const { professional, site } = await loadSite(c);
  if (!professional) return c.json({ error: "Professional not found" }, 404);
  if (!site) return c.json({ error: "Site not found" }, 404);

  const localPart = normalizeDomainName(
    textValue(body.local_part) ?? textValue(site.domain_name ?? "") ?? ""
  );
  const tld = normalizeTld(textValue(body.domain_tld) ?? site.domain_tld);
  const email = textValue(body.professional_email) ?? textValue(body.email) ?? (localPart ? `${localPart}${tld}` : null);
  if (!email || !isValidEmail(email)) return c.json({ error: "A valid email address is required" }, 400);
  const inboundTarget = textValue(body.inbound_target) ?? owner;
  const updated = await setSiteEmailRouting(c.env.DB, site.id, owner, email, inboundTarget, "pending");
  return c.json({
    site: updated,
    professional_email: email,
    inbound_target: inboundTarget,
    email_routing_status: "pending",
    configured_at: nowSeconds(),
    simulated: true,
  });
};

professionals.post("/:id/sites/:siteId/configure_email", configureEmail);
professionals.post("/:id/sites/:siteId/email/configure", configureEmail);

export default professionals;
