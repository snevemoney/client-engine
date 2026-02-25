import { describe, it, expect } from "vitest";
import { normalizePriority, priorityWeight, sortReminders } from "./priorities";

describe("reminders priorities", () => {
  describe("normalizePriority", () => {
    it("returns medium for empty", () => {
      expect(normalizePriority(null)).toBe("medium");
      expect(normalizePriority("")).toBe("medium");
    });
    it("returns valid for known values", () => {
      expect(normalizePriority("high")).toBe("high");
      expect(normalizePriority("critical")).toBe("critical");
      expect(normalizePriority("LOW")).toBe("low");
    });
    it("maps urgent to critical", () => {
      expect(normalizePriority("urgent")).toBe("critical");
    });
  });

  describe("priorityWeight", () => {
    it("returns correct weights", () => {
      expect(priorityWeight("critical")).toBe(4);
      expect(priorityWeight("high")).toBe(3);
      expect(priorityWeight("medium")).toBe(2);
      expect(priorityWeight("low")).toBe(1);
    });
  });

  describe("sortReminders", () => {
    it("sorts by priority then due date", () => {
      const items = [
        { priority: "low", dueAt: new Date(2025, 1, 15) },
        { priority: "high", dueAt: new Date(2025, 1, 20) },
        { priority: "medium", dueAt: new Date(2025, 1, 10) },
      ];
      const sorted = sortReminders(items);
      expect(sorted[0].priority).toBe("high");
      expect(sorted[1].priority).toBe("medium");
      expect(sorted[2].priority).toBe("low");
    });
  });
});
