import { describe, it, expect } from "vitest";
import { computeHandoffReadiness } from "./handoff-readiness";

describe("computeHandoffReadiness", () => {
  it("returns not ready when project is blocked", () => {
    const result = computeHandoffReadiness(
      { status: "blocked", completedAt: new Date() },
      []
    );
    expect(result.isReadyForHandoff).toBe(false);
    expect(result.reasons).toContain("Project is blocked");
  });

  it("returns not ready when project is not completed or archived", () => {
    const result = computeHandoffReadiness(
      { status: "in_progress", completedAt: null },
      []
    );
    expect(result.isReadyForHandoff).toBe(false);
    expect(result.reasons).toContain("Project must be completed or archived before handoff");
  });

  it("returns ready when completed with empty checklist", () => {
    const result = computeHandoffReadiness(
      { status: "completed", completedAt: new Date() },
      []
    );
    expect(result.isReadyForHandoff).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("returns ready when archived", () => {
    const result = computeHandoffReadiness(
      { status: "archived", completedAt: new Date() },
      []
    );
    expect(result.isReadyForHandoff).toBe(true);
  });

  it("adds warning when required checklist incomplete", () => {
    const result = computeHandoffReadiness(
      { status: "completed", completedAt: new Date() },
      [
        { isRequired: true, isDone: false },
        { isRequired: true, isDone: true },
      ]
    );
    expect(result.isReadyForHandoff).toBe(true);
    expect(result.warnings).toContain("1 required checklist item(s) incomplete");
  });

  it("adds warning when no completion date", () => {
    const result = computeHandoffReadiness(
      { status: "completed", completedAt: null },
      []
    );
    expect(result.isReadyForHandoff).toBe(true);
    expect(result.warnings).toContain("No completion date set");
  });
});
