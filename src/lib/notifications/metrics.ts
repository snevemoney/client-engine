/**
 * Phase 2.9: Observability metrics for notifications/escalations.
 */

import { db } from "@/lib/db";
import { JobRunStatus } from "@prisma/client";

const STUCK_JOB_MINUTES = 15;

export type MetricsSummary = {
  period: "24h" | "7d";
  notifications: {
    totalCreated: number;
    bySourceType: Record<string, number>;
    byEventKey: Record<string, number>;
    bySeverity: Record<string, number>;
    inAppRead: number;
    inAppUnread: number;
  };
  deliveries: {
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
    retried: number;
    avgLatencyMs: number | null;
    byChannel: Record<string, { attempted: number; succeeded: number; failed: number }>;
  };
  escalations: {
    rulesTriggered: number;
    eventsCreated: number;
    dedupedSuppressed: number;
    bySeverity: Record<string, number>;
  };
  jobs: {
    pending: number;
    running: number;
    succeeded24h: number;
    failed24h: number;
    deadLetter: number;
    staleRunning: number;
    successRate: number | null;
    failureRate: number | null;
    avgProcessingDurationMs: number | null;
  };
};

export async function getMetricsSummary(period: "24h" | "7d" = "24h"): Promise<MetricsSummary> {
  const now = new Date();
  const hours = period === "24h" ? 24 : 24 * 7;
  const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const stuckThreshold = new Date(now.getTime() - STUCK_JOB_MINUTES * 60 * 1000);

  const [
    events,
    inAppCounts,
    deliveriesRaw,
    jobCounts,
    succeededJobs,
    failedJobs,
    staleRunning,
  ] = await Promise.all([
    db.notificationEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { sourceType: true, eventKey: true, severity: true, createdByRule: true, status: true },
    }),
    db.inAppNotification.groupBy({
      by: ["isRead"],
      _count: { id: true },
    }),
    db.notificationDelivery.findMany({
      where: { createdAt: { gte: since } },
      select: {
        status: true,
        attempt: true,
        channelId: true,
        channel: { select: { type: true } },
        createdAt: true,
        sentAt: true,
        failedAt: true,
      },
    }),
    db.jobRun.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    }),
    db.jobRun.count({
      where: {
        status: JobRunStatus.succeeded,
        finishedAt: { gte: since },
      },
    }),
    db.jobRun.count({
      where: {
        status: { in: [JobRunStatus.failed, JobRunStatus.dead_letter] },
        finishedAt: { gte: since },
      },
    }),
    db.jobRun.count({
      where: {
        status: JobRunStatus.running,
        OR: [
          { lockedAt: { lt: stuckThreshold } },
          { lockedAt: null, startedAt: { lt: stuckThreshold } },
        ],
      },
    }),
  ]);

  const bySource: Record<string, number> = {};
  const byEventKey: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const e of events) {
    bySource[e.sourceType ?? "unknown"] = (bySource[e.sourceType ?? "unknown"] ?? 0) + 1;
    byEventKey[e.eventKey] = (byEventKey[e.eventKey] ?? 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
  }

  const inAppRead = inAppCounts.find((c) => c.isRead)?._count.id ?? 0;
  const inAppUnread = inAppCounts.find((c) => !c.isRead)?._count.id ?? 0;

  const byChannel: Record<string, { attempted: number; succeeded: number; failed: number }> = {};
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let retried = 0;
  const latencies: number[] = [];

  for (const d of deliveriesRaw) {
    const ch = d.channel?.type ?? "unknown";
    if (!byChannel[ch]) byChannel[ch] = { attempted: 0, succeeded: 0, failed: 0 };
    byChannel[ch].attempted++;
    attempted++;

    if (d.status === "sent") {
      succeeded++;
      byChannel[ch].succeeded++;
      if (d.sentAt && d.createdAt) {
        latencies.push(d.sentAt.getTime() - d.createdAt.getTime());
      }
    } else if (d.status === "failed") {
      failed++;
      byChannel[ch].failed++;
    } else if (d.status === "skipped") {
      skipped++;
    }
    if (d.attempt > 1) retried++;
  }

  const escalationCreated = events.filter((e) => e.createdByRule != null).length;
  const dedupedEstimate = Math.max(0, events.length - escalationCreated);

  const jobByStatus = Object.fromEntries(jobCounts.map((c) => [c.status, c._count.id]));
  const pending = jobByStatus.queued ?? 0;
  const running = jobByStatus.running ?? 0;
  const deadLetter = jobByStatus.dead_letter ?? 0;
  const totalFinished = succeededJobs + failedJobs;
  const successRate = totalFinished > 0 ? succeededJobs / totalFinished : null;
  const failureRate = totalFinished > 0 ? failedJobs / totalFinished : null;

  let avgDuration: number | null = null;
  const durationJobs = await db.jobRun.findMany({
    where: {
      status: JobRunStatus.succeeded,
      finishedAt: { gte: since, not: null },
      startedAt: { not: null },
    },
    select: { startedAt: true, finishedAt: true },
    take: 100,
  });
  if (durationJobs.length > 0) {
    const sum = durationJobs.reduce(
      (acc, j) => acc + ((j.finishedAt?.getTime() ?? 0) - (j.startedAt?.getTime() ?? 0)),
      0
    );
    avgDuration = Math.round(sum / durationJobs.length);
  }

  return {
    period,
    notifications: {
      totalCreated: events.length,
      bySourceType: bySource,
      byEventKey,
      bySeverity,
      inAppRead,
      inAppUnread,
    },
    deliveries: {
      attempted,
      succeeded,
      failed,
      skipped,
      retried,
      avgLatencyMs: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
      byChannel,
    },
    escalations: {
      rulesTriggered: new Set(events.map((e) => e.createdByRule).filter(Boolean)).size,
      eventsCreated: escalationCreated,
      dedupedSuppressed: dedupedEstimate,
      bySeverity,
    },
    jobs: {
      pending,
      running,
      succeeded24h: succeededJobs,
      failed24h: failedJobs,
      deadLetter,
      staleRunning: staleRunning ?? 0,
      successRate,
      failureRate,
      avgProcessingDurationMs: avgDuration,
    },
  };
}
