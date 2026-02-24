import { describe, it, expect } from "vitest";
import { computePipelineSyncUpdates } from "./pipeline-sync";

describe("computePipelineSyncUpdates", () => {
  it("safe field sync", () => {
    const intake = {
      title: "New title",
      company: "Acme",
      contactName: "Jane",
      contactEmail: "j@acme.com",
      summary: "We need X",
      nextAction: "Call back",
      nextActionDueAt: "2025-02-25T12:00:00Z" as unknown as Date,
      budgetMin: 1000,
      budgetMax: 2000,
    };
    const lead = {
      id: "lead1",
      title: "Old",
      description: "Old desc",
      contactName: null,
      contactEmail: null,
      nextAction: null,
      nextActionDueAt: null,
      budget: null,
      proposalSentAt: null,
      buildStartedAt: null,
      buildCompletedAt: null,
    };
    const { updates, changedFields } = computePipelineSyncUpdates(intake, lead);
    expect(updates.title).toBe("New title");
    expect(updates.description).toBe("We need X");
    expect(updates.contactName).toBe("Jane");
    expect(updates.nextAction).toBe("Call back");
    expect(changedFields).toContain("title");
    expect(changedFields).toContain("description");
  });

  it("does not overwrite advanced pipeline fields", () => {
    const intake = {
      title: "New title",
      summary: "New summary",
    };
    const lead = {
      id: "lead1",
      title: "Advanced",
      description: "Has proposal",
      nextAction: null,
      nextActionDueAt: null,
      nextContactAt: null,
      proposalSentAt: new Date("2025-02-20"),
      buildStartedAt: null,
      buildCompletedAt: null,
      contactName: null,
      contactEmail: null,
      budget: null,
    };
    const { updates } = computePipelineSyncUpdates(intake, lead);
    expect(updates.title).toBeUndefined();
    expect(updates.description).toBeUndefined();
    expect(updates.contactName).toBeUndefined();
  });

  it("nextActionDueAt maps correctly", () => {
    const intake = {
      nextActionDueAt: "2025-02-28T14:00:00Z",
    };
    const lead = {
      id: "lead1",
      nextAction: null,
      nextActionDueAt: null,
      nextContactAt: null,
      proposalSentAt: null,
      buildStartedAt: null,
      buildCompletedAt: null,
      contactName: null,
      contactEmail: null,
      budget: null,
      title: null,
      description: null,
    };
    const { updates, changedFields } = computePipelineSyncUpdates(intake, lead);
    expect(changedFields).toContain("nextActionDueAt");
    expect(updates.nextActionDueAt).toBeDefined();
    expect(updates.nextContactAt).toBeDefined();
  });
});
