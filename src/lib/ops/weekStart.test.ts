import { describe, it, expect } from "vitest";
import { getWeekStart } from "./weekStart";

describe("getWeekStart", () => {
  it("returns Monday 00:00 for a given date", () => {
    // Wed 2024-01-10 → Mon 2024-01-08
    const wed = new Date(2024, 0, 10, 14, 30, 0);
    const start = getWeekStart(wed);
    expect(start.getFullYear()).toBe(2024);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(8);
    expect(start.getDay()).toBe(1); // Monday
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("Monday returns same Monday", () => {
    const mon = new Date(2024, 0, 8, 9, 0, 0);
    const start = getWeekStart(mon);
    expect(start.getDate()).toBe(8);
    expect(start.getDay()).toBe(1);
  });

  it("Sunday returns previous Monday", () => {
    const sun = new Date(2024, 0, 14, 12, 0, 0);
    const start = getWeekStart(sun);
    expect(start.getDate()).toBe(8);
    expect(start.getDay()).toBe(1);
  });
});
