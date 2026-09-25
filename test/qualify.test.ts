import { describe, expect, it } from "vitest";
import { qualifyProfessional, qualificationNextSteps } from "../src/lib/qualify";

describe("qualifyProfessional", () => {
  it("awards role alignment, experience, source and budget signals", () => {
    const result = qualifyProfessional({
      current_role: "Data Analyst",
      target_role: "Analytics Engineer",
      years_experience: 12,
      source: "linkedin",
      budget_range: "500_plus",
    });
    expect(result.score).toBeCloseTo(0.95, 5);
    expect(result.qualified).toBe(true);
    expect(result.tier_recommendation).toBe("sophisticated");
    expect(result.risk_factors).toHaveLength(0);
  });

  it("does not qualify a low-signal manual lead", () => {
    const result = qualifyProfessional({
      current_role: "Support Specialist",
      target_role: "Support Specialist",
      years_experience: 2,
      source: "manual",
      budget_range: "under_200",
    });
    expect(result.qualified).toBe(false);
    expect(result.score).toBeLessThan(0.4);
    expect(result.risk_factors).toContain("Low budget; may not complete");
  });

  it("never scores above 1", () => {
    const result = qualifyProfessional({
      current_role: "Engineer",
      target_role: "Director",
      years_experience: 25,
      source: "referral",
      budget_range: "500_plus",
    });
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("recommends the professional tier for a mid-career hire", () => {
    const result = qualifyProfessional({
      current_role: "Account Executive",
      target_role: "Head of Sales",
      years_experience: 6,
      source: "referral",
      budget_range: "200_500",
    });
    expect(result.tier_recommendation).toBe("professional");
    expect(result.qualified).toBe(true);
  });

  it("returns action-oriented next steps in both directions", () => {
    const weak = qualificationNextSteps(
      qualifyProfessional({
        current_role: "Intern",
        target_role: "Intern",
        years_experience: 0,
        source: "manual",
        budget_range: "under_200",
      })
    );
    expect(weak.length).toBeGreaterThan(0);
    const strong = qualificationNextSteps(
      qualifyProfessional({
        current_role: "Engineer",
        target_role: "Staff Engineer",
        years_experience: 9,
        source: "linkedin",
        budget_range: "200_500",
      })
    );
    expect(strong.some((step) => step.includes("domain"))).toBe(true);
  });

  it("tolerates missing numeric input", () => {
    const result = qualifyProfessional({
      current_role: "Designer",
      target_role: "Design Lead",
      years_experience: Number.NaN,
      source: "job_board",
      budget_range: "flexible",
    });
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.qualified).toBe(true);
  });
});
