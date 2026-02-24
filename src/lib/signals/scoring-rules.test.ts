import { describe, it, expect } from "vitest";
import { scoreSignalItem } from "./scoring-rules";

describe("scoreSignalItem", () => {
  it("returns 0 and empty tags for no keyword match", () => {
    const { score, tags } = scoreSignalItem("Random article about weather", null);
    expect(score).toBe(0);
    expect(tags).toEqual([]);
  });

  it("matches single keyword and adds tag", () => {
    const { score, tags } = scoreSignalItem("Hiring trends in 2025", null);
    expect(score).toBeGreaterThan(0);
    expect(tags).toContain("hiring");
  });

  it("matches multiple keywords and accumulates score", () => {
    const { score, tags } = scoreSignalItem(
      "AI hiring automation for marketing",
      "Budget and revenue growth"
    );
    expect(score).toBeGreaterThan(15);
    expect(tags).toContain("ai");
    expect(tags).toContain("hiring");
  });

  it("caps score at 100", () => {
    const text = "hiring budget ads marketing automation ai lead sales";
    const { score } = scoreSignalItem(text, text);
    expect(score).toBeLessThanOrEqual(100);
  });
});
