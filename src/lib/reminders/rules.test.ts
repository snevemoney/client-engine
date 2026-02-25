import { describe, it, expect } from "vitest";
import { generateReminderCandidates } from "./rules";
import type { ReminderRuleInput } from "./fetch-rule-input";

describe("reminders rules", () => {
  const baseInput: ReminderRuleInput = {
    now: new Date(2025, 1, 12, 12, 0, 0),
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
  };

  it("returns array for empty pipeline input", () => {
    const inputWithSnapshots: ReminderRuleInput = {
      ...baseInput,
      weeklyMetricSnapshot: { id: "x" },
      operatorScoreSnapshot: { id: "y" },
      forecastSnapshot: { id: "z" },
    };
    const r = generateReminderCandidates(inputWithSnapshots);
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(0);
  });

  it("generates proposal follow-up overdue", () => {
    const input: ReminderRuleInput = {
      ...baseInput,
      proposals: [
        {
          id: "p1",
          title: "Test",
          nextFollowUpAt: new Date(2025, 1, 11),
          sentAt: new Date(2025, 1, 1),
          respondedAt: null,
          staleAfterDays: 7,
        },
      ],
    };
    const r = generateReminderCandidates(input);
    expect(r.some((c) => c.kind === "proposal_followup" && c.createdByRule === "proposal_followup_overdue")).toBe(true);
  });

  it("generates proposal sent no follow-up", () => {
    const input: ReminderRuleInput = {
      ...baseInput,
      proposals: [
        {
          id: "p2",
          title: "Test",
          nextFollowUpAt: null,
          sentAt: new Date(2025, 1, 10),
          respondedAt: null,
          staleAfterDays: 7,
        },
      ],
    };
    const r = generateReminderCandidates(input);
    expect(r.some((c) => c.createdByRule === "proposal_sent_no_followup")).toBe(true);
  });

  it("generates won no proof", () => {
    const input: ReminderRuleInput = {
      ...baseInput,
      wonNoProof: [{ id: "l1", title: "Won" }],
    };
    const r = generateReminderCandidates(input);
    expect(r.some((c) => c.kind === "proof_gap" && c.createdByRule === "won_no_proof")).toBe(true);
  });

  it("generates proof ready pending", () => {
    const input: ReminderRuleInput = {
      ...baseInput,
      proofCandidatesReady: [{ id: "pc1", title: "Ready" }],
    };
    const r = generateReminderCandidates(input);
    expect(r.some((c) => c.createdByRule === "proof_ready_pending")).toBe(true);
  });

  it("each candidate has dedupeKey", () => {
    const input: ReminderRuleInput = {
      ...baseInput,
      wonNoProof: [{ id: "l1", title: "Won" }],
    };
    const r = generateReminderCandidates(input);
    for (const c of r) {
      expect(c.dedupeKey).toBeDefined();
      expect(typeof c.dedupeKey).toBe("string");
    }
  });

  it("no NaN in dueAt", () => {
    const input: ReminderRuleInput = {
      ...baseInput,
      completedNoHandoff: 1,
    };
    const r = generateReminderCandidates(input);
    for (const c of r) {
      if (c.dueAt) {
        expect(Number.isNaN(c.dueAt.getTime())).toBe(false);
      }
    }
  });
});
