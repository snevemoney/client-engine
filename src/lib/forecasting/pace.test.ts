import { describe, it, expect } from "vitest";
import {
  safePace,
  projectCount,
  projectValue,
  classifyConfidence,
  compareToTarget,
} from "./pace";

describe("pace helpers", () => {
  describe("safePace", () => {
    it("returns 0 for zero elapsed days", () => {
      expect(safePace(5, 0, 7)).toBe(0);
    });
    it("returns pace for valid input", () => {
      expect(safePace(3, 3, 7)).toBe(1);
    });
    it("returns 0 for invalid count", () => {
      expect(safePace(NaN, 3, 7)).toBe(0);
    });
    it("never returns NaN", () => {
      expect(Number.isNaN(safePace(0, 0, 0))).toBe(false);
    });
  });

  describe("projectCount", () => {
    it("projects linearly", () => {
      expect(projectCount(3, 3, 7)).toBe(7);
    });
    it("returns 0 for zero elapsed", () => {
      expect(projectCount(5, 0, 7)).toBe(0);
    });
    it("never returns NaN", () => {
      expect(Number.isNaN(projectCount(0, 0, 0))).toBe(false);
    });
  });

  describe("projectValue", () => {
    it("projects value linearly", () => {
      expect(projectValue(300, 3, 7)).toBe(700);
    });
    it("returns 0 for zero elapsed", () => {
      expect(projectValue(100, 0, 7)).toBe(0);
    });
  });

  describe("classifyConfidence", () => {
    it("returns low early in period", () => {
      expect(classifyConfidence(1, 7)).toBe("low");
    });
    it("returns medium mid-period", () => {
      expect(classifyConfidence(2, 7)).toBe("medium");
    });
    it("returns high when >50% elapsed and enough data", () => {
      expect(classifyConfidence(4, 7, 5)).toBe("high");
    });
  });

  describe("compareToTarget", () => {
    it("returns ahead when projected >= target", () => {
      expect(compareToTarget(110, 100).status).toBe("ahead");
    });
    it("returns behind when significantly under", () => {
      expect(compareToTarget(80, 100).status).toBe("behind");
    });
    it("returns on_track when null target", () => {
      expect(compareToTarget(50, null).status).toBe("on_track");
    });
    it("returns on_track when within 15%", () => {
      expect(compareToTarget(90, 100).status).toBe("on_track");
    });
  });
});
