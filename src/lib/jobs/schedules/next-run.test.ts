/**
 * Phase 2.8.5: next-run tests.
 */
import { describe, it, expect, vi } from "vitest";
import { computeNextRunAt } from "./next-run";

describe("computeNextRunAt", () => {
  it("interval: adds minutes", () => {
    const from = new Date("2025-02-22T10:00:00Z");
    const next = computeNextRunAt({ cadenceType: "interval", intervalMinutes: 30 }, from);
    expect(next?.getTime()).toBe(from.getTime() + 30 * 60 * 1000);
  });

  it("daily: same time next day if past", () => {
    const from = new Date("2025-02-22T23:30:00Z");
    const next = computeNextRunAt({ cadenceType: "daily", hour: 9, minute: 0 }, from);
    expect(next?.getHours()).toBe(9);
    expect(next?.getMinutes()).toBe(0);
    expect(next?.getTime()).toBeGreaterThan(from.getTime());
  });

  it("daily: same day if before target", () => {
    const from = new Date("2025-02-22T08:00:00Z");
    const next = computeNextRunAt({ cadenceType: "daily", hour: 9, minute: 30 }, from);
    expect(next?.getHours()).toBe(9);
    expect(next?.getMinutes()).toBe(30);
    expect(next?.getDate()).toBe(22);
  });

  it("weekly: correct day of week", () => {
    const from = new Date("2025-02-22T10:00:00Z"); // Saturday
    const next = computeNextRunAt({ cadenceType: "weekly", dayOfWeek: 1, hour: 9, minute: 0 }, from);
    expect(next?.getDay()).toBe(1); // Monday
    expect(next?.getHours()).toBe(9);
  });

  it("monthly: clamps day 31 to short months", () => {
    const from = new Date("2025-02-01T10:00:00Z");
    const next = computeNextRunAt({ cadenceType: "monthly", dayOfMonth: 31, hour: 9, minute: 0 }, from);
    expect(next?.getMonth()).toBe(1);
    expect(next?.getDate()).toBe(28);
  });

  it("monthly: day 15 in same month if before", () => {
    const from = new Date("2025-02-10T08:00:00Z");
    const next = computeNextRunAt({ cadenceType: "monthly", dayOfMonth: 15, hour: 9, minute: 0 }, from);
    expect(next?.getDate()).toBe(15);
    expect(next?.getMonth()).toBe(1);
  });

  it("returns null for invalid interval", () => {
    const next = computeNextRunAt({ cadenceType: "interval", intervalMinutes: 0 }, new Date());
    expect(next).toBeNull();
  });
});
