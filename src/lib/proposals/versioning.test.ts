import { describe, it, expect } from "vitest";
import { buildProposalSnapshot, nextProposalVersion } from "./versioning";

describe("buildProposalSnapshot", () => {
  it("serializes full proposal", () => {
    const snap = buildProposalSnapshot({
      title: "Proposal",
      clientName: "Acme",
      summary: "Summary",
      scopeOfWork: "Scope",
      deliverables: ["A", "B"],
      priceType: "fixed",
      priceMin: 5000,
      cta: "Reply",
    });
    expect(snap.title).toBe("Proposal");
    expect(snap.clientName).toBe("Acme");
    expect(snap.deliverables).toEqual(["A", "B"]);
    expect(snap.priceCurrency).toBe("CAD");
  });

  it("handles nulls", () => {
    const snap = buildProposalSnapshot({ title: "X" });
    expect(snap.clientName).toBeNull();
    expect(snap.summary).toBeNull();
    expect(snap.deliverables).toBeNull();
  });
});

describe("nextProposalVersion", () => {
  it("increments version", () => {
    expect(nextProposalVersion(1)).toBe(2);
    expect(nextProposalVersion(5)).toBe(6);
  });

  it("handles zero", () => {
    expect(nextProposalVersion(0)).toBe(1);
  });
});
