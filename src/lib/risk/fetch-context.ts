/**
 * Phase 4.0: Fetch context for risk rule evaluation.
 */

import { db } from "@/lib/db";
import { JobRunStatus } from "@prisma/client";
import { getStartOfDay } from "@/lib/followup/dates";

const STALE_JOB_MINUTES = 10;
const HOURS_24 = 24;

export async function fetchRiskRuleContext(opts?: { now?: Date }): Promise<{
  now: Date;
  failedDeliveryCount24h: number;
  staleRunningJobsCount: number;
  overdueRemindersHighCount: number;
  commandCenterBand: string | null;
  proposalFollowupOverdueCount: number;
  retentionOverdueCount: number;
}> {
  const now = opts?.now ?? new Date();
  const since24h = new Date(now.getTime() - HOURS_24 * 60 * 60 * 1000);
  const staleThreshold = new Date(now.getTime() - STALE_JOB_MINUTES * 60 * 1000);
  const startToday = getStartOfDay(now);

  const [
    failedDeliveries,
    staleJobs,
    overdueReminders,
    latestScore,
    proposalOverdue,
    retentionOverdue,
  ] = await Promise.all([
    // 1) Failed NotificationDelivery in last 24h
    db.notificationDelivery.count({
      where: {
        status: "failed",
        createdAt: { gte: since24h },
      },
    }),
    // 2) Stale running JobRun
    db.jobRun.count({
      where: {
        status: JobRunStatus.running,
        OR: [
          { lockedAt: { lt: staleThreshold } },
          { lockedAt: null, startedAt: { lt: staleThreshold } },
        ],
      },
    }),
    // 3) Overdue OpsReminder (priority high or critical)
    db.opsReminder.count({
      where: {
        status: "open",
        priority: { in: ["high", "critical"] },
        dueAt: { lt: startToday, not: null },
      },
    }),
    // 4) Latest ScoreSnapshot for command_center
    db.scoreSnapshot.findFirst({
      where: { entityType: "command_center", entityId: "command_center" },
      orderBy: { computedAt: "desc" },
      select: { band: true },
    }),
    // 5) Proposal follow-up overdue (nextFollowUpAt < today, status sent/viewed)
    db.proposal.count({
      where: {
        status: { in: ["sent", "viewed"] },
        nextFollowUpAt: { lt: startToday, not: null },
        acceptedAt: null,
        rejectedAt: null,
      },
    }),
    // 6) Retention overdue (retentionNextFollowUpAt < today, completed/archived)
    db.deliveryProject.count({
      where: {
        status: { in: ["completed", "archived"] },
        retentionNextFollowUpAt: { lt: startToday, not: null },
      },
    }),
  ]);

  return {
    now,
    failedDeliveryCount24h: failedDeliveries ?? 0,
    staleRunningJobsCount: staleJobs ?? 0,
    overdueRemindersHighCount: overdueReminders ?? 0,
    commandCenterBand: latestScore?.band ?? null,
    proposalFollowupOverdueCount: proposalOverdue ?? 0,
    retentionOverdueCount: retentionOverdue ?? 0,
  };
}
