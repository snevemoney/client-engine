/**
 * GET /api/notifications/summary — Counts for dashboards.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { swrCacheHeaders } from "@/lib/http/response";
import { db } from "@/lib/db";
import { getStartOfDay } from "@/lib/followup/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/notifications/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const now = new Date();
    const todayStart = getStartOfDay(now);
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

    return NextResponse.json({
      pending: pending ?? 0,
      sentToday: sentToday ?? 0,
      failedToday: failedToday ?? 0,
      criticalOpen: criticalOpen ?? 0,
      unreadInApp: unreadInApp ?? 0,
      deadLetterAlerts: deadLetterAlerts ?? 0,
      staleJobAlerts: staleJobAlerts ?? 0,
    }, { headers: swrCacheHeaders(15, 60) });
  });
}
