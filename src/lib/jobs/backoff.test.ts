/**
 * Phase 2.8.4: Backoff tests.
 */
import { describe, it, expect } from "vitest";
import { backoffMs, nextRunAfter } from "./backoff";

describe("backoff", () => {
  it("returns 30s for attempt 1", () => {
    expect(backoffMs(1)).toBe(30_000);
  });

  it("returns 2m for attempt 2", () => {
    expect(backoffMs(2)).toBe(120_000);
  });

  it("returns 10m for attempt 3", () => {
    expect(backoffMs(3)).toBe(600_000);
  });

  it("returns 10m for attempt 4+ (capped)", () => {
    expect(backoffMs(4)).toBe(600_000);
    expect(backoffMs(10)).toBe(600_000);
  });

  it("returns 30s for attempt 0 (edge case)", () => {
    expect(backoffMs(0)).toBe(30_000);
  });

  it("nextRunAfter returns future date", () => {
    const before = Date.now();
    const after = nextRunAfter(1).getTime();
    expect(after).toBeGreaterThanOrEqual(before + 29_000);
    expect(after).toBeLessThanOrEqual(before + 31_000);
  });
});
