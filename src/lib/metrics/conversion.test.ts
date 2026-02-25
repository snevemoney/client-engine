import { describe, it, expect } from "vitest";
import { computeConversionMetrics } from "./conversion";

describe("computeConversionMetrics", () => {
  it("returns 0 rates when all counts are 0", () => {
    const r = computeConversionMetrics({});
    expect(r.intakeToPromotedRate).toBe(0);
    expect(r.promotedToProposalRate).toBe(0);
    expect(r.proposalSentToAcceptedRate).toBe(0);
    expect(r.acceptedToDeliveryStartedRate).toBe(0);
    expect(r.deliveryCompletedToProofRate).toBe(0);
    expect(r.counts.intake).toBe(0);
  });

  it("returns 0 for zero denominator", () => {
    const r = computeConversionMetrics({
      intakeCount: 0,
      promotedCount: 0,
      proposalSentCount: 0,
      acceptedCount: 0,
      deliveryCompletedCount: 0,
    });
    expect(r.intakeToPromotedRate).toBe(0);
    expect(r.proposalSentToAcceptedRate).toBe(0);
    expect(r.deliveryCompletedToProofRate).toBe(0);
  });

  it("computes proposalSentToAcceptedRate correctly", () => {
    const r = computeConversionMetrics({
      proposalSentCount: 10,
      acceptedCount: 3,
    });
    expect(r.proposalSentToAcceptedRate).toBe(0.3);
    expect(r.counts.proposalSent).toBe(10);
    expect(r.counts.accepted).toBe(3);
  });

  it("never returns NaN", () => {
    const r = computeConversionMetrics({
      intakeCount: 0,
      promotedCount: 1,
      proposalSentCount: 0,
      acceptedCount: 1,
      deliveryCompletedCount: 0,
    });
    expect(Number.isNaN(r.intakeToPromotedRate)).toBe(false);
    expect(Number.isNaN(r.promotedToProposalRate)).toBe(false);
    expect(Number.isNaN(r.proposalSentToAcceptedRate)).toBe(false);
  });

  it("caps rate at 1", () => {
    const r = computeConversionMetrics({
      proposalSentCount: 5,
      acceptedCount: 10,
    });
    expect(r.proposalSentToAcceptedRate).toBe(1);
  });
});
