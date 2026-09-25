import { describe, expect, it } from "vitest";
import qualify from "../src/api/qualify";

function post(body: unknown): Promise<Response> {
  return qualify.fetch(
    new Request("http://clawdyclaw.com/professional", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ) as Promise<Response>;
}

describe("POST /api/v1/qualify/professional", () => {
  it("scores a strong lead without requiring a session", async () => {
    const res = await post({
      current_role: "Data Analyst",
      target_role: "Analytics Engineer",
      years_experience: 9,
      source: "linkedin",
      budget_range: "200_500",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      qualified: boolean;
      score: number;
      reasons: string[];
      tier_recommendation: string;
      next_steps: string[];
    };
    expect(body.qualified).toBe(true);
    expect(body.score).toBeGreaterThanOrEqual(0.4);
    expect(body.reasons.length).toBeGreaterThan(0);
    expect(body.tier_recommendation).toBe("professional");
    expect(body.next_steps.length).toBeGreaterThan(0);
  });

  it("rejects incomplete input", async () => {
    const res = await post({ current_role: "Data Analyst" });
    expect(res.status).toBe(400);
  });

  it("rejects unknown enumerations", async () => {
    const res = await post({ current_role: "A", target_role: "B", source: "carrier_pigeon" });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed body", async () => {
    const res = await qualify.fetch(
      new Request("http://clawdyclaw.com/professional", { method: "POST", body: "not json" })
    ) as Promise<Response>;
    expect(res.status).toBe(400);
  });
});
