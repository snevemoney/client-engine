/**
 * Phase 4.0: Risk rule evaluation.
 * Phase 9.1: Revenue enrichment for risk flags.
 */

import type { RiskCandidate } from "./types";
import type { RiskRuleContext } from "./types";
import { RiskSeverity, RiskSourceType } from "@prisma/client";
import { db } from "@/lib/db";

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

  // 7) client_silence_critical (Phase 9.2)
  if (ctx.criticalInteractionGapCount > 0) {
    const severity = ctx.criticalInteractionGapCount >= 3 ? RiskSeverity.critical : RiskSeverity.high;
    out.push({
      key: "client_silence_critical:system",
      title: "Client silence — 14+ days with active work",
      description: `${ctx.criticalInteractionGapCount} client(s) with active proposal/delivery and no interaction in 14+ days`,
      severity,
      sourceType: RiskSourceType.client_interaction,
      sourceId: null,
      actionUrl: "/dashboard/risk",
      suggestedFix: "Review silent clients and send check-in",
      evidenceJson: { silentClientCount: ctx.criticalInteractionGapCount },
      createdByRule: "client_silence_critical",
      dedupeKey: dedupeKey("client_silence_critical", "system"),
    });
  }

  // 8) growth_pipeline_zero_activity_7d (Phase 6.3)
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

/**
 * Post-process risk candidates: attach exposedRevenue from connected entities.
 * Each rule maps to a revenue computation strategy:
 *   proposal_followups_overdue → sum of overdue proposal prices
 *   retention_overdue → sum of active delivery project values
 *   growth_pipeline_zero_activity_7d → sum of active deal values
 *   score_in_critical_band → total active portfolio value
 *   Others → no revenue (system/infra risks)
 */
export async function enrichRisksWithRevenue(
  risks: RiskCandidate[]
): Promise<RiskCandidate[]> {
  if (risks.length === 0) return risks;

  const ruleKeys = new Set(risks.map((r) => r.createdByRule));

  // Fetch revenue data only for rules that need it
  const [overdueProposals, activeDelivery, activeDeals] = await Promise.all([
    ruleKeys.has("proposal_followups_overdue")
      ? db.proposal.findMany({
          where: {
            status: { in: ["sent", "viewed"] },
            nextFollowUpAt: { lt: new Date(), not: null },
            acceptedAt: null,
            rejectedAt: null,
          },
          select: { priceMin: true, priceMax: true, priceCurrency: true },
        })
      : Promise.resolve([]),
    ruleKeys.has("retention_overdue")
      ? db.deliveryProject.findMany({
          where: {
            status: { in: ["completed", "archived"] },
            retentionNextFollowUpAt: { lt: new Date(), not: null },
            proposal: { priceMin: { not: null } },
          },
          select: {
            proposal: { select: { priceMin: true, priceMax: true, priceCurrency: true } },
          },
        })
      : Promise.resolve([]),
    ruleKeys.has("growth_pipeline_zero_activity_7d")
      ? db.deal.findMany({
          where: { stage: { notIn: ["won", "lost"] } },
          select: { valueCad: true },
        })
      : Promise.resolve([]),
  ]);

  // Pre-compute totals
  const proposalExposure = overdueProposals.reduce(
    (sum, p) => sum + (p.priceMin ?? p.priceMax ?? 0),
    0
  );
  const proposalCurrency = overdueProposals[0]?.priceCurrency ?? "CAD";

  const retentionExposure = activeDelivery.reduce(
    (sum, d) => sum + (d.proposal?.priceMin ?? d.proposal?.priceMax ?? 0),
    0
  );
  const retentionCurrency = activeDelivery[0]?.proposal?.priceCurrency ?? "CAD";

  const growthExposure = activeDeals.reduce(
    (sum, d) => sum + (d.valueCad ?? 0),
    0
  );

  // Total active portfolio for score-level risks
  const totalPortfolio = proposalExposure + retentionExposure + growthExposure;

  return risks.map((risk) => {
    switch (risk.createdByRule) {
      case "proposal_followups_overdue":
        return proposalExposure > 0
          ? { ...risk, exposedRevenue: proposalExposure, exposedRevenueCurrency: proposalCurrency }
          : risk;
      case "retention_overdue":
        return retentionExposure > 0
          ? { ...risk, exposedRevenue: retentionExposure, exposedRevenueCurrency: retentionCurrency }
          : risk;
      case "growth_pipeline_zero_activity_7d":
        return growthExposure > 0
          ? { ...risk, exposedRevenue: growthExposure, exposedRevenueCurrency: "CAD" }
          : risk;
      case "score_in_critical_band":
        return totalPortfolio > 0
          ? { ...risk, exposedRevenue: totalPortfolio, exposedRevenueCurrency: "CAD" }
          : risk;
      default:
        return risk;
    }
  });
}
