import { describe, it, expect } from "vitest";
import {
  isReminderDue,
  classifyReminderBucket,
  computeSnoozeUntil,
  parseDate,
} from "./dates";

describe("reminders dates", () => {
  describe("parseDate", () => {
    it("parses valid date", () => {
      const d = new Date(2025, 1, 15);
      expect(parseDate(d)).toEqual(d);
    });
    it("returns null for invalid", () => {
      expect(parseDate(null)).toBe(null);
      expect(parseDate("")).toBe(null);
    });
  });

  describe("isReminderDue", () => {
    it("returns true when due and not snoozed", () => {
      const past = new Date(Date.now() - 86400000);
      expect(isReminderDue(past, null)).toBe(true);
    });
    it("returns false when snoozed", () => {
      const past = new Date(Date.now() - 86400000);
      const future = new Date(Date.now() + 86400000);
      expect(isReminderDue(past, future)).toBe(false);
    });
    it("returns false when due is null", () => {
      expect(isReminderDue(null, null)).toBe(false);
    });
  });

  describe("classifyReminderBucket", () => {
    const now = new Date(2025, 1, 12, 12, 0, 0); // Wed Feb 12 noon

    it("returns overdue for past due", () => {
      const yesterday = new Date(2025, 1, 11);
      expect(classifyReminderBucket(yesterday, null, "open", now)).toBe("overdue");
    });
    it("returns today for same day", () => {
      const today = new Date(2025, 1, 12, 14, 0, 0);
      expect(classifyReminderBucket(today, null, "open", now)).toBe("today");
    });
    it("returns upcoming for future", () => {
      const tomorrow = new Date(2025, 1, 13);
      expect(classifyReminderBucket(tomorrow, null, "open", now)).toBe("upcoming");
    });
    it("returns unscheduled for null due", () => {
      expect(classifyReminderBucket(null, null, "open", now)).toBe("unscheduled");
    });
    it("returns snoozed when snoozed until future", () => {
      const future = new Date(2025, 1, 20);
      expect(classifyReminderBucket(null, future, "snoozed", now)).toBe("snoozed");
    });
  });

  describe("computeSnoozeUntil", () => {
    const from = new Date(2025, 1, 12, 10, 0, 0);

    it("2h adds 2 hours", () => {
      const r = computeSnoozeUntil("2h", from);
      expect(r).not.toBeNull();
      expect(r!.getTime() - from.getTime()).toBe(2 * 60 * 60 * 1000);
    });
    it("tomorrow adds 1 day", () => {
      const r = computeSnoozeUntil("tomorrow", from);
      expect(r).not.toBeNull();
      expect(r!.getDate()).toBe(13);
    });
    it("3d adds 3 days", () => {
      const r = computeSnoozeUntil("3d", from);
      expect(r).not.toBeNull();
      expect(r!.getDate()).toBe(15);
    });
    it("7d adds 7 days", () => {
      const r = computeSnoozeUntil("7d", from);
      expect(r).not.toBeNull();
      expect(r!.getDate()).toBe(19);
    });
    it("returns null for invalid from", () => {
      expect(computeSnoozeUntil("2h", new Date("invalid"))).toBeNull();
    });
  });
});
