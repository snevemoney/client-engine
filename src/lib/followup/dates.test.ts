import { describe, it, expect } from "vitest";
import {
  isValidDate,
  getStartOfDay,
  getEndOfDay,
  parseDate,
  computeSnoozeDate,
  classifyFollowUpBucket,
} from "./dates";

describe("followup dates", () => {
  describe("isValidDate", () => {
    it("returns true for valid Date", () => {
      expect(isValidDate(new Date("2025-02-22"))).toBe(true);
    });
    it("returns false for invalid Date", () => {
      expect(isValidDate(new Date("invalid"))).toBe(false);
      expect(isValidDate(NaN as unknown as Date)).toBe(false);
    });
    it("returns false for non-Date", () => {
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
      expect(isValidDate("2025-02-22")).toBe(false);
    });
  });

  describe("getStartOfDay / getEndOfDay", () => {
    it("normalizes to 00:00 and 23:59:59.999", () => {
      const d = new Date("2025-02-22T14:30:00Z");
      const start = getStartOfDay(d);
      const end = getEndOfDay(d);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });
  });

  describe("parseDate", () => {
    it("parses ISO strings", () => {
      const d = parseDate("2025-02-22T12:00:00Z");
      expect(d).toBeInstanceOf(Date);
      expect(d?.getFullYear()).toBe(2025);
    });
    it("returns null for invalid", () => {
      expect(parseDate("")).toBe(null);
      expect(parseDate("invalid")).toBe(null);
    });
  });

  describe("computeSnoozeDate", () => {
    const base = new Date("2025-02-22T12:00:00"); // Saturday

    it("2d adds 2 days", () => {
      const out = computeSnoozeDate("2d", base);
      expect(out?.getDate()).toBe(24);
      expect(out?.getMonth()).toBe(1);
    });
    it("5d adds 5 days", () => {
      const out = computeSnoozeDate("5d", base);
      expect(out?.getDate()).toBe(27);
    });
    it("next_monday from Saturday gives Monday", () => {
      const out = computeSnoozeDate("next_monday", base);
      expect(out?.getDay()).toBe(1);
      expect(out?.getDate()).toBe(24); // Monday Feb 24
    });
    it("next_monday from Monday gives next Monday", () => {
      const monday = new Date("2025-02-24T12:00:00");
      const out = computeSnoozeDate("next_monday", monday);
      expect(out?.getDay()).toBe(1);
      expect(out?.getDate()).toBe(3); // March 3
    });
    it("custom uses parsed date", () => {
      const out = computeSnoozeDate("custom", base, "2025-03-01T12:00:00Z");
      expect(out?.getUTCMonth()).toBe(2);
      expect(out?.getUTCDate()).toBe(1);
    });
    it("custom with invalid returns null", () => {
      expect(computeSnoozeDate("custom", base, "")).toBe(null);
      expect(computeSnoozeDate("custom", base, "invalid")).toBe(null);
    });
  });

  describe("classifyFollowUpBucket", () => {
    const now = new Date("2025-02-22T12:00:00");

    it("overdue: before start of today", () => {
      const d = new Date("2025-02-21T23:59:59");
      expect(classifyFollowUpBucket(d, now, 7)).toBe("overdue");
    });
    it("today: within today", () => {
      const d = new Date("2025-02-22T14:00:00");
      expect(classifyFollowUpBucket(d, now, 7)).toBe("today");
    });
    it("upcoming: after today, within N days", () => {
      const d = new Date("2025-02-25T12:00:00");
      expect(classifyFollowUpBucket(d, now, 7)).toBe("upcoming");
    });
    it("null: beyond N days", () => {
      const d = new Date("2025-03-05T12:00:00");
      expect(classifyFollowUpBucket(d, now, 7)).toBe(null);
    });
    it("null for invalid date", () => {
      expect(classifyFollowUpBucket(new Date("invalid"), now, 7)).toBe(null);
    });
  });
});
