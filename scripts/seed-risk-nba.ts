/**
 * Phase 4.0: Seed sample risk flags and next actions for UI smoke.
 * Run: npm run db:seed-risk-nba
 */
import { db } from "../src/lib/db";
import { RiskSeverity, RiskStatus, RiskSourceType, NextActionPriority, NextActionStatus } from "@prisma/client";

async function main() {
  const now = new Date();

  // Sample risk flags
  const risks = [
    {
      key: "sample:critical_notifications_failed",
      title: "Failed notification deliveries",
      description: "3+ deliveries failed in last 24h",
      severity: RiskSeverity.critical,
      status: RiskStatus.open,
      sourceType: RiskSourceType.notification_event,
      sourceId: null,
      actionUrl: "/dashboard/notifications?filter=failed",
      suggestedFix: "Retry failed deliveries or check channel config",
      evidenceJson: { failedCount: 3, windowHours: 24 },
      createdByRule: "critical_notifications_failed_delivery",
      dedupeKey: "risk:critical_notifications_failed_delivery:system",
      lastSeenAt: now,
    },
    {
      key: "sample:stale_jobs",
      title: "Stale running jobs",
      description: "1+ jobs stuck in running state",
      severity: RiskSeverity.high,
      status: RiskStatus.open,
      sourceType: RiskSourceType.job,
      sourceId: null,
      actionUrl: "/dashboard/jobs?filter=stale",
      suggestedFix: "Run job recovery or investigate",
      evidenceJson: { staleCount: 1 },
      createdByRule: "stale_running_jobs",
      dedupeKey: "risk:stale_running_jobs:system",
      lastSeenAt: now,
    },
    {
      key: "sample:proposal_followups_overdue",
      title: "Proposal follow-ups overdue",
      description: "2 proposals need follow-up",
      severity: RiskSeverity.medium,
      status: RiskStatus.open,
      sourceType: RiskSourceType.proposal,
      sourceId: null,
      actionUrl: "/dashboard/proposal-followups?bucket=overdue",
      suggestedFix: "Schedule or complete overdue follow-ups",
      evidenceJson: { overdueCount: 2 },
      createdByRule: "proposal_followups_overdue",
      dedupeKey: "risk:proposal_followups_overdue:system",
      lastSeenAt: now,
    },
  ];

  for (const r of risks) {
    const existing = await db.riskFlag.findUnique({ where: { dedupeKey: r.dedupeKey } });
    if (!existing) {
      await db.riskFlag.create({ data: r });
      console.log(`Created risk: ${r.title}`);
    }
  }

  // Sample next actions
  const actions = [
    {
      title: "Investigate top score reasons",
      reason: "Command center score in critical band",
      priority: NextActionPriority.critical,
      score: 92,
      status: NextActionStatus.queued,
      sourceType: RiskSourceType.score,
      sourceId: "command_center",
      actionUrl: "/dashboard/internal/scoreboard",
      payloadJson: { entityType: "command_center" },
      createdByRule: "score_in_critical_band",
      dedupeKey: "nba:score_in_critical_band:command_center",
    },
    {
      title: "Retry failed deliveries",
      reason: "3 delivery attempts failed",
      priority: NextActionPriority.high,
      score: 78,
      status: NextActionStatus.queued,
      sourceType: RiskSourceType.notification_event,
      sourceId: null,
      actionUrl: "/dashboard/notifications?filter=failed",
      payloadJson: { action: "retry_failed" },
      createdByRule: "failed_notification_deliveries",
      dedupeKey: "nba:failed_notification_deliveries:system",
    },
    {
      title: "Clear overdue reminders",
      reason: "2 high-priority reminders overdue",
      priority: NextActionPriority.medium,
      score: 58,
      status: NextActionStatus.queued,
      sourceType: RiskSourceType.reminder,
      sourceId: null,
      actionUrl: "/dashboard/reminders?bucket=overdue",
      payloadJson: { bucket: "overdue" },
      createdByRule: "overdue_reminders_high_priority",
      dedupeKey: "nba:overdue_reminders_high_priority:system",
    },
  ];

  for (const a of actions) {
    const existing = await db.nextBestAction.findUnique({ where: { dedupeKey: a.dedupeKey } });
    if (!existing) {
      await db.nextBestAction.create({ data: a });
      console.log(`Created next action: ${a.title}`);
    }
  }

  // One sample run record
  const runKey = `nba:seed:${now.toISOString().slice(0, 10)}`;
  const existingRun = await db.nextActionRun.findUnique({ where: { runKey } });
  if (!existingRun) {
    await db.nextActionRun.create({
      data: { runKey, mode: "manual", metaJson: { source: "seed" } },
    });
    console.log(`Created NextActionRun: ${runKey}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
