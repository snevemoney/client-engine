/**
 * Phase 4.0: Risk rule evaluation.
 */

import type { RiskCandidate } from "./types";
import type { RiskRuleContext } from "./types";
import { RiskSeverity, RiskSourceType } from "@prisma/client";

function dedupeKey(ruleKey: string, scope: string): string {
  return `risk:${ruleKey}:${scope}`;
}

export function evaluateRiskRules(ctx: RiskRuleContext): RiskCandidate[] {
  const out: RiskCandidate[] = [];

  // 1) critical_notifications_failed_delivery
  if (ctx.failedDeliveryCount24h >= 3) {
    out.push({
      key: "critical_notifications_failed_delivery:system",
      title: "Failed notification deliveries",
      description: `${ctx.failedDeliveryCount24h}+ deliveries failed in last 24h`,
      severity: RiskSeverity.critical,
      sourceType: RiskSourceType.notification_event,
      sourceId: null,
      actionUrl: "/dashboard/notifications?filter=failed",
      suggestedFix: "Retry failed deliveries or check channel config",
      evidenceJson: { failedCount: ctx.failedDeliveryCount24h, windowHours: 24 },
      createdByRule: "critical_notifications_failed_delivery",
      dedupeKey: dedupeKey("critical_notifications_failed_delivery", "system"),
    });
  }

  // 2) stale_running_jobs
  if (ctx.staleRunningJobsCount >= 1) {
    out.push({
      key: "stale_running_jobs:system",
      title: "Stale running jobs",
      description: `${ctx.staleRunningJobsCount} job(s) stuck in running state`,
      severity: RiskSeverity.high,
      sourceType: RiskSourceType.job,
      sourceId: null,
      actionUrl: "/dashboard/jobs?filter=stale",
      suggestedFix: "Run job recovery or investigate",
      evidenceJson: { staleCount: ctx.staleRunningJobsCount },
      createdByRule: "stale_running_jobs",
      dedupeKey: dedupeKey("stale_running_jobs", "system"),
    });
  }

  // 3) overdue_reminders_high_priority
  if (ctx.overdueRemindersHighCount > 0) {
    out.push({
      key: "overdue_reminders_high_priority:system",
      title: "Overdue high-priority reminders",
      description: `${ctx.overdueRemindersHighCount} reminder(s) overdue`,
      severity: RiskSeverity.high,
      sourceType: RiskSourceType.reminder,
      sourceId: null,
      actionUrl: "/dashboard/reminders?bucket=overdue",
      suggestedFix: "Clear overdue reminders",
      evidenceJson: { overdueCount: ctx.overdueRemindersHighCount },
      createdByRule: "overdue_reminders_high_priority",
      dedupeKey: dedupeKey("overdue_reminders_high_priority", "system"),
    });
  }

  // 4) score_in_critical_band
  if (ctx.commandCenterBand === "critical") {
    out.push({
      key: "score_in_critical_band:command_center",
      title: "Operational score in critical band",
      description: "Command center score is critical",
      severity: RiskSeverity.critical,
      sourceType: RiskSourceType.score,
      sourceId: "command_center",
      actionUrl: "/dashboard/internal/scoreboard",
      suggestedFix: "Investigate top reasons and trends",
      evidenceJson: { band: ctx.commandCenterBand, entityId: "command_center" },
      createdByRule: "score_in_critical_band",
      dedupeKey: dedupeKey("score_in_critical_band", "command_center"),
    });
  }

  // 5) proposal_followups_overdue
  if (ctx.proposalFollowupOverdueCount > 0) {
    const severity = ctx.proposalFollowupOverdueCount >= 5 ? RiskSeverity.high : RiskSeverity.medium;
    out.push({
      key: "proposal_followups_overdue:system",
      title: "Proposal follow-ups overdue",
      description: `${ctx.proposalFollowupOverdueCount} proposal(s) need follow-up`,
      severity,
      sourceType: RiskSourceType.proposal,
      sourceId: null,
      actionUrl: "/dashboard/proposal-followups?bucket=overdue",
      suggestedFix: "Schedule or complete overdue follow-ups",
      evidenceJson: { overdueCount: ctx.proposalFollowupOverdueCount },
      createdByRule: "proposal_followups_overdue",
      dedupeKey: dedupeKey("proposal_followups_overdue", "system"),
    });
  }

  // 6) retention_overdue
  if (ctx.retentionOverdueCount > 0) {
    const severity = ctx.retentionOverdueCount >= 3 ? RiskSeverity.high : RiskSeverity.medium;
    out.push({
      key: "retention_overdue:system",
      title: "Retention contacts overdue",
      description: `${ctx.retentionOverdueCount} retention task(s) overdue`,
      severity,
      sourceType: RiskSourceType.delivery_project,
      sourceId: null,
      actionUrl: "/dashboard/retention?bucket=overdue",
      suggestedFix: "Contact retention clients",
      evidenceJson: { overdueCount: ctx.retentionOverdueCount },
      createdByRule: "retention_overdue",
      dedupeKey: dedupeKey("retention_overdue", "system"),
    });
  }

  // 7) growth_pipeline_zero_activity_7d (Phase 6.3)
  const growthScope = ctx.ownerUserId ? `growth:${ctx.ownerUserId}` : null;
  if (growthScope && (ctx.growthDealCount ?? 0) >= 3) {
    const sevenDaysAgo = new Date(ctx.now.getTime() - 7 * 86400000);
    const lastStale =
      ctx.growthLastActivityAt == null || ctx.growthLastActivityAt < sevenDaysAgo;
    if (lastStale) {
      out.push({
        key: `growth_pipeline_zero_activity_7d:${growthScope}`,
        title: "Growth pipeline inactive 7+ days",
        description: "No outreach or events in 7+ days with 3+ deals in pipeline",
        severity: RiskSeverity.high,
        sourceType: RiskSourceType.growth_pipeline,
        sourceId: ctx.ownerUserId,
        actionUrl: "/dashboard/growth",
        suggestedFix: "Review pipeline and send follow-ups",
        evidenceJson: {
          dealCount: ctx.growthDealCount,
          lastActivityAt: ctx.growthLastActivityAt?.toISOString() ?? null,
        },
        createdByRule: "growth_pipeline_zero_activity_7d",
        dedupeKey: dedupeKey("growth_pipeline_zero_activity_7d", growthScope),
      });
    }
  }

  return out;
}
