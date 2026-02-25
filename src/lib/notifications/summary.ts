/**
 * Phase 2.8.6: Notification summary for dashboards (server-side).
 */

import { db } from "@/lib/db";

export type NotificationSummary = {
  pending: number;
  sentToday: number;
  failedToday: number;
  criticalOpen: number;
  unreadInApp: number;
  deadLetterAlerts: number;
  staleJobAlerts: number;
};

export async function getNotificationSummary(): Promise<NotificationSummary> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    pending,
    sentToday,
    failedToday,
    criticalOpen,
    unreadInApp,
    deadLetterAlerts,
    staleJobAlerts,
  ] = await Promise.all([
    db.notificationEvent.count({
      where: { status: { in: ["pending", "queued"] } },
    }),
    db.notificationEvent.count({
      where: { status: "sent", sentAt: { gte: todayStart } },
    }),
    db.notificationEvent.count({
      where: { status: "failed", failedAt: { gte: todayStart } },
    }),
    db.notificationEvent.count({
      where: {
        severity: "critical",
        status: { in: ["pending", "queued", "failed"] },
      },
    }),
    db.inAppNotification.count({
      where: { isRead: false },
    }),
    db.notificationEvent.count({
      where: {
        eventKey: "job.dead_letter",
        occurredAt: { gte: sevenDaysAgo },
      },
    }),
    db.notificationEvent.count({
      where: {
        eventKey: "job.stale_running",
        occurredAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  return {
    pending: pending ?? 0,
    sentToday: sentToday ?? 0,
    failedToday: failedToday ?? 0,
    criticalOpen: criticalOpen ?? 0,
    unreadInApp: unreadInApp ?? 0,
    deadLetterAlerts: deadLetterAlerts ?? 0,
    staleJobAlerts: staleJobAlerts ?? 0,
  };
}
