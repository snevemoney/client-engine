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

  it("applies learned weights: ruleWeight boosts score", () => {
    const cand = baseCandidate({ createdByRule: "flywheel_stage_stall", dedupeKey: "nba:flywheel_stage_stall:cmd" });
    const { total: without } = computeNextActionScore(cand, { now });
    const ruleWeights = new Map<string, number>([["flywheel_stage_stall", 3]]);
    const { total: withBoost } = computeNextActionScore(cand, {
      now,
      learnedWeights: { ruleWeights, actionWeights: new Map() },
    });
    expect(withBoost).toBeGreaterThan(without);
  });

  it("applies effectiveness boost when effectivenessByRuleKey provided", () => {
    const cand = baseCandidate({ createdByRule: "r1", dedupeKey: "nba:r1:cmd" });
    const { total: without } = computeNextActionScore(cand, { now });
    const effectivenessByRuleKey = new Map<string, number>([["r1", 4]]);
    const { total: withBoost } = computeNextActionScore(cand, {
      now,
      effectivenessByRuleKey,
    });
    expect(withBoost).toBe(without + 4);
  });

  it("effectiveness boost is bounded to -6..+6", () => {
    const cand = baseCandidate({ createdByRule: "r1", dedupeKey: "nba:r1:cmd" });
    const effectivenessByRuleKey = new Map<string, number>([["r1", 20]]);
    const { total } = computeNextActionScore(cand, { now, effectivenessByRuleKey });
    const { total: base } = computeNextActionScore(cand, { now });
    expect(total - base).toBeLessThanOrEqual(6);
  });

  it("action weight uses mark_done as global proxy for all candidates", () => {
    const cand1 = baseCandidate({ createdByRule: "flywheel_stage_stall", dedupeKey: "nba:a:cmd" });
    const cand2 = baseCandidate({ createdByRule: "score_in_critical_band", dedupeKey: "nba:b:cmd" });
    const actionWeights = new Map<string, number>([["mark_done", 2]]);
    const weights = { ruleWeights: new Map<string, number>(), actionWeights };
    const { total: t1 } = computeNextActionScore(cand1, { now, learnedWeights: weights });
    const { total: t2 } = computeNextActionScore(cand2, { now, learnedWeights: weights });
    const { total: base1 } = computeNextActionScore(cand1, { now });
    const { total: base2 } = computeNextActionScore(cand2, { now });
    expect(t1 - base1).toBe(2);
    expect(t2 - base2).toBe(2);
  });

  it("applies learned weights: ruleWeight <= -3 adds penalty", () => {
    const cand = baseCandidate({ createdByRule: "overdue_reminders", dedupeKey: "nba:overdue:cmd" });
    const ruleWeights = new Map<string, number>([["overdue_reminders", -4]]);
    const { total } = computeNextActionScore(cand, {
      now,
      learnedWeights: { ruleWeights, actionWeights: new Map() },
    });
    expect(total).toBeLessThan(55);
  });
});
