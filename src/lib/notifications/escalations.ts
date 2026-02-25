/**
 * Phase 2.8.6: Escalation rules — evaluate and create notification events.
 */

import { db } from "@/lib/db";
import { JobRunStatus } from "@prisma/client";
import { createNotificationEvent, queueNotificationDeliveries } from "./service";
import { formatNotificationTitle, formatNotificationMessage } from "./format";
import type { NotificationSeverity } from "@prisma/client";

const STALE_JOB_MINUTES = 10;

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export type EvaluateResult = {
  created: number;
  queued: number;
};

/**
 * Evaluate escalation rules and create notification events (idempotent within dedupe window).
 */
export async function evaluateEscalationRules(opts: {
  now?: Date;
  limit?: number;
}): Promise<EvaluateResult> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 50;

  const rules = await db.escalationRule.findMany({
    where: { isEnabled: true },
    take: limit,
  });

  let created = 0;
  let queued = 0;

  for (const rule of rules) {
    const { sourceType, triggerType, severity, dedupeWindowMinutes } = rule;
    const windowMs = (dedupeWindowMinutes ?? 60) * 60 * 1000;

    if (sourceType === "job" && triggerType === "dead_letter") {
      const jobs = await db.jobRun.findMany({
        where: { status: JobRunStatus.dead_letter },
        orderBy: { deadLetteredAt: "desc" },
        take: 20,
      });
      for (const job of jobs) {
        const dedupeKey = `job:dead_letter:${job.id}`;
        const existing = await db.notificationEvent.findFirst({
          where: { dedupeKey },
          orderBy: { createdAt: "desc" },
        });
        if (existing && now.getTime() - existing.createdAt.getTime() < windowMs) continue;

        const meta = {
          jobType: job.jobType,
          attempts: job.attempts,
          error: job.errorMessage,
        };
        const title = formatNotificationTitle({
          eventKey: "job.dead_letter",
          sourceType: "job",
          sourceId: job.id,
          meta,
        });
        const message = formatNotificationMessage({
          eventKey: "job.dead_letter",
          sourceType: "job",
          sourceId: job.id,
          meta,
        });
        const result = await createNotificationEvent({
          eventKey: "job.dead_letter",
          title,
          message,
          severity: (severity as NotificationSeverity) ?? "critical",
          sourceType: "job",
          sourceId: job.id,
          actionUrl: "/dashboard/jobs",
          metaJson: meta,
          dedupeKey,
          createdByRule: rule.key,
        });
        if (result.created) {
          created++;
          const q = await queueNotificationDeliveries(result.id, getChannelTargets(rule));
          queued += q.queued;
        }
      }
    }

    if (sourceType === "job" && triggerType === "stale_running") {
      const threshold = new Date(now.getTime() - STALE_JOB_MINUTES * 60 * 1000);
      const jobs = await db.jobRun.findMany({
        where: {
          status: JobRunStatus.running,
          OR: [
            { lockedAt: { lt: threshold } },
            { lockedAt: null, startedAt: { lt: threshold } },
          ],
        },
        take: 20,
      });
      for (const job of jobs) {
        const dedupeKey = `job:stale_running:${job.id}`;
        const existing = await db.notificationEvent.findFirst({
          where: { dedupeKey },
          orderBy: { createdAt: "desc" },
        });
        if (existing && now.getTime() - existing.createdAt.getTime() < windowMs) continue;

        const meta = { jobType: job.jobType };
        const title = formatNotificationTitle({
          eventKey: "job.stale_running",
          sourceType: "job",
          sourceId: job.id,
          meta,
        });
        const message = formatNotificationMessage({
          eventKey: "job.stale_running",
          sourceType: "job",
          sourceId: job.id,
          meta,
        });
        const result = await createNotificationEvent({
          eventKey: "job.stale_running",
          title,
          message,
          severity: (severity as NotificationSeverity) ?? "critical",
          sourceType: "job",
          sourceId: job.id,
          actionUrl: "/dashboard/jobs",
          metaJson: meta,
          dedupeKey,
          createdByRule: rule.key,
        });
        if (result.created) {
          created++;
          const q = await queueNotificationDeliveries(result.id, getChannelTargets(rule));
          queued += q.queued;
        }
      }
    }

    if (sourceType === "reminder" && (triggerType === "overdue" || triggerType === "critical_overdue")) {
      const isCritical = triggerType === "critical_overdue";
      const reminders = await db.opsReminder.findMany({
        where: {
          status: "open",
          dueAt: { lt: now },
          ...(isCritical ? { priority: "critical" } : {}),
        },
        take: 30,
      });
      for (const r of reminders) {
        const dateBucket = r.dueAt ? new Date(r.dueAt).toISOString().slice(0, 10) : "none";
        const dedupeKey = `reminder:${triggerType}:${r.id}:${dateBucket}`;
        const existing = await db.notificationEvent.findFirst({
          where: { dedupeKey },
          orderBy: { createdAt: "desc" },
        });
        if (existing && now.getTime() - existing.createdAt.getTime() < windowMs) continue;

        const eventKey = isCritical ? "reminder.critical_overdue" : "reminder.overdue";
        const meta = { title: r.title, dueAt: r.dueAt?.toISOString() };
        const title = formatNotificationTitle({
          eventKey,
          sourceType: "reminder",
          sourceId: r.id,
          meta,
        });
        const message = formatNotificationMessage({
          eventKey,
          sourceType: "reminder",
          sourceId: r.id,
          meta,
        });
        const result = await createNotificationEvent({
          eventKey,
          title,
          message,
          severity: (severity as NotificationSeverity) ?? (isCritical ? "critical" : "warning"),
          sourceType: "reminder",
          sourceId: r.id,
          actionUrl: r.actionUrl ?? "/dashboard/command",
          metaJson: meta,
          dedupeKey,
          createdByRule: rule.key,
        });
        if (result.created) {
          created++;
          const q = await queueNotificationDeliveries(result.id, getChannelTargets(rule));
          queued += q.queued;
        }
      }
    }

    if (sourceType === "review" && triggerType === "weekly_missing") {
      const weekStart = startOfWeek(now);
      const dedupeKey = `review:weekly_missing:${weekStart.toISOString().slice(0, 10)}`;
      const existing = await db.notificationEvent.findFirst({
        where: { dedupeKey },
        orderBy: { createdAt: "desc" },
      });
      if (existing && now.getTime() - existing.createdAt.getTime() < windowMs) {
        continue;
      }
      const reminders = await db.opsReminder.findMany({
        where: {
          createdByRule: "weekly_review_missing",
          status: "open",
          dueAt: { lt: now },
        },
        take: 1,
      });
      if (reminders.length === 0) continue;

      const title = formatNotificationTitle({ eventKey: "review.weekly_missing" });
      const message = formatNotificationMessage({ eventKey: "review.weekly_missing" });
      const result = await createNotificationEvent({
        eventKey: "review.weekly_missing",
        title,
        message,
        severity: (severity as NotificationSeverity) ?? "warning",
        sourceType: "review",
        actionUrl: "/dashboard/reviews",
        metaJson: {},
        dedupeKey,
        createdByRule: rule.key,
      });
      if (result.created) {
        created++;
        const q = await queueNotificationDeliveries(result.id, getChannelTargets(rule));
        queued += q.queued;
      }
    }

    if (sourceType === "snapshot" && triggerType === "missing") {
      const weekStart = startOfWeek(now);
      const conditions = (rule.conditionsJson as { kinds?: string[] }) ?? {};
      const kinds = conditions.kinds ?? ["metrics", "operator", "forecast"];

      for (const kind of kinds) {
        let eventKey: string;
        let missing = false;
        if (kind === "metrics") {
          eventKey = "snapshot.metrics_missing";
          const snap = await db.weeklyMetricSnapshot.findFirst({
            where: { weekStart: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) } },
          });
          missing = !snap;
        } else if (kind === "operator") {
          eventKey = "snapshot.operator_missing";
          const snap = await db.operatorScoreSnapshot.findFirst({
            where: {
              periodType: "weekly",
              periodStart: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
            },
          });
          missing = !snap;
        } else {
          eventKey = "snapshot.forecast_missing";
          const snap = await db.forecastSnapshot.findFirst({
            where: {
              periodType: "weekly",
              periodStart: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
            },
          });
          missing = !snap;
        }

        if (!missing) continue;

        const dedupeKey = `snapshot:missing:${kind}:${weekStart.toISOString().slice(0, 10)}`;
        const existing = await db.notificationEvent.findFirst({
          where: { dedupeKey },
          orderBy: { createdAt: "desc" },
        });
        if (existing && now.getTime() - existing.createdAt.getTime() < windowMs) continue;

        const title = formatNotificationTitle({ eventKey });
        const message = formatNotificationMessage({ eventKey });
        const result = await createNotificationEvent({
          eventKey,
          title,
          message,
          severity: (severity as NotificationSeverity) ?? "warning",
          sourceType: "snapshot",
          metaJson: { kind },
          dedupeKey,
          createdByRule: rule.key,
        });
        if (result.created) {
          created++;
          const q = await queueNotificationDeliveries(result.id, getChannelTargets(rule));
          queued += q.queued;
        }
      }
    }

    if (sourceType === "delivery" && triggerType === "retention_overdue") {
      const deliveries = await db.deliveryProject.findMany({
        where: {
          retentionNextFollowUpAt: { lt: now },
          retentionStatus: { in: ["monitoring", "followup_due", "upsell_open", "retainer_open"] },
        },
        take: 20,
      });
      for (const d of deliveries) {
        const dedupeKey = `delivery:retention_overdue:${d.id}:${now.toISOString().slice(0, 10)}`;
        const existing = await db.notificationEvent.findFirst({
          where: { dedupeKey },
          orderBy: { createdAt: "desc" },
        });
        if (existing && now.getTime() - existing.createdAt.getTime() < windowMs) continue;

        const title = formatNotificationTitle({
          eventKey: "delivery.retention_overdue",
          sourceType: "delivery",
          sourceId: d.id,
        });
        const message = formatNotificationMessage({
          eventKey: "delivery.retention_overdue",
          sourceType: "delivery",
          sourceId: d.id,
        });
        const result = await createNotificationEvent({
          eventKey: "delivery.retention_overdue",
          title,
          message,
          severity: (severity as NotificationSeverity) ?? "warning",
          sourceType: "delivery",
          sourceId: d.id,
          actionUrl: `/dashboard/deliveries/${d.id}`,
          metaJson: {},
          dedupeKey,
          createdByRule: rule.key,
        });
        if (result.created) {
          created++;
          const q = await queueNotificationDeliveries(result.id, getChannelTargets(rule));
          queued += q.queued;
        }
      }
    }
  }

  return { created, queued };
}

function getChannelTargets(rule: { channelTargetsJson?: unknown }): string[] | null {
  const arr = rule.channelTargetsJson;
  if (!Array.isArray(arr)) return null;
  return arr.filter((x): x is string => typeof x === "string");
}
