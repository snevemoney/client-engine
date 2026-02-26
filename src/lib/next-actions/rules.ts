/**
 * Phase 4.0: Next Best Action rules.
 * Deterministic ranking. No LLM yet.
 */

import { NextActionPriority, RiskSourceType } from "@prisma/client";
import type { NextActionCandidate } from "./types";
import type { NextActionContext } from "./types";

const PRIORITY_BASE: Record<NextActionPriority, number> = {
  critical: 90,
  high: 75,
  medium: 55,
  low: 30,
};

function scoreFor(c: NextActionCandidate): number {
  let s = PRIORITY_BASE[c.priority];
  s += Math.min(10, c.countBoost ?? 0);
  s += Math.min(10, c.recencyBoost ?? 0);
  return Math.max(0, Math.min(100, Math.round(s)));
}

export function produceNextActions(ctx: NextActionContext): NextActionCandidate[] {
  const out: NextActionCandidate[] = [];

  function addScore(
    c: Omit<NextActionCandidate, "score"> & { countBoost?: number; recencyBoost?: number }
  ): NextActionCandidate {
    return { ...c, score: scoreFor({ ...c, score: 0 }) };
  }

  // 1) Critical score band => investigate
  if (ctx.commandCenterBand === "critical") {
    out.push(
      addScore({
        title: "Investigate top score reasons",
        reason: "Command center score in critical band",
        priority: NextActionPriority.critical,
        sourceType: RiskSourceType.score,
        sourceId: "command_center",
        actionUrl: "/dashboard/internal/scoreboard",
        payloadJson: { entityType: "command_center" },
        createdByRule: "score_in_critical_band",
        dedupeKey: "nba:score_in_critical_band:command_center",
      })
    );
  }

  // 2) Failed deliveries => retry
  if (ctx.failedDeliveryCount > 0) {
    out.push(
      addScore({
        title: "Retry failed deliveries",
        reason: `${ctx.failedDeliveryCount} delivery attempt(s) failed`,
        priority: NextActionPriority.high,
        sourceType: RiskSourceType.notification_event,
        sourceId: null,
        actionUrl: "/dashboard/notifications?filter=failed",
        payloadJson: { action: "retry_failed" },
        createdByRule: "failed_notification_deliveries",
        dedupeKey: "nba:failed_notification_deliveries:system",
        countBoost: Math.min(10, ctx.failedDeliveryCount),
      })
    );
  }

  // 3) Overdue reminders
  if (ctx.overdueRemindersCount > 0) {
    out.push(
      addScore({
        title: "Clear overdue reminders",
        reason: `${ctx.overdueRemindersCount} reminder(s) overdue`,
        priority: NextActionPriority.medium,
        sourceType: RiskSourceType.reminder,
        sourceId: null,
        actionUrl: "/dashboard/reminders?bucket=overdue",
        payloadJson: { bucket: "overdue" },
        createdByRule: "overdue_reminders_high_priority",
        dedupeKey: "nba:overdue_reminders_high_priority:system",
        countBoost: Math.min(10, ctx.overdueRemindersCount),
      })
    );
  }

  // 4) Proposals sent, no followup date
  if (ctx.sentNoFollowupDateCount > 0) {
    out.push(
      addScore({
        title: "Schedule follow-up dates",
        reason: `${ctx.sentNoFollowupDateCount} proposal(s) need follow-up date`,
        priority: NextActionPriority.medium,
        sourceType: RiskSourceType.proposal,
        sourceId: null,
        actionUrl: "/dashboard/proposal-followups?bucket=no_followup",
        payloadJson: { bucket: "no_followup" },
        createdByRule: "proposals_sent_no_followup_date",
        dedupeKey: "nba:proposals_sent_no_followup_date:system",
        countBoost: Math.min(10, ctx.sentNoFollowupDateCount),
      })
    );
  }

  // 5) Retention overdue
  if (ctx.retentionOverdueCount > 0) {
    out.push(
      addScore({
        title: "Contact retention clients",
        reason: `${ctx.retentionOverdueCount} retention task(s) overdue`,
        priority: ctx.retentionOverdueCount >= 3 ? NextActionPriority.high : NextActionPriority.medium,
        sourceType: RiskSourceType.delivery_project,
        sourceId: null,
        actionUrl: "/dashboard/retention?bucket=overdue",
        payloadJson: { bucket: "overdue" },
        createdByRule: "retention_overdue",
        dedupeKey: "nba:retention_overdue:system",
        countBoost: Math.min(10, ctx.retentionOverdueCount),
      })
    );
  }

  // 6) Handoff missing client confirm
  if (ctx.handoffNoClientConfirmCount > 0) {
    out.push(
      addScore({
        title: "Request client confirmation",
        reason: `${ctx.handoffNoClientConfirmCount} handoff(s) awaiting client confirm`,
        priority: NextActionPriority.medium,
        sourceType: RiskSourceType.delivery_project,
        sourceId: null,
        actionUrl: "/dashboard/handoffs?bucket=awaiting_confirm",
        payloadJson: { bucket: "awaiting_confirm" },
        createdByRule: "handoff_no_client_confirm",
        dedupeKey: "nba:handoff_no_client_confirm:system",
        countBoost: Math.min(10, ctx.handoffNoClientConfirmCount),
      })
    );
  }

  // 7) Won deals without delivery project (flywheel gap)
  if (ctx.wonNoDeliveryCount > 0) {
    out.push(
      addScore({
        title: "Create delivery projects for won deals",
        reason: `${ctx.wonNoDeliveryCount} won deal(s) have no delivery project`,
        priority: NextActionPriority.high,
        sourceType: RiskSourceType.intake_lead,
        sourceId: null,
        actionUrl: "/dashboard/delivery/new",
        payloadJson: { gap: "won_no_delivery" },
        createdByRule: "flywheel_won_no_delivery",
        dedupeKey: "nba:flywheel_won_no_delivery:system",
        countBoost: Math.min(10, ctx.wonNoDeliveryCount * 3),
      })
    );
  }

  // 8) Won deals without referral ask (flywheel gap)
  if (ctx.referralGapCount > 0) {
    out.push(
      addScore({
        title: "Ask for referrals on won deals",
        reason: `${ctx.referralGapCount} won deal(s) — referral not requested`,
        priority: NextActionPriority.medium,
        sourceType: RiskSourceType.intake_lead,
        sourceId: null,
        actionUrl: "/dashboard/leads",
        payloadJson: { gap: "referral_not_asked" },
        createdByRule: "flywheel_referral_gap",
        dedupeKey: "nba:flywheel_referral_gap:system",
        countBoost: Math.min(10, ctx.referralGapCount * 2),
      })
    );
  }

  // 9) Active leads going cold (flywheel gap)
  if (ctx.stageStallCount > 0) {
    out.push(
      addScore({
        title: "Re-engage stalled leads",
        reason: `${ctx.stageStallCount} active lead(s) with no contact 10+ days`,
        priority: ctx.stageStallCount >= 3 ? NextActionPriority.high : NextActionPriority.medium,
        sourceType: RiskSourceType.intake_lead,
        sourceId: null,
        actionUrl: "/dashboard/leads",
        payloadJson: { gap: "stage_stall" },
        createdByRule: "flywheel_stage_stall",
        dedupeKey: "nba:flywheel_stage_stall:system",
        countBoost: Math.min(10, ctx.stageStallCount * 2),
      })
    );
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}
