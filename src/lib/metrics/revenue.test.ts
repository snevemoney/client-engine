import { describe, it, expect } from "vitest";
import { computeRevenueMetrics } from "./revenue";

describe("computeRevenueMetrics", () => {
  it("returns zeros for empty input", () => {
    const r = computeRevenueMetrics({});
    expect(r.acceptedValueThisWeek).toBe(0);
    expect(r.wonValueThisWeek).toBe(0);
    expect(r.deliveredValueThisWeek).toBe(0);
    expect(r.avgProposalValue).toBe(0);
    expect(r.upsellOpenValue).toBe(0);
  });

  it("uses finalValue when present", () => {
    const r = computeRevenueMetrics({
      proposals: [
        { finalValue: 5000, priceMin: 1000, priceMax: 2000, acceptedAt: new Date() },
      ],
      weekStart: new Date(0),
      weekEnd: new Date(8640000000000000),
    });
    expect(r.acceptedValueThisWeek).toBe(5000);
  });

  it("falls back to priceMin+priceMax/2 when no finalValue", () => {
    const r = computeRevenueMetrics({
      proposals: [
        { priceMin: 2000, priceMax: 4000, acceptedAt: new Date() },
      ],
      weekStart: new Date(0),
      weekEnd: new Date(8640000000000000),
    });
    expect(r.acceptedValueThisWeek).toBe(3000);
  });

  it("handles null money fields", () => {
    const r = computeRevenueMetrics({
      proposals: [
        { finalValue: null, priceMin: null, priceMax: null, acceptedAt: new Date() },
      ],
      weekStart: new Date(0),
      weekEnd: new Date(8640000000000000),
    });
    expect(r.acceptedValueThisWeek).toBe(0);
  });

  it("never returns NaN or Infinity", () => {
    const r = computeRevenueMetrics({
      proposals: [{ acceptedAt: null }],
      deliveryProjects: [],
    });
    expect(Number.isNaN(r.avgProposalValue)).toBe(false);
    expect(Number.isFinite(r.avgProposalValue)).toBe(true);
  });
});
