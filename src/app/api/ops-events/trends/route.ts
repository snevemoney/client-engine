/**
 * GET /api/ops-events/trends — Weekly buckets for charts
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getStartOfDay } from "@/lib/followup/dates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/ops-events/trends", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const weeks = Math.min(Math.max(parseInt(url.searchParams.get("weeks") ?? "4", 10) || 4, 1), 12);
    const groupBy = url.searchParams.get("groupBy") ?? "category";

    const now = new Date();
    const weekStarts: Date[] = [];
    for (let i = 0; i < weeks; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - 7 * i);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      weekStarts.push(getStartOfDay(d));
    }
    weekStarts.reverse();

    const buckets: Array<{
      weekStart: string;
      errorCount: number;
      slowCount: number;
      actionCount: number;
      byGroup: Record<string, number>;
    }> = [];

    for (let i = 0; i < weekStarts.length; i++) {
      const start = weekStarts[i];
      const end = i < weekStarts.length - 1 ? weekStarts[i + 1] : new Date(now.getTime() + 86400000);

      const [errorCount, slowCount, actionCount, grouped] = await Promise.all([
        db.opsEvent.count({
          where: {
            createdAt: { gte: start, lt: end },
            level: "error",
          },
        }),
        db.opsEvent.count({
          where: {
            createdAt: { gte: start, lt: end },
            durationMs: { gte: 2000 },
          },
        }),
        db.opsEvent.count({
          where: { createdAt: { gte: start, lt: end } },
        }),
        groupBy === "eventKey"
          ? db.opsEvent.groupBy({
              by: ["eventKey"],
              where: { createdAt: { gte: start, lt: end } },
              _count: { id: true },
            })
          : db.opsEvent.groupBy({
              by: ["category"],
              where: { createdAt: { gte: start, lt: end } },
              _count: { id: true },
            }),
      ]);

      const byGroup: Record<string, number> = {};
      const key = groupBy === "eventKey" ? "eventKey" : "category";
      for (const r of grouped) {
        const rec = r as unknown as Record<string, unknown>;
        const k = rec[key] as string | undefined;
        if (k) byGroup[k] = (rec._count as { id: number })?.id ?? 0;
      }

      buckets.push({
        weekStart: start.toISOString().slice(0, 10),
        errorCount: errorCount ?? 0,
        slowCount: slowCount ?? 0,
        actionCount: actionCount ?? 0,
        byGroup,
      });
    }

    return NextResponse.json({ buckets });
  });
}
