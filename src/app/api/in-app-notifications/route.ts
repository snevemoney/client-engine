/**
 * GET /api/in-app-notifications — List inbox items.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { NotificationSeverity } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/in-app-notifications", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "1" || searchParams.get("unreadOnly") === "true";
    const severity = searchParams.get("severity");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (unreadOnly) where.isRead = false;
    if (severity && ["info", "warning", "critical"].includes(severity)) {
      where.severity = severity as NotificationSeverity;
    }

    const [items, total] = await Promise.all([
      db.inAppNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.inAppNotification.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map((n) => ({
        id: n.id,
        notificationEventId: n.notificationEventId,
        title: n.title,
        message: n.message,
        severity: n.severity,
        actionUrl: n.actionUrl,
        isRead: n.isRead,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  });
}
