/**
 * Phase 4.0/4.1: Next Best Action rules.
 * Deterministic ranking. Per-scope. Structured explanations.
 */

import { NextActionPriority, RiskSourceType } from "@prisma/client";
import type { NextActionCandidate } from "./types";
import type { NextActionContext } from "./types";
import { RULE_SCOPES } from "./scope";
import { buildNextActionExplanation } from "./explanations";
import { rankNextActions, type LearnedWeightsParam, type EffectivenessByRuleKey } from "./ranking";
import type { NBAScope } from "./scope";

function makeCandidate(
  scope: NBAScope,
  c: Omit<NextActionCandidate, "score" | "dedupeKey" | "entityType" | "entityId" | "explanationJson"> & {
    countBoost?: number;
    recencyBoost?: number;
    createdByRule: string;
  },
  ctx: NextActionContext
): Omit<NextActionCandidate, "score"> {
  const dedupeKey = `nba:${c.createdByRule}:${scope}`;
  const explanation = buildNextActionExplanation(c.createdByRule, ctx);
  return {
    ...c,
    dedupeKey,
    entityType: scope,
    entityId: scope,
    explanationJson: explanation as unknown as Record<string, unknown>,
  };
}

export function produceNextActions(
  ctx: NextActionContext,
  scopeFilter: NBAScope = "command_center",
  learnedWeights?: LearnedWeightsParam,
  effectivenessByRuleKey?: EffectivenessByRuleKey
): NextActionCandidate[] {
  const out: Omit<NextActionCandidate, "score">[] = [];

  const emit = (ruleKey: string, c: Omit<NextActionCandidate, "score" | "dedupeKey" | "entityType" | "entityId" | "explanationJson" | "createdByRule"> & { countBoost?: number }) => {
    const scopes = RULE_SCOPES[ruleKey] ?? ["command_center"];
    for (const scope of scopes) {
      if (scope !== scopeFilter) continue;
      out.push(makeCandidate(scope, { ...c, createdByRule: ruleKey }, ctx));
    }
  };

  if (ctx.commandCenterBand === "critical") {
    emit("score_in_critical_band", {
      title: "Investigate top score reasons",
      reason: "Command center score in critical band",
      priority: NextActionPriority.critical,
      sourceType: RiskSourceType.score,
      sourceId: "command_center",
      actionUrl: "/dashboard/internal/scoreboard",
      payloadJson: { entityType: "command_center" },
    });
  }

  if (ctx.failedDeliveryCount > 0) {
    emit("failed_notification_deliveries", {
      title: "Retry failed deliveries",
      reason: `${ctx.failedDeliveryCount} delivery attempt(s) failed`,
      priority: NextActionPriority.high,
      sourceType: RiskSourceType.notification_event,
      sourceId: null,
      actionUrl: "/dashboard/notifications?filter=failed",
      payloadJson: { action: "retry_failed" },
      countBoost: Math.min(10, ctx.failedDeliveryCount),
    });
  }

  if (ctx.overdueRemindersCount > 0) {
    emit("overdue_reminders_high_priority", {
      title: "Clear overdue reminders",
      reason: `${ctx.overdueRemindersCount} reminder(s) overdue`,
      priority: NextActionPriority.medium,
      sourceType: RiskSourceType.reminder,
      sourceId: null,
      actionUrl: "/dashboard/reminders?bucket=overdue",
      payloadJson: { bucket: "overdue" },
      countBoost: Math.min(10, ctx.overdueRemindersCount),
    });
  }

  if (ctx.sentNoFollowupDateCount > 0) {
    emit("proposals_sent_no_followup_date", {
      title: "Schedule follow-up dates",
      reason: `${ctx.sentNoFollowupDateCount} proposal(s) need follow-up date`,
      priority: NextActionPriority.medium,
      sourceType: RiskSourceType.proposal,
      sourceId: null,
      actionUrl: "/dashboard/proposal-followups?bucket=no_followup",
      payloadJson: { bucket: "no_followup" },
      countBoost: Math.min(10, ctx.sentNoFollowupDateCount),
    });
  }

  if (ctx.retentionOverdueCount > 0) {
    emit("retention_overdue", {
      title: "Contact retention clients",
      reason: `${ctx.retentionOverdueCount} retention task(s) overdue`,
      priority: ctx.retentionOverdueCount >= 3 ? NextActionPriority.high : NextActionPriority.medium,
      sourceType: RiskSourceType.delivery_project,
      sourceId: null,
      actionUrl: "/dashboard/retention?bucket=overdue",
      payloadJson: { bucket: "overdue" },
      countBoost: Math.min(10, ctx.retentionOverdueCount),
    });
  }

  if (ctx.handoffNoClientConfirmCount > 0) {
    emit("handoff_no_client_confirm", {
      title: "Request client confirmation",
      reason: `${ctx.handoffNoClientConfirmCount} handoff(s) awaiting client confirm`,
      priority: NextActionPriority.medium,
      sourceType: RiskSourceType.delivery_project,
      sourceId: null,
      actionUrl: "/dashboard/handoffs?bucket=awaiting_confirm",
      payloadJson: { bucket: "awaiting_confirm" },
      countBoost: Math.min(10, ctx.handoffNoClientConfirmCount),
    });
  }

  if (ctx.wonNoDeliveryCount > 0) {
    emit("flywheel_won_no_delivery", {
      title: "Create delivery projects for won deals",
      reason: `${ctx.wonNoDeliveryCount} won deal(s) have no delivery project`,
      priority: NextActionPriority.high,
      sourceType: RiskSourceType.intake_lead,
      sourceId: null,
      actionUrl: "/dashboard/delivery/new",
      payloadJson: { gap: "won_no_delivery" },
      countBoost: Math.min(10, ctx.wonNoDeliveryCount * 3),
    });
  }

  if (ctx.referralGapCount > 0) {
    emit("flywheel_referral_gap", {
      title: "Ask for referrals on won deals",
      reason: `${ctx.referralGapCount} won deal(s) — referral not requested`,
      priority: NextActionPriority.medium,
      sourceType: RiskSourceType.intake_lead,
      sourceId: null,
      actionUrl: "/dashboard/leads",
      payloadJson: { gap: "referral_not_asked" },
      countBoost: Math.min(10, ctx.referralGapCount * 2),
    });
  }

  if (ctx.stageStallCount > 0) {
    emit("flywheel_stage_stall", {
      title: "Re-engage stalled leads",
      reason: `${ctx.stageStallCount} active lead(s) with no contact 10+ days`,
      priority: ctx.stageStallCount >= 3 ? NextActionPriority.high : NextActionPriority.medium,
      sourceType: RiskSourceType.intake_lead,
      sourceId: null,
      actionUrl: "/dashboard/leads",
      payloadJson: { gap: "stage_stall" },
      countBoost: Math.min(10, ctx.stageStallCount * 2),
    });
  }

  // Phase 6.3: Growth Engine rules (founder_growth scope)
  if ((ctx.growthOverdueCount ?? 0) > 0) {
    emit("growth_overdue_followups", {
      title: "Follow up on growth pipeline",
      reason: `${ctx.growthOverdueCount} deal(s) with overdue follow-up`,
      priority: (ctx.growthOverdueCount ?? 0) >= 3 ? NextActionPriority.high : NextActionPriority.medium,
      sourceType: RiskSourceType.growth_pipeline,
      sourceId: null,
      actionUrl: "/dashboard/growth",
      payloadJson: {
        bucket: "overdue",
        dealId: ctx.growthFirstOverdueDealId ?? undefined,
      },
      countBoost: Math.min(10, ctx.growthOverdueCount ?? 0),
    });
  }

  if ((ctx.growthNoOutreachCount ?? 0) > 0) {
    emit("growth_no_outreach_sent", {
      title: "Send outreach to new prospects",
      reason: `${ctx.growthNoOutreachCount} new deal(s) with no outreach sent`,
      priority: NextActionPriority.medium,
      sourceType: RiskSourceType.growth_pipeline,
      sourceId: null,
      actionUrl: "/dashboard/growth",
      payloadJson: {
        bucket: "no_outreach",
        dealId: ctx.growthFirstNoOutreachDealId ?? undefined,
      },
      countBoost: Math.min(10, ctx.growthNoOutreachCount ?? 0),
    });
  }

  const ranked = rankNextActions(
    out.map((o) => ({ ...o, score: 0 })),
    ctx.now,
    [],
    learnedWeights,
    effectivenessByRuleKey
  );
  return ranked;
}
