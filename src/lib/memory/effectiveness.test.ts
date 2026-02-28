/**
 * Phase 7.3: Effectiveness unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { effectivenessBoost } from "./effectiveness";

vi.mock("@/lib/db", () => ({
  db: {
    operatorAttribution: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe("effectiveness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("effectivenessBoost", () => {
    it("clamps to -6..+6", () => {
      expect(effectivenessBoost(10)).toBe(6);
      expect(effectivenessBoost(-10)).toBe(-6);
      expect(effectivenessBoost(3)).toBe(3);
      expect(effectivenessBoost(-2)).toBe(-2);
    });
  });
});
