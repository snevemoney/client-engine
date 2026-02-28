/**
 * Phase 7.3: Attribution unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  computeAttributionDelta,
  deltaToOutcome,
  type AttributionContext,
} from "./attribution";

describe("attribution", () => {
  describe("computeAttributionDelta", () => {
    it("computes score deltas", () => {
      const before: AttributionContext = {
        score: { band: "warning", score: 45, updatedAt: "2025-01-01T00:00:00Z" },
        risk: { openCount: 3, criticalCount: 1, topKeys: [] },
        nba: { queuedCount: 5, topRuleKeys: [] },
      };
      const after: AttributionContext = {
        score: { band: "healthy", score: 52, updatedAt: "2025-01-01T01:00:00Z" },
        risk: { openCount: 2, criticalCount: 0, topKeys: [] },
        nba: { queuedCount: 4, topRuleKeys: [] },
      };
      const delta = computeAttributionDelta(before, after);
      expect(delta.scoreDelta).toBe(7);
      expect(delta.bandChange).toEqual({ from: "warning", to: "healthy" });
      expect(delta.riskOpenDelta).toBe(-1);
      expect(delta.riskCriticalDelta).toBe(-1);
      expect(delta.nbaQueuedDelta).toBe(-1);
    });
  });

  describe("deltaToOutcome", () => {
    it("returns improved when riskCriticalDelta < 0", () => {
      const delta = {
        scoreDelta: null,
        bandChange: null,
        riskOpenDelta: 0,
        riskCriticalDelta: -1,
        nbaQueuedDelta: 0,
      };
      expect(deltaToOutcome(delta)).toBe("improved");
    });

    it("returns worsened when riskCriticalDelta > 0", () => {
      const delta = {
        scoreDelta: null,
        bandChange: null,
        riskOpenDelta: 0,
        riskCriticalDelta: 1,
        nbaQueuedDelta: 0,
      };
      expect(deltaToOutcome(delta)).toBe("worsened");
    });

    it("returns improved when scoreDelta >= 5", () => {
      const delta = {
        scoreDelta: 6,
        bandChange: null,
        riskOpenDelta: 0,
        riskCriticalDelta: 0,
        nbaQueuedDelta: 0,
      };
      expect(deltaToOutcome(delta)).toBe("improved");
    });

    it("returns worsened when scoreDelta <= -5", () => {
      const delta = {
        scoreDelta: -6,
        bandChange: null,
        riskOpenDelta: 0,
        riskCriticalDelta: 0,
        nbaQueuedDelta: 0,
      };
      expect(deltaToOutcome(delta)).toBe("worsened");
    });

    it("returns neutral for small deltas", () => {
      const delta = {
        scoreDelta: 2,
        bandChange: null,
        riskOpenDelta: 0,
        riskCriticalDelta: 0,
        nbaQueuedDelta: 0,
      };
      expect(deltaToOutcome(delta)).toBe("neutral");
    });
  });
});
