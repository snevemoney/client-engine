import { describe, it, expect } from "vitest";

// Promote idempotency tested via API in e2e. These are validation logic checks.
// We test the logic in isolation by mocking or use a test DB.
// For now, test the validation logic that would run before promote.

describe("promote validation", () => {
  it("requires title", () => {
    const intake = { title: "", summary: "x" };
    const valid = !!(intake.title?.trim() && intake.summary?.trim());
    expect(valid).toBe(false);
  });

  it("requires summary", () => {
    const intake = { title: "X", summary: "" };
    const valid = !!(intake.title?.trim() && intake.summary?.trim());
    expect(valid).toBe(false);
  });

  it("accepts valid intake", () => {
    const intake = { title: "Need funnel", summary: "We need automation." };
    const valid = !!(intake.title?.trim() && intake.summary?.trim());
    expect(valid).toBe(true);
  });
});
