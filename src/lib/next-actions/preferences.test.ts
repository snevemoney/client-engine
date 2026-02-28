/**
 * Phase 4.3: Preference matching logic unit tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { isCandidateSuppressed, loadActiveSuppressions, filterByPreferences } from "./preferences";
import type { NextActionCandidate } from "./types";
import { NextActionPriority, RiskSourceType } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    nextActionPreference: {
      findMany: vi.fn(),
    },
  },
}));

describe("preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isCandidateSuppressed", () => {
    const candidate: NextActionCandidate = {
      title: "Test",
      priority: NextActionPriority.medium,
      score: 50,
      sourceType: RiskSourceType.score,
      createdByRule: "score_in_critical_band",
      dedupeKey: "nba:score_in_critical_band:command_center",
    };

    it("returns true when ruleKey matches", () => {
      expect(
        isCandidateSuppressed(candidate, [{ ruleKey: "score_in_critical_band", dedupeKey: null }])
      ).toBe(true);
    });

    it("returns true when dedupeKey matches", () => {
      expect(
        isCandidateSuppressed(candidate, [{ ruleKey: null, dedupeKey: "nba:score_in_critical_band:command_center" }])
      ).toBe(true);
    });

    it("returns false when no match", () => {
      expect(
        isCandidateSuppressed(candidate, [
          { ruleKey: "other_rule", dedupeKey: null },
          { ruleKey: null, dedupeKey: "nba:other:command_center" },
        ])
      ).toBe(false);
    });

    it("returns false for empty suppressions", () => {
      expect(isCandidateSuppressed(candidate, [])).toBe(false);
    });
  });

  describe("loadActiveSuppressions", () => {
    it("returns active preferences for scope", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.nextActionPreference.findMany).mockResolvedValue([
        { ruleKey: "r1", dedupeKey: null },
        { ruleKey: null, dedupeKey: "d1" },
      ] as never[]);

      const result = await loadActiveSuppressions("command_center", "command_center");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ ruleKey: "r1", dedupeKey: null });
      expect(result[1]).toEqual({ ruleKey: null, dedupeKey: "d1" });
    });
  });

  describe("filterByPreferences", () => {
    it("filters out suppressed candidates", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.nextActionPreference.findMany).mockResolvedValue([
        { ruleKey: "suppressed_rule", dedupeKey: null },
      ] as never[]);

      const candidates: NextActionCandidate[] = [
        {
          title: "Suppressed",
          priority: NextActionPriority.high,
          score: 80,
          sourceType: RiskSourceType.score,
          createdByRule: "suppressed_rule",
          dedupeKey: "nba:suppressed_rule:command_center",
        },
        {
          title: "Not suppressed",
          priority: NextActionPriority.medium,
          score: 50,
          sourceType: RiskSourceType.score,
          createdByRule: "other_rule",
          dedupeKey: "nba:other_rule:command_center",
        },
      ];

      const filtered = await filterByPreferences(candidates, "command_center", "command_center");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].createdByRule).toBe("other_rule");
    });
  });
});
