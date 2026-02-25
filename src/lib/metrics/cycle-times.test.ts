import { describe, it, expect } from "vitest";
import { daysBetween, computeCycleTimeMetrics } from "./cycle-times";

describe("daysBetween", () => {
  it("returns null for null/undefined", () => {
    expect(daysBetween(null, new Date())).toBeNull();
    expect(daysBetween(new Date(), null)).toBeNull();
    expect(daysBetween(undefined, undefined)).toBeNull();
  });

  it("returns correct days for valid dates", () => {
    const a = new Date("2025-02-01T00:00:00Z");
    const b = new Date("2025-02-08T00:00:00Z");
    expect(daysBetween(a, b)).toBe(7);
  });

  it("returns negative for reversed order", () => {
    const a = new Date("2025-02-08T00:00:00Z");
    const b = new Date("2025-02-01T00:00:00Z");
    expect(daysBetween(a, b)).toBe(-7);
  });
});

describe("computeCycleTimeMetrics", () => {
  it("returns 0 for empty input", () => {
    const r = computeCycleTimeMetrics({});
    expect(r.proposalSentToAcceptedAvgDays).toBe(0);
    expect(r.counts.proposalSentToAccepted).toBe(0);
  });

  it("ignores invalid dates", () => {
    const r = computeCycleTimeMetrics({
      proposalSentToAccepted: [
        { sentAt: null, acceptedAt: new Date() },
        { sentAt: "invalid", acceptedAt: new Date() },
      ],
    });
    expect(r.counts.proposalSentToAccepted).toBe(0);
  });

  it("computes average correctly", () => {
    const r = computeCycleTimeMetrics({
      proposalSentToAccepted: [
        { sentAt: new Date("2025-02-01"), acceptedAt: new Date("2025-02-03") },
        { sentAt: new Date("2025-02-01"), acceptedAt: new Date("2025-02-05") },
      ],
    });
    expect(r.proposalSentToAcceptedAvgDays).toBe(3);
    expect(r.counts.proposalSentToAccepted).toBe(2);
  });

  it("never returns NaN", () => {
    const r = computeCycleTimeMetrics({
      proposalSentToAccepted: [],
    });
    expect(Number.isNaN(r.proposalSentToAcceptedAvgDays)).toBe(false);
  });
});
