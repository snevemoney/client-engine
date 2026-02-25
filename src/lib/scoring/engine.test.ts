import { describe, it, expect } from "vitest";
import { computeScore, assignBand, DEFAULT_THRESHOLDS } from "./engine";
import type { ScoreFactorInput, ScoreThresholds } from "./types";

describe("score engine", () => {
  describe("assignBand", () => {
    it("returns healthy for score >= 80", () => {
      expect(assignBand(80)).toBe("healthy");
      expect(assignBand(100)).toBe("healthy");
    });

    it("returns warning for score 50-79", () => {
      expect(assignBand(50)).toBe("warning");
      expect(assignBand(79)).toBe("warning");
    });

    it("returns critical for score < 50", () => {
      expect(assignBand(49)).toBe("critical");
      expect(assignBand(0)).toBe("critical");
    });

    it("uses custom thresholds when provided", () => {
      const t: ScoreThresholds = { healthyMin: 90, warningMin: 60 };
      expect(assignBand(85, t)).toBe("warning");
      expect(assignBand(95, t)).toBe("healthy");
      expect(assignBand(50, t)).toBe("critical");
    });
  });

  describe("computeScore", () => {
    it("returns stable shape with empty factors", () => {
      const r = computeScore({ factors: [] });
      expect(r).toHaveProperty("score", 50);
      expect(r).toHaveProperty("band");
      expect(r).toHaveProperty("reasons");
      expect(r).toHaveProperty("factorBreakdown");
      expect(r).toHaveProperty("computedAt");
      expect(Array.isArray(r.reasons)).toBe(true);
      expect(Array.isArray(r.factorBreakdown)).toBe(true);
    });

    it("computes weighted score from factors", () => {
      const factors: ScoreFactorInput[] = [
        { key: "a", label: "A", rawValue: 100, normalizedValue: 100, weight: 1, direction: "positive" },
        { key: "b", label: "B", rawValue: 0, normalizedValue: 0, weight: 1, direction: "positive" },
      ];
      const r = computeScore({ factors });
      expect(r.score).toBe(50); // (100 + 0) / 2
    });

    it("clamps factor normalized values to 0-100", () => {
      const factors: ScoreFactorInput[] = [
        { key: "a", label: "A", rawValue: 150, normalizedValue: 150, weight: 1, direction: "positive" },
      ];
      const r = computeScore({ factors });
      expect(r.score).toBe(100);
    });

    it("assigns band from computed score", () => {
      const factors: ScoreFactorInput[] = [
        { key: "a", label: "A", rawValue: 90, normalizedValue: 90, weight: 1, direction: "positive" },
      ];
      const r = computeScore({ factors });
      expect(r.band).toBe("healthy");
    });

    it("returns factor breakdown with impact", () => {
      const factors: ScoreFactorInput[] = [
        { key: "a", label: "A", rawValue: 80, normalizedValue: 80, weight: 2, direction: "positive" },
        { key: "b", label: "B", rawValue: 20, normalizedValue: 20, weight: 1, direction: "negative" },
      ];
      const r = computeScore({ factors });
      expect(r.factorBreakdown).toHaveLength(2);
      expect(r.factorBreakdown[0]).toHaveProperty("impact");
      expect(r.factorBreakdown[0]).toHaveProperty("key", "a");
    });

    it("orders reasons: top negative first, then positive", () => {
      const factors: ScoreFactorInput[] = [
        { key: "bad", label: "Bad", rawValue: 10, normalizedValue: 10, weight: 2, direction: "negative", reason: "Low" },
        { key: "good", label: "Good", rawValue: 90, normalizedValue: 90, weight: 1, direction: "positive", reason: "High" },
      ];
      const r = computeScore({ factors });
      expect(r.reasons.length).toBeGreaterThan(0);
      const negFirst = r.reasons.findIndex((x) => x.direction === "negative");
      const posFirst = r.reasons.findIndex((x) => x.direction === "positive");
      if (negFirst >= 0 && posFirst >= 0) {
        expect(negFirst).toBeLessThan(posFirst);
      }
    });

    it("computes weighted score with unequal weights", () => {
      const factors: ScoreFactorInput[] = [
        { key: "a", label: "A", rawValue: 100, normalizedValue: 100, weight: 3, direction: "positive" },
        { key: "b", label: "B", rawValue: 0, normalizedValue: 0, weight: 1, direction: "positive" },
      ];
      const r = computeScore({ factors });
      expect(r.score).toBe(75);
    });

    it("clamps negative normalized values to 0", () => {
      const factors: ScoreFactorInput[] = [
        { key: "a", label: "A", rawValue: -10, normalizedValue: -10, weight: 1, direction: "positive" },
      ];
      const r = computeScore({ factors });
      expect(r.score).toBe(0);
    });

    it("explanation orders top negative reasons first", () => {
      const factors: ScoreFactorInput[] = [
        { key: "n1", label: "N1", rawValue: 5, normalizedValue: 5, weight: 2, direction: "negative", reason: "Bad 1" },
        { key: "n2", label: "N2", rawValue: 20, normalizedValue: 20, weight: 1, direction: "negative", reason: "Bad 2" },
        { key: "p1", label: "P1", rawValue: 90, normalizedValue: 90, weight: 1, direction: "positive", reason: "Good 1" },
      ];
      const r = computeScore({ factors });
      expect(r.reasons.length).toBeGreaterThan(0);
      const firstReason = r.reasons[0];
      expect(firstReason.direction).toBe("negative");
    });
  });

  describe("DEFAULT_THRESHOLDS", () => {
    it("matches spec", () => {
      expect(DEFAULT_THRESHOLDS.healthyMin).toBe(80);
      expect(DEFAULT_THRESHOLDS.warningMin).toBe(50);
    });
  });
});
