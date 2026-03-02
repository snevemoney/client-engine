import { describe, it, expect } from "vitest";
import { produceNextActions } from "./rules";
import type { NextActionContext } from "./types";

const baseCtx: NextActionContext = {
  now: new Date(2025, 1, 15),
  commandCenterBand: null,
  failedDeliveryCount: 0,
  overdueRemindersCount: 0,
  sentNoFollowupDateCount: 0,
  retentionOverdueCount: 0,
  handoffNoClientConfirmCount: 0,
  wonNoDeliveryCount: 0,
  referralGapCount: 0,
  stageStallCount: 0,
  builderPoorQualityCount: 0,
  proposalOverdueFollowupCount: 0,
  interactionsWithoutNextActionCount: 0,
  clientInteractionGapCount: 0,
};

describe("next-actions rules", () => {
  it("returns empty array for zero context", () => {
    const out = produceNextActions(baseCtx);
    expect(out).toEqual([]);
  });

  it("emits score_in_critical_band when commandCenterBand is critical", () => {
    const out = produceNextActions({
      ...baseCtx,
      commandCenterBand: "critical",
    });
    expect(out.length).toBe(1);
    expect(out[0].createdByRule).toBe("score_in_critical_band");
    expect(out[0].priority).toBe("critical");
    expect(out[0].dedupeKey).toBe("nba:score_in_critical_band:command_center");
  });

  it("emits failed_notification_deliveries when count > 0", () => {
    const out = produceNextActions({
      ...baseCtx,
      failedDeliveryCount: 2,
    });
    expect(out.length).toBe(1);
    expect(out[0].createdByRule).toBe("failed_notification_deliveries");
    expect(out[0].priority).toBe("high");
    expect(out[0].countBoost).toBe(2);
  });

  it("emits overdue_reminders_high_priority when count > 0", () => {
    const out = produceNextActions({
      ...baseCtx,
      overdueRemindersCount: 5,
    });
    expect(out.length).toBe(1);
    expect(out[0].createdByRule).toBe("overdue_reminders_high_priority");
    expect(out[0].priority).toBe("medium");
  });

  it("emits proposals_sent_no_followup_date when count > 0", () => {
    const out = produceNextActions({
      ...baseCtx,
      sentNoFollowupDateCount: 3,
    });
    expect(out.some((a) => a.createdByRule === "proposals_sent_no_followup_date")).toBe(true);
    // Also emits proposal_batch_review_due when sentNoFollowupDateCount >= 2
    expect(out.some((a) => a.createdByRule === "proposal_batch_review_due")).toBe(true);
  });

  it("emits retention_overdue with priority based on count", () => {
    const low = produceNextActions({
      ...baseCtx,
      retentionOverdueCount: 2,
    });
    expect(low[0].priority).toBe("medium");

    const high = produceNextActions({
      ...baseCtx,
      retentionOverdueCount: 5,
    });
    expect(high[0].priority).toBe("high");
  });

  it("emits handoff_no_client_confirm when count > 0", () => {
    const out = produceNextActions({
      ...baseCtx,
      handoffNoClientConfirmCount: 1,
    });
    expect(out.length).toBe(1);
    expect(out[0].createdByRule).toBe("handoff_no_client_confirm");
  });

  it("ranks by score: critical > high > medium > low", () => {
    const out = produceNextActions({
      ...baseCtx,
      commandCenterBand: "critical",
      failedDeliveryCount: 1,
      overdueRemindersCount: 1,
    });
    expect(out.length).toBe(3);
    expect(out[0].priority).toBe("critical");
    expect(out[1].priority).toBe("high");
    expect(out[2].priority).toBe("medium");
    expect(out[0].score).toBeGreaterThanOrEqual(out[1].score);
    expect(out[1].score).toBeGreaterThanOrEqual(out[2].score);
  });

  it("attaches score to each candidate", () => {
    const out = produceNextActions({
      ...baseCtx,
      commandCenterBand: "critical",
    });
    expect(out[0].score).toBeGreaterThanOrEqual(0);
    expect(out[0].score).toBeLessThanOrEqual(100);
  });

  it("emits builder_content_quality_poor when count > 0", () => {
    const out = produceNextActions({
      ...baseCtx,
      builderPoorQualityCount: 2,
      builderPoorQualityProjectId: "proj_123",
    });
    expect(out.length).toBe(1);
    expect(out[0].createdByRule).toBe("builder_content_quality_poor");
    expect(out[0].priority).toBe("medium");
    expect(out[0].actionUrl).toContain("proj_123");
  });

  describe("client interaction ledger rules (Phase 9.2)", () => {
    it("emits client_no_next_action when count > 0", () => {
      const out = produceNextActions({
        ...baseCtx,
        interactionsWithoutNextActionCount: 4,
      });
      const rule = out.find((a) => a.createdByRule === "client_no_next_action");
      expect(rule).toBeDefined();
      expect(rule!.priority).toBe("high");
    });

    it("emits client_interaction_gap when count > 0", () => {
      const out = produceNextActions({
        ...baseCtx,
        clientInteractionGapCount: 2,
      });
      const rule = out.find((a) => a.createdByRule === "client_interaction_gap");
      expect(rule).toBeDefined();
      expect(rule!.priority).toBe("medium");
    });

    it("escalates client_interaction_gap to high when count >= 3", () => {
      const out = produceNextActions({
        ...baseCtx,
        clientInteractionGapCount: 3,
      });
      const rule = out.find((a) => a.createdByRule === "client_interaction_gap");
      expect(rule).toBeDefined();
      expect(rule!.priority).toBe("high");
    });

    it("appears in review_stream scope", () => {
      const out = produceNextActions(
        { ...baseCtx, interactionsWithoutNextActionCount: 2 },
        "review_stream"
      );
      expect(out.some((a) => a.createdByRule === "client_no_next_action")).toBe(true);
    });
  });

  describe("founder_growth scope (Phase 6.3)", () => {
    it("emits growth_overdue_followups when count > 0", () => {
      const out = produceNextActions(
        { ...baseCtx, growthOverdueCount: 2 },
        "founder_growth"
      );
      expect(out.some((a) => a.createdByRule === "growth_overdue_followups")).toBe(true);
      const r = out.find((a) => a.createdByRule === "growth_overdue_followups");
      expect(r?.entityType).toBe("founder_growth");
      expect(r?.priority).toBe("medium");
    });

    it("emits growth_no_outreach_sent when count > 0", () => {
      const out = produceNextActions(
        { ...baseCtx, growthNoOutreachCount: 3 },
        "founder_growth"
      );
      expect(out.some((a) => a.createdByRule === "growth_no_outreach_sent")).toBe(true);
    });

    it("does not emit growth rules for command_center scope", () => {
      const out = produceNextActions(
        { ...baseCtx, growthOverdueCount: 2, growthNoOutreachCount: 1 },
        "command_center"
      );
      expect(out.every((a) => !a.createdByRule.startsWith("growth_"))).toBe(true);
    });
  });
});
