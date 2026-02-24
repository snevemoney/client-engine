import { describe, it, expect } from "vitest";
import { computeProofCandidateReadiness } from "./readiness";

describe("computeProofCandidateReadiness", () => {
  it("not ready: missing title", () => {
    const r = computeProofCandidateReadiness({
      title: "",
      githubUrl: "https://github.com/o/r",
      proofSnippet: "Did X",
    });
    expect(r.isReady).toBe(false);
    expect(r.reasons).toContain("Missing title");
  });

  it("not ready: no evidence signal", () => {
    const r = computeProofCandidateReadiness({
      title: "Delivery proof",
      metricLabel: "Speed",
      metricValue: "10%",
    });
    expect(r.isReady).toBe(false);
    expect(r.reasons.some((x) => x.includes("evidence"))).toBe(true);
  });

  it("not ready: no outcome field", () => {
    const r = computeProofCandidateReadiness({
      title: "Delivery proof",
      githubUrl: "https://github.com/o/r",
    });
    expect(r.isReady).toBe(false);
  });

  it("ready: github + proofSnippet", () => {
    const r = computeProofCandidateReadiness({
      title: "Delivery proof",
      githubUrl: "https://github.com/o/r",
      proofSnippet: "Delivered feature X",
    });
    expect(r.isReady).toBe(true);
    expect(r.reasons.length).toBe(0);
  });

  it("ready: loom + afterState", () => {
    const r = computeProofCandidateReadiness({
      title: "Delivery proof",
      loomUrl: "https://loom.com/share/abc",
      afterState: "Feature shipped",
    });
    expect(r.isReady).toBe(true);
  });

  it("ready: deliverySummary + metricLabel/metricValue", () => {
    const r = computeProofCandidateReadiness({
      title: "Delivery proof",
      deliverySummary: "Built dashboard",
      metricLabel: "Response time",
      metricValue: "50% faster",
    });
    expect(r.isReady).toBe(true);
  });
});
