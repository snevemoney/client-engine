import { describe, it, expect } from "vitest";
import { computeIntakePromotionReadiness } from "./readiness";

describe("computeIntakePromotionReadiness", () => {
  it("missing title", () => {
    const r = computeIntakePromotionReadiness({
      title: "",
      summary: "We need X",
      status: "qualified",
    });
    expect(r.isReadyToPromote).toBe(false);
    expect(r.reasons).toContain("Missing title");
  });

  it("missing summary", () => {
    const r = computeIntakePromotionReadiness({
      title: "Lead",
      summary: "",
      status: "qualified",
    });
    expect(r.isReadyToPromote).toBe(false);
    expect(r.reasons).toContain("Missing summary");
  });

  it("lost/won not promotable", () => {
    const r1 = computeIntakePromotionReadiness({
      title: "X",
      summary: "Y",
      status: "lost",
    });
    expect(r1.isReadyToPromote).toBe(false);
    expect(r1.reasons.some((x) => x.includes("won") || x.includes("lost"))).toBe(true);

    const r2 = computeIntakePromotionReadiness({
      title: "X",
      summary: "Y",
      status: "won",
    });
    expect(r2.isReadyToPromote).toBe(false);
  });

  it("valid promotable", () => {
    const r = computeIntakePromotionReadiness({
      title: "Need funnel",
      summary: "We need automation.",
      status: "qualified",
    });
    expect(r.isReadyToPromote).toBe(true);
  });

  it("unscored but promotable adds warning", () => {
    const r = computeIntakePromotionReadiness({
      title: "X",
      summary: "Y",
      status: "qualified",
      score: null,
    });
    expect(r.isReadyToPromote).toBe(true);
    expect(r.warnings.some((x) => x.includes("score"))).toBe(true);
  });
});
