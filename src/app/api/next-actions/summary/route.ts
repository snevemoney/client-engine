/**
 * GET /api/next-actions/summary — Top 5 queued + counts by priority.
 * Cached 15s.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { NextActionPriority, NextActionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/next-actions/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("next-actions/summary", async () => {
        const [top5, byPriority, lastRun] = await Promise.all([
          db.nextBestAction.findMany({
            where: { status: NextActionStatus.queued },
            orderBy: [{ score: "desc" }, { createdAt: "desc" }],
            take: 5,
            select: {
              id: true,
              title: true,
              reason: true,
              priority: true,
              score: true,
              actionUrl: true,
              sourceType: true,
            },
          }),
          db.nextBestAction.groupBy({
            by: ["priority"],
            where: { status: NextActionStatus.queued },
            _count: { id: true },
          }),
          db.nextActionRun.findFirst({
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);

        const counts: Record<string, number> = {};
        for (const g of byPriority) {
          counts[g.priority] = g._count.id;
        }

        return {
          top5: top5.map((a) => ({
            id: a.id,
            title: a.title,
            reason: a.reason,
            priority: a.priority,
            score: a.score,
            actionUrl: a.actionUrl,
            sourceType: a.sourceType,
          })),
          queuedByPriority: {
            low: counts[NextActionPriority.low] ?? 0,
            medium: counts[NextActionPriority.medium] ?? 0,
            high: counts[NextActionPriority.high] ?? 0,
            critical: counts[NextActionPriority.critical] ?? 0,
          },
          lastRunAt: lastRun?.createdAt?.toISOString() ?? null,
        };
      }, 15_000);
    } catch (err) {
      console.error("[next-actions/summary]", err);
      return jsonError("Failed to load next actions summary", 500);
    }
  });
}
