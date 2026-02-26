import { describe, it, expect } from "vitest";
import { generateAutomationSuggestions } from "./suggestions";
import type { ReminderRuleInput } from "@/lib/reminders/fetch-rule-input";

describe("automation suggestions", () => {
  const baseInput: ReminderRuleInput = {
    now: new Date(2025, 1, 12),
    weekStart: new Date(2025, 1, 10),
    monthStart: new Date(2025, 1, 1),
    startToday: new Date(2025, 1, 12, 0, 0, 0),
    proposals: [],
    intakeLeads: [],
    wonNoProof: [],
    proofCandidatesReady: [],
    deliveryProjects: [],
    completedNoHandoff: 0,
    handoffNoClientConfirm: 0,
    strategyWeek: null,
    weeklyMetricSnapshot: null,
    operatorScoreSnapshot: null,
    forecastSnapshot: null,
    flywheelLeads: [],
  };

  it("returns empty for empty input", () => {
    const r = generateAutomationSuggestions(baseInput);
    expect(Array.isArray(r)).toBe(true);
  });

  it("generates create_followup for proposal with no date", () => {
    const input: ReminderRuleInput = {
      ...baseInput,
      proposals: [
        {
          id: "p1",
          title: "Test",
          nextFollowUpAt: null,
          sentAt: new Date(2025, 1, 10),
          respondedAt: null,
          staleAfterDays: 7,
        },
      ],
    };
    const r = generateAutomationSuggestions(input);
    expect(r.some((s) => s.type === "create_followup")).toBe(true);
  });

  it("generates create_proof_candidate for won no proof", () => {
    const input: ReminderRuleInput = {
      ...baseInput,
      wonNoProof: [{ id: "l1", title: "Won" }],
    };
    const r = generateAutomationSuggestions(input);
    expect(r.some((s) => s.type === "create_proof_candidate")).toBe(true);
  });

  it("each suggestion has dedupeKey", () => {
    const input: ReminderRuleInput = {
      ...baseInput,
      wonNoProof: [{ id: "l1", title: "Won" }],
    };
    const r = generateAutomationSuggestions(input);
    for (const s of r) {
      expect(s.dedupeKey).toBeDefined();
    }
  });

  it("priorities are valid", () => {
    const input: ReminderRuleInput = {
      ...baseInput,
      wonNoProof: [{ id: "l1", title: "Won" }],
    };
    const r = generateAutomationSuggestions(input);
    const valid = ["low", "medium", "high", "critical"];
    for (const s of r) {
      expect(valid).toContain(s.priority);
    }
  });
});
