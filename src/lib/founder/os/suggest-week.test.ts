/**
 * Phase 6.2: Unit tests for suggest-week logic.
 */
import { describe, it, expect } from "vitest";
import { buildWeekSuggestions } from "./suggest-week";

describe("buildWeekSuggestions", () => {
  it("returns 3 outcomes when risks, NBA, and pipeline data exist", () => {
    const result = buildWeekSuggestions({
      risk: {
        summary: { openBySeverity: { critical: 1, high: 2 } },
        topOpen5: [
          { id: "r1", title: "Critical risk", severity: "critical", createdByRule: "rule_a" },
        ],
      },
      nba: {
        topQueued5: [
          {
            id: "n1",
            title: "Run NBA",
            reason: "Because",
            priority: "high",
            score: 80,
            createdByRule: "rule_b",
            dedupeKey: "dk1",
          },
        ],
      },
      pipeline: { stuckOver7d: 3, noNextStep: 2, byStage: {} },
    });

    expect(result.topOutcomes).toHaveLength(3);
    expect(result.topOutcomes[0].title).toContain("Address risk");
    expect(result.topOutcomes[0].sources.length).toBeGreaterThanOrEqual(1);
    expect(result.topOutcomes[0].dedupeKey).toBe("risk:r1");

    expect(result.topOutcomes[1].title).toBe("Run NBA");
    expect(result.topOutcomes[1].dedupeKey).toBe("nba:dk1");

    expect(result.topOutcomes[2].title).toMatch(/Unstick|Set next step/);
  });

  it("each outcome has sources", () => {
    const result = buildWeekSuggestions({
      risk: {
        topOpen5: [{ id: "r1", title: "R", severity: "high", createdByRule: "x" }],
      },
      nba: {
        topQueued5: [
          { id: "n1", title: "N", reason: null, priority: "medium", score: 50, createdByRule: "y", dedupeKey: "d1" },
        ],
      },
    });

    for (const o of result.topOutcomes) {
      expect(o.sources).toBeDefined();
      expect(o.sources.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("deduplicates by risk id and nba dedupeKey", () => {
    const result = buildWeekSuggestions({
      risk: {
        topOpen5: [{ id: "r1", title: "Risk", severity: "critical", createdByRule: "r" }],
      },
      nba: {
        topQueued5: [
          { id: "n1", title: "NBA1", reason: null, priority: "high", score: 90, createdByRule: "n", dedupeKey: "d1" },
          { id: "n2", title: "NBA2", reason: null, priority: "medium", score: 70, createdByRule: "n", dedupeKey: "d2" },
        ],
      },
    });

    const keys = result.topOutcomes.map((o) => o.dedupeKey ?? o.id).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("returns focusConstraint from most common ruleKey", () => {
    const result = buildWeekSuggestions({
      risk: {
        topOpen5: [
          { id: "r1", title: "R1", severity: "high", createdByRule: "follow_up" },
          { id: "r2", title: "R2", severity: "medium", createdByRule: "follow_up" },
        ],
      },
      nba: {
        topQueued5: [
          { id: "n1", title: "N", reason: null, priority: "high", score: 80, createdByRule: "score", dedupeKey: "d1" },
        ],
      },
    });

    expect(result.focusConstraint).toBe("follow_up");
  });

  it("returns empty outcomes when no data", () => {
    const result = buildWeekSuggestions({});
    expect(result.topOutcomes).toHaveLength(0);
    expect(result.milestones).toHaveLength(0);
    expect(result.focusConstraint).toBeNull();
  });

  it("milestones include NBA and risk items", () => {
    const result = buildWeekSuggestions({
      risk: {
        topOpen5: [{ id: "r1", title: "Fix risk", severity: "high", createdByRule: "x" }],
      },
      nba: {
        topQueued5: [
          { id: "n1", title: "Do thing", reason: null, priority: "high", score: 90, createdByRule: "y", dedupeKey: "d1" },
        ],
      },
    });

    expect(result.milestones.length).toBeGreaterThanOrEqual(1);
    const titles = result.milestones.map((m) => m.title);
    expect(titles.some((t) => t.includes("Do thing") || t.includes("Fix risk"))).toBe(true);
  });
});
