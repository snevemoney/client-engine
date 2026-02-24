import { describe, it, expect } from "vitest";
import { buildProposalDraftFromIntake } from "./draft-from-intake";

describe("buildProposalDraftFromIntake", () => {
  it("returns all required fields", () => {
    const result = buildProposalDraftFromIntake({
      title: "Need a funnel",
      company: "Acme Inc",
      contactName: "Jane",
      contactEmail: "jane@acme.com",
      summary: "We need automation.",
    });
    expect(result.title).toBe("Need a funnel");
    expect(result.clientName).toBe("Jane");
    expect(result.clientEmail).toBe("jane@acme.com");
    expect(result.company).toBe("Acme Inc");
    expect(result.summary).toBeTruthy();
    expect(result.scopeOfWork).toBeTruthy();
    expect(result.deliverables.length).toBeGreaterThan(0);
    expect(result.cta).toBeTruthy();
    expect(result.priceType).toBe("range");
  });

  it("uses company when no contact name", () => {
    const result = buildProposalDraftFromIntake({
      title: "Job",
      company: "Acme",
      summary: "Brief",
    });
    expect(result.clientName).toBe("Acme");
  });

  it("includes budget in price placeholders", () => {
    const result = buildProposalDraftFromIntake({
      title: "X",
      summary: "Y",
      budgetMin: 3000,
      budgetMax: 5000,
    });
    expect(result.priceMin).toBe(3000);
    expect(result.priceMax).toBe(5000);
  });

  it("draft is axiom-safe (no hype)", () => {
    const result = buildProposalDraftFromIntake({
      title: "Test",
      company: "Test Co",
      summary: "We need help.",
    });
    const text = [result.summary, result.scopeOfWork, result.cta].join(" ").toLowerCase();
    expect(text).not.toMatch(/\b100%\b|\bguarantee\b|act now|limited time|best in class/i);
  });
});
