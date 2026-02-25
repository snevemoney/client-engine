/**
 * Phase 3.3: Unit tests for score trend utilities.
 */
import { describe, it, expect } from "vitest";
import {
  computeTrendSummary,
  computeFactorChanges,
  type TimelinePoint,
  type ScoreEvent,
  type FactorItem,
} from "./trend-utils";

describe("computeTrendSummary", () => {
  it("computes net change from start to end", () => {
    const timeline: TimelinePoint[] = [
      { score: 60, computedAt: "2025-01-01T00:00:00Z" },
      { score: 70, computedAt: "2025-01-02T00:00:00Z" },
    ];
    const events: ScoreEvent[] = [];
    const summary = computeTrendSummary(timeline, events, 70);
    expect(summary.netChange).toBe(10);
    expect(summary.currentScore).toBe(70);
  });

  it("computes min and max in range", () => {
    const timeline: TimelinePoint[] = [
      { score: 50, computedAt: "2025-01-01T00:00:00Z" },
      { score: 90, computedAt: "2025-01-02T00:00:00Z" },
      { score: 70, computedAt: "2025-01-03T00:00:00Z" },
    ];
    const events: ScoreEvent[] = [];
    const summary = computeTrendSummary(timeline, events, 70);
    expect(summary.highest).toBe(90);
    expect(summary.lowest).toBe(50);
  });

  it("counts events by type", () => {
    const timeline: TimelinePoint[] = [
      { score: 70, computedAt: "2025-01-01T00:00:00Z" },
    ];
    const events: ScoreEvent[] = [
      { id: "1", eventType: "threshold_breach", fromScore: 80, toScore: 65, delta: -15, fromBand: "healthy", toBand: "warning", createdAt: "" },
      { id: "2", eventType: "threshold_breach", fromScore: 65, toScore: 60, delta: -5, fromBand: "warning", toBand: "warning", createdAt: "" },
      { id: "3", eventType: "sharp_drop", fromScore: 60, toScore: 40, delta: -20, fromBand: "warning", toBand: "critical", createdAt: "" },
      { id: "4", eventType: "recovery", fromScore: 40, toScore: 55, delta: 15, fromBand: "critical", toBand: "warning", createdAt: "" },
    ];
    const summary = computeTrendSummary(timeline, events, 70);
    expect(summary.eventCounts.threshold_breach).toBe(2);
    expect(summary.eventCounts.sharp_drop).toBe(1);
    expect(summary.eventCounts.recovery).toBe(1);
  });

  it("handles empty timeline", () => {
    const summary = computeTrendSummary([], [], 75);
    expect(summary.netChange).toBe(0);
    expect(summary.highest).toBe(75);
    expect(summary.lowest).toBe(75);
    expect(summary.eventCounts).toEqual({ threshold_breach: 0, sharp_drop: 0, recovery: 0 });
  });
});

describe("computeFactorChanges", () => {
  it("sorts by largest negative impact first", () => {
    const latest: FactorItem[] = [
      { key: "a", label: "A", weight: 0.3, normalizedValue: 80, impact: -5 },
      { key: "b", label: "B", weight: 0.5, normalizedValue: 60, impact: 3 },
      { key: "c", label: "C", weight: 0.2, normalizedValue: 90, impact: -2 },
    ];
    const previous: FactorItem[] = [
      { key: "a", label: "A", weight: 0.3, normalizedValue: 90, impact: 0 },
      { key: "b", label: "B", weight: 0.5, normalizedValue: 50, impact: 0 },
      { key: "c", label: "C", weight: 0.2, normalizedValue: 85, impact: 0 },
    ];
    const changes = computeFactorChanges(latest, previous);
    expect(changes[0].key).toBe("a");
    expect(changes[0].impact).toBe(-5);
    expect(changes[1].key).toBe("c");
    expect(changes[1].impact).toBe(-2);
    expect(changes[2].key).toBe("b");
    expect(changes[2].impact).toBe(3);
  });

  it("returns empty when no previous", () => {
    const latest: FactorItem[] = [
      { key: "a", label: "A", weight: 0.5, normalizedValue: 80, impact: 5 },
    ];
    expect(computeFactorChanges(latest, null)).toEqual([]);
    expect(computeFactorChanges(latest, [])).toEqual([]);
  });

  it("computes delta and direction", () => {
    const latest: FactorItem[] = [
      { key: "x", label: "X", weight: 0.5, normalizedValue: 70, impact: 2 },
    ];
    const previous: FactorItem[] = [
      { key: "x", label: "X", weight: 0.5, normalizedValue: 50, impact: 0 },
    ];
    const changes = computeFactorChanges(latest, previous);
    expect(changes).toHaveLength(1);
    expect(changes[0].prevValue).toBe(50);
    expect(changes[0].currValue).toBe(70);
    expect(changes[0].delta).toBe(20);
    expect(changes[0].direction).toBe("up");
  });
});
