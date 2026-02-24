import { describe, it, expect } from "vitest";
import { computeProposalReadiness } from "./readiness";

describe("computeProposalReadiness", () => {
  const base = {
    title: "Proposal",
    clientName: "Acme",
    summary: "We need X",
    scopeOfWork: "Scope here",
    deliverables: ["Deliverable 1"],
    priceType: "fixed",
    priceMin: 5000,
    cta: "Reply to confirm",
  };

  it("complete proposal is ready", () => {
    const r = computeProposalReadiness(base);
    expect(r.isReady).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it("missing title", () => {
    const r = computeProposalReadiness({ ...base, title: "" });
    expect(r.isReady).toBe(false);
    expect(r.reasons).toContain("Missing title");
  });

  it("missing client/company", () => {
    const r = computeProposalReadiness({ ...base, clientName: null, company: null });
    expect(r.isReady).toBe(false);
    expect(r.reasons).toContain("Missing client name or company");
  });

  it("company alone is sufficient", () => {
    const r = computeProposalReadiness({ ...base, clientName: null, company: "Acme Inc" });
    expect(r.isReady).toBe(true);
  });

  it("missing summary", () => {
    const r = computeProposalReadiness({ ...base, summary: "" });
    expect(r.isReady).toBe(false);
    expect(r.reasons).toContain("Missing summary");
  });

  it("missing scope of work", () => {
    const r = computeProposalReadiness({ ...base, scopeOfWork: "" });
    expect(r.isReady).toBe(false);
    expect(r.reasons).toContain("Missing scope of work");
  });

  it("missing deliverables", () => {
    const r = computeProposalReadiness({ ...base, deliverables: [] });
    expect(r.isReady).toBe(false);
    expect(r.reasons).toContain("At least one deliverable required");
  });

  it("structured deliverables with items", () => {
    const r = computeProposalReadiness({
      ...base,
      deliverables: { items: ["A", "B"] },
    });
    expect(r.isReady).toBe(true);
  });

  it("missing price info", () => {
    const r = computeProposalReadiness({ ...base, priceType: null, priceMin: null });
    expect(r.isReady).toBe(false);
    expect(r.reasons.some((x) => x.includes("Price info"))).toBe(true);
  });

  it("range requires both min and max", () => {
    const r = computeProposalReadiness({
      ...base,
      priceType: "range",
      priceMin: 1000,
      priceMax: null,
    });
    expect(r.isReady).toBe(false);
  });

  it("range with both values", () => {
    const r = computeProposalReadiness({
      ...base,
      priceType: "range",
      priceMin: 1000,
      priceMax: 2000,
    });
    expect(r.isReady).toBe(true);
  });

  it("missing cta", () => {
    const r = computeProposalReadiness({ ...base, cta: "" });
    expect(r.isReady).toBe(false);
    expect(r.reasons.some((x) => x.includes("Missing CTA"))).toBe(true);
  });

  it("adds warnings for optional fields", () => {
    const r = computeProposalReadiness(base);
    expect(r.warnings.some((w) => w.includes("expiry"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("terms"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("timeline"))).toBe(true);
  });
});
