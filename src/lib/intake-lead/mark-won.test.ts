/**
 * Unit tests for mark-won proof creation logic (no DB).
 */
import { describe, it, expect } from "vitest";

function buildProofSnippet(summary: string | null, scoreReason: string | null): string {
  const parts = [summary, scoreReason]
    .filter(Boolean)
    .map((s) => (s && s.length > 200 ? s.slice(0, 200) + "…" : s));
  return parts.join(". ") || "Won opportunity. Add proof snippet.";
}

describe("mark-won proof snippet", () => {
  it("combines summary and scoreReason", () => {
    const r = buildProofSnippet("We need a funnel.", "Fit keywords: automation");
    expect(r).toContain("funnel");
    expect(r).toContain("automation");
  });

  it("truncates long summary", () => {
    const long = "x".repeat(250);
    const r = buildProofSnippet(long, null);
    expect(r.length).toBeLessThanOrEqual(210);
    expect(r).toContain("…");
  });

  it("returns fallback when empty", () => {
    const r = buildProofSnippet(null, null);
    expect(r).toBe("Won opportunity. Add proof snippet.");
  });

  it("handles null safely", () => {
    expect(buildProofSnippet(null, "x")).toContain("x");
    expect(buildProofSnippet("x", null)).toContain("x");
  });
});
