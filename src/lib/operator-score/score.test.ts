import { describe, it, expect } from "vitest";
import { computeOperatorScore } from "./score";

describe("computeOperatorScore", () => {
  it("returns stable shape with empty input", () => {
    const r = computeOperatorScore({});
    expect(r).toHaveProperty("score");
    expect(r).toHaveProperty("grade");
    expect(r).toHaveProperty("breakdown");
    expect(r).toHaveProperty("summary");
    expect(r).toHaveProperty("topWins");
    expect(r).toHaveProperty("topRisks");
    expect(Array.isArray(r.topWins)).toBe(true);
    expect(Array.isArray(r.topRisks)).toBe(true);
  });

  it("clamps score 0-100", () => {
    const r = computeOperatorScore({});
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(Number.isFinite(r.score)).toBe(true);
    expect(Number.isNaN(r.score)).toBe(false);
  });

  it("returns valid grade", () => {
    const r = computeOperatorScore({});
    expect(["A", "B", "C", "D", "F"]).toContain(r.grade);
  });

  it("breakdown has no NaN", () => {
    const r = computeOperatorScore({
      readyNotSent: 5,
      staleProposals: 3,
      proposalSentToAcceptedRate: 0.5,
      deliveryOverdue: 2,
      totalCompleted: 10,
      completedNoHandoff: 2,
      handoffNoClientConfirm: 1,
      proofCandidatesReadyPending: 1,
      wonMissingProof: 2,
      totalCompletedForProof: 10,
      completedNoTestimonialRequest: 3,
      completedNoProof: 2,
    });
    for (const [, v] of Object.entries(r.breakdown)) {
      expect(Number.isNaN((v as { score: number }).score)).toBe(false);
      expect(Number.isFinite((v as { score: number }).score)).toBe(true);
    }
  });

  it("scores higher with good inputs", () => {
    const bad = computeOperatorScore({
      readyNotSent: 5,
      sentNoFollowup: 3,
      staleProposals: 2,
      proposalSentToAcceptedRate: 0.2,
      deliveryOverdue: 2,
      totalCompleted: 5,
      completedNoHandoff: 2,
    });
    const good = computeOperatorScore({
      readyNotSent: 0,
      sentNoFollowup: 0,
      staleProposals: 0,
      proposalSentToAcceptedRate: 0.8,
      acceptedToDeliveryStartedRate: 0.9,
      deliveryCompletedToProofRate: 0.7,
      deliveryOverdue: 0,
      totalCompleted: 10,
      completedNoHandoff: 0,
      handoffNoClientConfirm: 0,
      proofCandidatesReadyPending: 0,
      wonMissingProof: 0,
      totalCompletedForProof: 10,
      completedNoTestimonialRequest: 0,
      completedNoProof: 0,
      reviewCompletedThisWeek: true,
      metricsSnapshotCaptured: true,
    });
    expect(good.score).toBeGreaterThan(bad.score);
  });
});
