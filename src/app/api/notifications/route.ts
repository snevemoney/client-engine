/**
 * GET /api/notifications — List notification events with filters.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { NotificationEventStatus, NotificationSeverity } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/notifications", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const sourceType = searchParams.get("sourceType");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (status && ["pending", "queued", "sent", "failed", "suppressed"].includes(status)) {
      where.status = status as NotificationEventStatus;
    }
    if (severity && ["info", "warning", "critical"].includes(severity)) {
      where.severity = severity as NotificationSeverity;
    }
    if (sourceType) where.sourceType = sourceType;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
        { eventKey: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      db.notificationEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip,
        take: pageSize,
        include: {
          deliveries: {
            select: { id: true, status: true, channelId: true },
          },
        },
      }),
      db.notificationEvent.count({ where }),
    ]);

    const deliverySummary = (d: { status: string }[]) => {
      const sent = d.filter((x) => x.status === "sent").length;
      const failed = d.filter((x) => x.status === "failed").length;
      const queued = d.filter((x) => x.status === "queued" || x.status === "sending").length;
      return { sent, failed, queued };
    };

    return NextResponse.json({
      items: items.map((e) => ({
        id: e.id,
        eventKey: e.eventKey,
        title: e.title,
        message: e.message,
        severity: e.severity,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        actionUrl: e.actionUrl,
        status: e.status,
        occurredAt: e.occurredAt.toISOString(),
        sentAt: e.sentAt?.toISOString() ?? null,
        failedAt: e.failedAt?.toISOString() ?? null,
        createdByRule: e.createdByRule,
        deliverySummary: deliverySummary(e.deliveries),
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
