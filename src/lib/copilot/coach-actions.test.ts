/**
 * Phase 5.2: Coach actions unit tests.
 */
import { describe, it, expect } from "vitest";
import { buildPreview, summarizeDiff, type CoachActionInput, type ContextSnapshot } from "./coach-actions";

describe("coach-actions", () => {
  it("buildPreview for run_risk_rules returns steps and summary", () => {
    const input: CoachActionInput = {
      actionKey: "run_risk_rules",
      mode: "preview",
      entityType: "command_center",
      entityId: "command_center",
    };
    const before: ContextSnapshot = {
      score: "Score 72 (healthy)",
      risk: "Open: 0 critical/high",
      nba: "Queued: 2",
    };

    const preview = buildPreview(input.actionKey, input, before);

    expect(preview.summary).toContain("risk rules");
    expect(preview.steps.length).toBeGreaterThan(0);
  });

  it("buildPreview for nba_execute without nextActionId returns warnings", () => {
    const input: CoachActionInput = {
      actionKey: "nba_execute",
      mode: "preview",
      entityType: "command_center",
      entityId: "command_center",
    };
    const before: ContextSnapshot = {
      score: "Score 72",
      risk: "Open: 0",
      nba: "Queued: 2",
    };

    const preview = buildPreview(input.actionKey, input, before);

    expect(preview.warnings.length).toBeGreaterThan(0);
    expect(preview.summary).toContain("Missing");
  });

  it("buildPreview for nba_execute with nextActionId returns reversible info", () => {
    const input: CoachActionInput = {
      actionKey: "nba_execute",
      mode: "preview",
      entityType: "command_center",
      entityId: "command_center",
      nextActionId: "nba-1",
      nbaActionKey: "snooze_1d",
    };
    const before: ContextSnapshot = {
      score: "Score 72",
      risk: "Open: 0",
      nba: "Queued: 2",
    };

    const preview = buildPreview(input.actionKey, input, before);

    expect(preview.summary).toContain("snooze_1d");
    expect(preview.summary).toContain("Reversible");
  });

  it("summarizeDiff returns before→after when values change", () => {
    const before: ContextSnapshot = {
      score: "Score 72 (healthy)",
      risk: "Open: 2 critical/high",
      nba: "Queued: 5",
    };
    const after: ContextSnapshot = {
      score: "Score 72 (healthy)",
      risk: "Open: 0 critical/high",
      nba: "Queued: 3",
    };

    const summary = summarizeDiff(before, after);

    expect(summary).toContain("Risks:");
    expect(summary).toContain("NBA:");
    expect(summary).toContain("→");
  });

  it("summarizeDiff returns no change when identical", () => {
    const snap: ContextSnapshot = {
      score: "Score 72",
      risk: "Open: 0",
      nba: "Queued: 2",
    };

    const summary = summarizeDiff(snap, snap);

    expect(summary).toContain("No visible change");
  });
});
