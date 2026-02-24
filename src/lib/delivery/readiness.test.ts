import { describe, it, expect } from "vitest";
import {
  computeDeliveryCompletionReadiness,
  computeProjectHealth,
} from "./readiness";

describe("computeDeliveryCompletionReadiness", () => {
  it("can complete when all required done", () => {
    const r = computeDeliveryCompletionReadiness(
      { status: "in_progress" },
      [{ isRequired: true, isDone: true }],
      [{ status: "done" }]
    );
    expect(r.canComplete).toBe(true);
  });

  it("cannot complete when required checklist incomplete", () => {
    const r = computeDeliveryCompletionReadiness(
      { status: "in_progress" },
      [{ isRequired: true, isDone: false }],
      []
    );
    expect(r.canComplete).toBe(false);
    expect(r.reasons.some((x) => x.includes("checklist"))).toBe(true);
  });

  it("cannot complete when milestone blocked", () => {
    const r = computeDeliveryCompletionReadiness(
      { status: "in_progress" },
      [{ isRequired: true, isDone: true }],
      [{ status: "blocked" }]
    );
    expect(r.canComplete).toBe(false);
    expect(r.reasons.some((x) => x.includes("blocked"))).toBe(true);
  });

  it("force override allows completion", () => {
    const r = computeDeliveryCompletionReadiness(
      { status: "in_progress" },
      [{ isRequired: true, isDone: false }],
      [{ status: "blocked" }],
      { force: true }
    );
    expect(r.canComplete).toBe(true);
  });
});

describe("computeProjectHealth", () => {
  it("blocked status", () => {
    expect(computeProjectHealth({ status: "blocked" })).toBe("blocked");
  });

  it("overdue when due date passed", () => {
    const past = new Date();
    past.setDate(past.getDate() - 2);
    expect(computeProjectHealth({ status: "in_progress", dueDate: past })).toBe("overdue");
  });

  it("due_soon when within 3 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    expect(computeProjectHealth({ status: "in_progress", dueDate: soon })).toBe("due_soon");
  });

  it("on_track when due later", () => {
    const later = new Date();
    later.setDate(later.getDate() + 10);
    expect(computeProjectHealth({ status: "in_progress", dueDate: later })).toBe("on_track");
  });
});
