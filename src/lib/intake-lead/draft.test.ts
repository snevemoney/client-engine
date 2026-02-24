import { describe, it, expect } from "vitest";
import { generateDraft } from "./draft";

describe("generateDraft", () => {
  it("returns all sections", () => {
    const result = generateDraft({
      title: "Need a funnel",
      company: "Acme Inc",
      summary: "We need automation for our coaching business.",
      urgency: "medium",
      score: 70,
    });
    expect(result.opener).toContain("Need a funnel");
    expect(result.opener).toContain("Acme Inc");
    expect(result.problemFraming).toBeTruthy();
    expect(result.proposedNextStep).toBeTruthy();
    expect(result.cta).toBeTruthy();
    expect(result.full).toContain(result.opener);
    expect(result.full).toContain(result.problemFraming);
  });

  it("handles null company", () => {
    const result = generateDraft({
      title: "Some job",
      company: null,
      summary: "Brief",
      urgency: "low",
      score: null,
    });
    expect(result.opener).toContain("Some job");
    expect(result.opener).not.toContain("null");
  });

  it("uses urgency in proposed next step", () => {
    const high = generateDraft({
      title: "X",
      company: null,
      summary: "X",
      urgency: "high",
      score: null,
    });
    expect(high.proposedNextStep.toLowerCase()).toContain("urgency");
  });

  it("draft is axiom-safe (no hype)", () => {
    const result = generateDraft({
      title: "Test",
      company: "Test Co",
      summary: "We need help.",
      urgency: "medium",
      score: 80,
    });
    const full = result.full.toLowerCase();
    expect(full).not.toMatch(/\b100%\b|\bguarantee\b|act now|limited time|best in class/i);
    expect(full).toMatch(/short call|small|experiment|reversible|low-risk|sandbox/i);
  });
});
