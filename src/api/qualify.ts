/**
 * Qualification API — /api/v1/qualify
 *
 * Unauthenticated by design: lead import and public landing forms can score a
 * candidate before an account exists. Scoring is pure and writes nothing.
 */

import { Hono } from "hono";
import { qualifyProfessional, qualificationNextSteps } from "../lib/qualify";
import { isBudgetRange, isProfessionalSource, numberValue, readJsonObject } from "../lib/brand";

const qualify = new Hono();

qualify.post("/professional", async (c) => {
  const body = await readJsonObject(c.req.raw);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);

  const currentRole = typeof body.current_role === "string" ? body.current_role.trim() : "";
  const targetRole = typeof body.target_role === "string" ? body.target_role.trim() : "";
  if (!currentRole || !targetRole) {
    return c.json({ error: "current_role and target_role are required" }, 400);
  }

  const source = typeof body.source === "string" ? body.source : "manual";
  if (!isProfessionalSource(source)) return c.json({ error: "Invalid source" }, 400);
  const budgetRange = typeof body.budget_range === "string" ? body.budget_range : "flexible";
  if (!isBudgetRange(budgetRange)) return c.json({ error: "Invalid budget_range" }, 400);

  const result = qualifyProfessional({
    current_role: currentRole,
    target_role: targetRole,
    years_experience: numberValue(body.years_experience) ?? 0,
    source,
    budget_range: budgetRange,
  });

  return c.json({
    qualified: result.qualified,
    score: result.score,
    reasons: result.reasons,
    risk_factors: result.risk_factors,
    tier_recommendation: result.tier_recommendation,
    next_steps: qualificationNextSteps(result),
  });
});

export default qualify;
