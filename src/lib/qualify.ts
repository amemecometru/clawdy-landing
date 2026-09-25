export interface QualificationInput {
  current_role: string;
  target_role: string;
  years_experience: number;
  source: string;
  budget_range: string;
}

export interface QualificationResult {
  qualified: boolean;
  score: number;
  tier_recommendation: "basic" | "professional" | "sophisticated";
  reasons: string[];
  risk_factors: string[];
}

function normalizedRole(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function qualifyProfessional(input: QualificationInput): QualificationResult {
  let score = 0;
  const reasons: string[] = [];
  const riskFactors: string[] = [];

  const currentRole = normalizedRole(input.current_role);
  const targetRole = normalizedRole(input.target_role);
  const yearsExperience = Number.isFinite(input.years_experience)
    ? Math.max(0, input.years_experience)
    : 0;

  if (currentRole && targetRole && currentRole !== targetRole) {
    score += 0.3;
    reasons.push("Career transition detected; personal brand valuable");
  }

  if (yearsExperience >= 5 && yearsExperience <= 20) {
    score += 0.3;
    reasons.push("Mid-to-senior career stage, high brand value");
  } else if (yearsExperience < 5) {
    score += 0.15;
    reasons.push("Early career; personal brand useful for differentiation");
  } else if (yearsExperience > 20) {
    score += 0.25;
    reasons.push("Extensive experience; executive presence website valuable");
  }

  if (input.source === "linkedin" || input.source === "referral") {
    score += 0.2;
    reasons.push("Strong signal: organic interest or referral");
  } else if (input.source === "job_board") {
    score += 0.1;
    reasons.push("Moderate signal: job board context");
  } else {
    riskFactors.push("Manual entry; verify interest");
  }

  if (input.budget_range === "500_plus") {
    score += 0.15;
    reasons.push("High budget; likely committed");
  } else if (input.budget_range === "200_500") {
    score += 0.1;
    reasons.push("Moderate budget");
  } else if (input.budget_range === "under_200") {
    riskFactors.push("Low budget; may not complete");
  }

  let tierRecommendation: QualificationResult["tier_recommendation"] = "basic";
  if (score >= 0.7 && yearsExperience >= 10) {
    tierRecommendation = "sophisticated";
  } else if (score >= 0.5 && yearsExperience >= 5) {
    tierRecommendation = "professional";
  }

  const boundedScore = Math.min(Number(score.toFixed(4)), 1);
  return {
    qualified: boundedScore >= 0.4,
    score: boundedScore,
    tier_recommendation: tierRecommendation,
    reasons,
    risk_factors: riskFactors,
  };
}

export function qualificationNextSteps(result: QualificationResult): string[] {
  if (!result.qualified) {
    return [
      "Confirm target role and timeline",
      "Collect resume content or resume URL",
      "Confirm budget range before outreach",
    ];
  }
  return [
    "Confirm domain preference and tier",
    "Create the professional site draft",
    "Review the draft before approval",
  ];
}
