import { describe, it, expect } from "vitest";
import { evaluateRiskRules } from "./rules";
import type { RiskRuleContext } from "./types";

const baseCtx: RiskRuleContext = {
  now: new Date(2025, 1, 15),
  failedDeliveryCount24h: 0,
  staleRunningJobsCount: 0,
  overdueRemindersHighCount: 0,
  commandCenterBand: null,
  proposalFollowupOverdueCount: 0,
  retentionOverdueCount: 0,
};

describe("risk rules", () => {
  it("returns empty array for zero context", () => {
    const out = evaluateRiskRules(baseCtx);
    expect(out).toEqual([]);
  });

  it("emits critical_notifications_failed_delivery when failedDeliveryCount24h >= 3", () => {
    const out = evaluateRiskRules({
      ...baseCtx,
      failedDeliveryCount24h: 3,
    });
    expect(out.length).toBe(1);
    expect(out[0].createdByRule).toBe("critical_notifications_failed_delivery");
    expect(out[0].severity).toBe("critical");
    expect(out[0].title).toMatch(/Failed notification deliveries/i);
  });

  it("emits stale_running_jobs when count >= 1", () => {
    const out = evaluateRiskRules({
      ...baseCtx,
      staleRunningJobsCount: 2,
    });
    expect(out.length).toBe(1);
    expect(out[0].createdByRule).toBe("stale_running_jobs");
    expect(out[0].severity).toBe("high");
  });

  it("emits overdue_reminders_high_priority when count > 0", () => {
    const out = evaluateRiskRules({
      ...baseCtx,
      overdueRemindersHighCount: 1,
    });
    expect(out.length).toBe(1);
    expect(out[0].createdByRule).toBe("overdue_reminders_high_priority");
    expect(out[0].severity).toBe("high");
  });

  it("emits score_in_critical_band when commandCenterBand is critical", () => {
    const out = evaluateRiskRules({
      ...baseCtx,
      commandCenterBand: "critical",
    });
    expect(out.length).toBe(1);
    expect(out[0].createdByRule).toBe("score_in_critical_band");
    expect(out[0].severity).toBe("critical");
    expect(out[0].sourceId).toBe("command_center");
  });

  it("emits proposal_followups_overdue with severity based on count", () => {
    const low = evaluateRiskRules({
      ...baseCtx,
      proposalFollowupOverdueCount: 2,
    });
    expect(low.length).toBe(1);
    expect(low[0].severity).toBe("medium");

    const high = evaluateRiskRules({
      ...baseCtx,
      proposalFollowupOverdueCount: 5,
    });
    expect(high.length).toBe(1);
    expect(high[0].severity).toBe("high");
  });

  it("emits retention_overdue with severity based on count", () => {
    const low = evaluateRiskRules({
      ...baseCtx,
      retentionOverdueCount: 2,
    });
    expect(low.length).toBe(1);
    expect(low[0].severity).toBe("medium");

    const high = evaluateRiskRules({
      ...baseCtx,
      retentionOverdueCount: 3,
    });
    expect(high.length).toBe(1);
    expect(high[0].severity).toBe("high");
  });

  it("adds dedupeKey to each candidate", () => {
    const out = evaluateRiskRules({
      ...baseCtx,
      failedDeliveryCount24h: 5,
    });
    expect(out[0].dedupeKey).toMatch(/^risk:/);
    expect(out[0].dedupeKey).toContain(out[0].createdByRule);
  });

  it("emits multiple risks when multiple conditions met", () => {
    const out = evaluateRiskRules({
      ...baseCtx,
      failedDeliveryCount24h: 4,
      staleRunningJobsCount: 1,
      commandCenterBand: "critical",
    });
    expect(out.length).toBe(3);
    const rules = out.map((r) => r.createdByRule);
    expect(rules).toContain("critical_notifications_failed_delivery");
    expect(rules).toContain("stale_running_jobs");
    expect(rules).toContain("score_in_critical_band");
  });
});
