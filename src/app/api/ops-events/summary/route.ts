/**
 * GET /api/ops-events/summary — Summary for dashboard cards
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getStartOfDay } from "@/lib/followup/dates";

export const dynamic = "force-dynamic";

const SLOW_THRESHOLD_MS = 2000;

export async function GET() {
  return withRouteTiming("GET /api/ops-events/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const todayStart = getStartOfDay(new Date());

    const [eventsToday, errorsToday, slowEventsToday, byCategory, byLevel, topEventKeys, topErrors, lastError] =
      await Promise.all([
        db.opsEvent.count({ where: { createdAt: { gte: todayStart } } }),
        db.opsEvent.count({
          where: { createdAt: { gte: todayStart }, level: "error" },
        }),
        db.opsEvent.count({
          where: {
            createdAt: { gte: todayStart },
            durationMs: { gte: SLOW_THRESHOLD_MS },
          },
        }),
        db.opsEvent.groupBy({
          by: ["category"],
          where: { createdAt: { gte: todayStart } },
          _count: { id: true },
        }),
        db.opsEvent.groupBy({
          by: ["level"],
          where: { createdAt: { gte: todayStart } },
          _count: { id: true },
        }),
        db.opsEvent.groupBy({
          by: ["eventKey"],
          where: { createdAt: { gte: todayStart } },
          _count: { id: true },
          orderBy: { _count: { eventKey: "desc" } },
          take: 5,
        }),
        db.opsEvent.groupBy({
          by: ["eventKey"],
          where: { createdAt: { gte: todayStart }, level: "error" },
          _count: { id: true },
          orderBy: { _count: { eventKey: "desc" } },
          take: 5,
        }),
        db.opsEvent.findFirst({
          where: { level: "error" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

    const byCategoryMap: Record<string, number> = {};
    for (const r of byCategory) {
      byCategoryMap[r.category] = r._count.id ?? 0;
    }
    const byLevelMap: Record<string, number> = {};
    for (const r of byLevel) {
      byLevelMap[r.level] = r._count.id ?? 0;
    }

    return NextResponse.json({
      eventsToday: eventsToday ?? 0,
      errorsToday: errorsToday ?? 0,
      slowEventsToday: slowEventsToday ?? 0,
      lastErrorAt: lastError?.createdAt?.toISOString() ?? null,
      topEventKeys: topEventKeys.map((r) => ({ eventKey: r.eventKey, count: r._count.id ?? 0 })),
      topErrors: topErrors.map((r) => ({ eventKey: r.eventKey, count: r._count.id ?? 0 })),
      byCategory: byCategoryMap,
      byLevel: byLevelMap,
    });
  });
}
