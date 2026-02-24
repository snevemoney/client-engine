import { describe, it, expect } from "vitest";
import { scoreIntakeLead } from "./score";

describe("scoreIntakeLead", () => {
  it("returns score and reason", () => {
    const result = scoreIntakeLead({
      source: "upwork",
      title: "Need website automation",
      company: "Acme Inc",
      summary: "We need a funnel built with automation. Website, ads, and CRM integration.",
      budgetMin: 3000,
      budgetMax: 5000,
      urgency: "high",
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(typeof result.scoreReason).toBe("string");
    expect(result.scoreReason.length).toBeGreaterThan(0);
  });

  it("scores higher for inbound and referral", () => {
    const inbound = scoreIntakeLead({
      source: "inbound",
      title: "Test",
      company: null,
      summary: "Short",
      budgetMin: null,
      budgetMax: null,
      urgency: "low",
    });
    const other = scoreIntakeLead({
      source: "other",
      title: "Test",
      company: null,
      summary: "Short",
      budgetMin: null,
      budgetMax: null,
      urgency: "low",
    });
    expect(inbound.score).toBeGreaterThanOrEqual(other.score);
  });

  it("scores higher with budget", () => {
    const withBudget = scoreIntakeLead({
      source: "other",
      title: "Test",
      company: null,
      summary: "Short",
      budgetMin: 1000,
      budgetMax: 2000,
      urgency: "low",
    });
    const noBudget = scoreIntakeLead({
      source: "other",
      title: "Test",
      company: null,
      summary: "Short",
      budgetMin: null,
      budgetMax: null,
      urgency: "low",
    });
    expect(withBudget.score).toBeGreaterThan(noBudget.score);
  });

  it("scores higher with fit keywords", () => {
    const withKeywords = scoreIntakeLead({
      source: "other",
      title: "Website automation and AI funnel",
      company: null,
      summary: "We need automation for our workflow and ads.",
      budgetMin: null,
      budgetMax: null,
      urgency: "low",
    });
    const noKeywords = scoreIntakeLead({
      source: "other",
      title: "Random thing",
      company: null,
      summary: "Just random text",
      budgetMin: null,
      budgetMax: null,
      urgency: "low",
    });
    expect(withKeywords.score).toBeGreaterThan(noKeywords.score);
  });

  it("clamps score to 0-100", () => {
    const result = scoreIntakeLead({
      source: "other",
      title: "x",
      company: null,
      summary: "x",
      budgetMin: null,
      budgetMax: null,
      urgency: "low",
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
