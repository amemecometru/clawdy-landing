import { describe, expect, it } from "vitest";
import { buildDefaultMessage } from "../src/api/campaigns";
import type { CampaignLeadDetail } from "../src/db/campaigns";

const lead: CampaignLeadDetail = {
  id: "lead_1",
  campaign_id: "camp_1",
  professional_id: "prof_1",
  sequence_step: 0,
  sequence_status: "pending",
  next_action_at: null,
  stop_reason: null,
  created_at: 0,
  updated_at: 0,
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@example.com",
  current_role: "Data Analyst",
  current_company: "Acme",
  target_role: "Analytics Engineer",
  target_industry: "data",
  tier: "professional",
  budget_range: "200_500",
  qualification_score: 0.8,
};

describe("buildDefaultMessage", () => {
  it("opens with a personalized discovery message", () => {
    const message = buildDefaultMessage(lead, 0);
    expect(message.message_type).toBe("discovery");
    expect(message.subject.length).toBeGreaterThan(0);
    expect(message.body).toContain("Jane");
    expect(message.body).toContain("Analytics Engineer");
  });

  it("escalates to a warm follow-up at step 1", () => {
    const message = buildDefaultMessage(lead, 1);
    expect(message.message_type).toBe("warm_reply");
    expect(message.body).toContain("Jane");
    expect(message.body).not.toBe(buildDefaultMessage(lead, 0).body);
  });

  it("closes out at step 2", () => {
    const message = buildDefaultMessage(lead, 2);
    expect(message.message_type).toBe("no_reply_followup");
    expect(message.body).toContain("close it out");
    expect(message.body).not.toBe(buildDefaultMessage(lead, 1).body);
  });

  it("treats out-of-range steps as discovery", () => {
    expect(buildDefaultMessage(lead, -1).message_type).toBe("discovery");
  });
});
