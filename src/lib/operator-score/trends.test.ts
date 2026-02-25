import { describe, it, expect } from "vitest";
import {
  getMonthStart,
  getWeekStartOffset,
  getMonthStartOffset,
  compareScoreToPrevious,
  gradeToColor,
  formatScoreLabel,
} from "./trends";

describe("operator-score trends", () => {
  describe("getMonthStart", () => {
    it("returns first of month", () => {
      const d = new Date(2025, 2, 15); // March 15
      const m = getMonthStart(d);
      expect(m.getMonth()).toBe(2);
      expect(m.getDate()).toBe(1);
      expect(m.getHours()).toBe(0);
    });
  });

  describe("getWeekStartOffset", () => {
    it("returns week N weeks ago", () => {
      const d = new Date(2025, 2, 17); // Monday March 17
      const w0 = getWeekStartOffset(d, 0);
      const w1 = getWeekStartOffset(d, 1);
      expect(w1.getTime()).toBeLessThan(w0.getTime());
      expect(Math.abs(w0.getTime() - w1.getTime())).toBe(7 * 86400000);
    });
  });

  describe("getMonthStartOffset", () => {
    it("returns month N months ago", () => {
      const d = new Date(2025, 2, 1);
      const m1 = getMonthStartOffset(d, 1);
      expect(m1.getMonth()).toBe(1);
      expect(m1.getFullYear()).toBe(2025);
    });
  });

  describe("compareScoreToPrevious", () => {
    it("returns up when current > previous", () => {
      const r = compareScoreToPrevious(80, 70);
      expect(r.direction).toBe("up");
      expect(r.delta).toBe(10);
    });
    it("returns down when current < previous", () => {
      const r = compareScoreToPrevious(60, 70);
      expect(r.direction).toBe("down");
      expect(r.delta).toBe(-10);
    });
    it("returns flat when equal", () => {
      const r = compareScoreToPrevious(70, 70);
      expect(r.direction).toBe("flat");
    });
    it("handles zero previous", () => {
      const r = compareScoreToPrevious(50, 0);
      expect(r.deltaPercent).toBe(100);
      expect(Number.isNaN(r.deltaPercent)).toBe(false);
    });
  });

  describe("gradeToColor", () => {
    it("returns color for each grade", () => {
      expect(gradeToColor("A")).toContain("emerald");
      expect(gradeToColor("F")).toContain("red");
    });
  });

  describe("formatScoreLabel", () => {
    it("formats valid score", () => {
      expect(formatScoreLabel(85)).toBe("85");
    });
    it("returns — for invalid", () => {
      expect(formatScoreLabel(NaN)).toBe("—");
    });
  });
});
