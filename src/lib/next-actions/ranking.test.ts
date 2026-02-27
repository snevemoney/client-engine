/**
 * Phase 4.1: NBA ranking unit tests.
 */
import { describe, it, expect } from "vitest";
import { NextActionPriority, RiskSourceType } from "@prisma/client";
import { computeNextActionScore, rankNextActions } from "./ranking";
import type { NextActionCandidate } from "./types";

const baseCandidate = (
  overrides: Partial<NextActionCandidate>
): Omit<NextActionCandidate, "score"> => ({
  title: "Test",
  reason: "Test reason",
  priority: NextActionPriority.medium,
  sourceType: RiskSourceType.proposal,
  sourceId: null,
  actionUrl: null,
  createdByRule: "test",
  dedupeKey: "nba:test:command_center",
  ...overrides,
});

describe("NBA ranking", () => {
  const now = new Date("2026-02-26T10:00:00Z");

  it("computes base score from priority", () => {
    const { total } = computeNextActionScore(baseCandidate({ priority: NextActionPriority.critical }), { now });
    expect(total).toBeGreaterThanOrEqual(90);
  });

  it("adds countBoost up to 10", () => {
    const { total } = computeNextActionScore(
      baseCandidate({ priority: NextActionPriority.medium, countBoost: 5 }),
      { now }
    );
    expect(total).toBeGreaterThan(55);
  });

  it("produces stable ordering given same data", () => {
    const candidates: NextActionCandidate[] = [
      { ...baseCandidate({ priority: NextActionPriority.critical }), score: 0 },
      { ...baseCandidate({ priority: NextActionPriority.high, dedupeKey: "nba:b:cmd" }), score: 0 },
      { ...baseCandidate({ priority: NextActionPriority.medium, dedupeKey: "nba:c:cmd" }), score: 0 },
    ];
    const ranked1 = rankNextActions(candidates, now);
    const ranked2 = rankNextActions(candidates, now);
    expect(ranked1.map((r) => r.dedupeKey)).toEqual(ranked2.map((r) => r.dedupeKey));
  });

  it("orders by score desc then priority severity", () => {
    const candidates: NextActionCandidate[] = [
      { ...baseCandidate({ priority: NextActionPriority.low, dedupeKey: "nba:low:cmd" }), score: 0 },
      { ...baseCandidate({ priority: NextActionPriority.critical, dedupeKey: "nba:crit:cmd" }), score: 0 },
      { ...baseCandidate({ priority: NextActionPriority.medium, dedupeKey: "nba:med:cmd" }), score: 0 },
    ];
    const ranked = rankNextActions(candidates, now);
    expect(ranked[0].priority).toBe("critical");
    expect(ranked[ranked.length - 1].priority).toBe("low");
  });

  it("applies dedupePenalty when action exists in scope", () => {
    const cand = baseCandidate({ dedupeKey: "nba:dup:cmd" });
    const { total: without } = computeNextActionScore(cand, { now });
    const { total: withPenalty } = computeNextActionScore(cand, { now, existingInScope: ["nba:dup:cmd"] });
    expect(withPenalty).toBeLessThan(without);
  });
});
