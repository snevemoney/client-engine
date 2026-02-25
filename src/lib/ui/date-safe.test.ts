import { describe, it, expect } from "vitest";
import { formatDateSafe, formatDateTimeSafe } from "./date-safe";

describe("date-safe", () => {
  describe("formatDateSafe", () => {
    it("formats valid date string", () => {
      const out = formatDateSafe("2025-02-22");
      expect(out).not.toBe("—");
      expect(out).toMatch(/Feb|2|22|2025/);
    });
    it("formats valid Date", () => {
      const out = formatDateSafe(new Date("2025-02-22"));
      expect(out).not.toBe("—");
    });
    it("returns — for null/undefined", () => {
      expect(formatDateSafe(null)).toBe("—");
      expect(formatDateSafe(undefined)).toBe("—");
    });
    it("returns — for invalid date", () => {
      expect(formatDateSafe("invalid")).toBe("—");
      expect(formatDateSafe(new Date("invalid"))).toBe("—");
    });
  });

  describe("formatDateTimeSafe", () => {
    it("formats valid date", () => {
      const out = formatDateTimeSafe("2025-02-22T14:30:00Z");
      expect(out).not.toBe("—");
    });
    it("returns — for invalid", () => {
      expect(formatDateTimeSafe("invalid")).toBe("—");
      expect(formatDateTimeSafe(null)).toBe("—");
    });
  });
});
