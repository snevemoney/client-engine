import { describe, it, expect } from "vitest";
import {
  getCurrentWeekStart,
  getWeekStartOffset,
  buildWeekBuckets,
  compareWeeks,
} from "./trends";

describe("getCurrentWeekStart", () => {
  it("returns Monday for a given date", () => {
    const d = new Date("2025-02-22"); // Saturday
    const w = getCurrentWeekStart(d);
    expect(w.getDay()).toBe(1);
  });
});

describe("getWeekStartOffset", () => {
  it("returns week N weeks ago", () => {
    const d = new Date("2025-02-22");
    const w0 = getWeekStartOffset(d, 0);
    const w1 = getWeekStartOffset(d, 1);
    const diff = (w0.getTime() - w1.getTime()) / 86400000;
    expect(diff).toBe(7);
  });
});

describe("buildWeekBuckets", () => {
  it("returns N buckets", () => {
    const buckets = buildWeekBuckets(new Date("2025-02-22"), 4);
    expect(buckets).toHaveLength(4);
  });

  it("returns sorted ascending by date", () => {
    const buckets = buildWeekBuckets(new Date("2025-02-22"), 4);
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].getTime()).toBeGreaterThan(buckets[i - 1].getTime());
    }
  });
});

describe("compareWeeks", () => {
  it("returns up when current > previous", () => {
    const r = compareWeeks(10, 5);
    expect(r.direction).toBe("up");
    expect(r.delta).toBe(5);
    expect(r.deltaPercent).toBe(100);
  });

  it("returns down when current < previous", () => {
    const r = compareWeeks(5, 10);
    expect(r.direction).toBe("down");
    expect(r.delta).toBe(-5);
    expect(r.deltaPercent).toBe(-50);
  });

  it("returns flat when equal", () => {
    const r = compareWeeks(5, 5);
    expect(r.direction).toBe("flat");
    expect(r.delta).toBe(0);
  });

  it("handles zero previous", () => {
    const r = compareWeeks(10, 0);
    expect(r.deltaPercent).toBe(100);
    expect(Number.isNaN(r.deltaPercent)).toBe(false);
  });
});
