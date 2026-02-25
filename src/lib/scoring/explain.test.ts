import { describe, it, expect } from "vitest";
import { buildReasons } from "./explain";
import type { ScoreFactorResult } from "./types";

describe("buildReasons", () => {
  it("returns empty for empty breakdown", () => {
    expect(buildReasons([])).toEqual([]);
  });

  it("orders top negative first, then positive", () => {
    const breakdown: ScoreFactorResult[] = [
      { key: "a", label: "A", rawValue: 10, normalizedValue: 10, weight: 1, impact: -20, direction: "negative" },
      { key: "b", label: "B", rawValue: 90, normalizedValue: 90, weight: 1, impact: 15, direction: "positive" },
    ];
    const r = buildReasons(breakdown);
    expect(r.length).toBeGreaterThan(0);
    const neg = r.filter((x) => x.direction === "negative");
    const pos = r.filter((x) => x.direction === "positive");
    if (neg.length > 0 && pos.length > 0) {
      expect(r.indexOf(neg[0])).toBeLessThan(r.indexOf(pos[0]));
    }
  });

  it("respects maxCount", () => {
    const breakdown: ScoreFactorResult[] = Array.from({ length: 10 }, (_, i) => ({
      key: `f${i}`,
      label: `F${i}`,
      rawValue: 50,
      normalizedValue: 50,
      weight: 1,
      impact: i % 2 === 0 ? -10 : 10,
      direction: (i % 2 === 0 ? "negative" : "positive") as "negative" | "positive",
    }));
    const r = buildReasons(breakdown, 3);
    expect(r.length).toBeLessThanOrEqual(3);
  });
});
