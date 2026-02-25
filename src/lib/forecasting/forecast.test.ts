import { describe, it, expect } from "vitest";
import { computeWeeklyForecast, computeMonthlyForecast } from "./forecast";

describe("forecast", () => {
  const baseInput = {
    periodStart: new Date(2025, 1, 3), // Monday Feb 3
    periodEnd: new Date(2025, 1, 9, 23, 59, 59),
    now: new Date(2025, 1, 5, 12, 0, 0), // Wed Feb 5 noon
  };

  describe("computeWeeklyForecast", () => {
    it("returns stable shape", () => {
      const r = computeWeeklyForecast({
        ...baseInput,
        proposalsSent: 2,
        acceptedCount: 1,
      });
      expect(r).toHaveProperty("periodType", "weekly");
      expect(r).toHaveProperty("metrics");
      expect(r).toHaveProperty("warnings");
      expect(Array.isArray(r.metrics)).toBe(true);
      expect(Array.isArray(r.warnings)).toBe(true);
    });

    it("metrics have no NaN", () => {
      const r = computeWeeklyForecast({
        ...baseInput,
        proposalsSent: 0,
        acceptedCount: 0,
      });
      for (const m of r.metrics) {
        expect(Number.isNaN(m.actual)).toBe(false);
        expect(Number.isNaN(m.projected)).toBe(false);
      }
    });

    it("includes target comparison when target provided", () => {
      const r = computeWeeklyForecast({
        ...baseInput,
        proposalsSent: 1,
        targetProposalsSent: 5,
      });
      const proposals = r.metrics.find((m) => m.key === "proposals_sent");
      expect(proposals?.target).toBe(5);
      expect(["ahead", "on_track", "behind"]).toContain(proposals?.status);
    });
  });

  describe("computeMonthlyForecast", () => {
    it("returns stable shape", () => {
      const monthStart = new Date(2025, 1, 1);
      const now = new Date(2025, 1, 10);
      const monthEnd = new Date(2025, 1, 28, 23, 59, 59);
      const r = computeMonthlyForecast({
        periodStart: monthStart,
        periodEnd: monthEnd,
        now,
        proposalsSent: 3,
      });
      expect(r).toHaveProperty("periodType", "monthly");
      expect(r).toHaveProperty("metrics");
    });

    it("metrics have no NaN", () => {
      const monthStart = new Date(2025, 1, 1);
      const now = new Date(2025, 1, 1);
      const monthEnd = new Date(2025, 1, 28, 23, 59, 59);
      const r = computeMonthlyForecast({
        periodStart: monthStart,
        periodEnd: monthEnd,
        now,
      });
      for (const m of r.metrics) {
        expect(Number.isNaN(m.actual)).toBe(false);
        expect(Number.isFinite(m.projected) || m.projected === 0).toBe(true);
      }
    });
  });
});
