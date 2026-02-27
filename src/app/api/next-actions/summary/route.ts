/**
 * GET /api/next-actions/summary — Top 5 queued + counts by priority.
 * Phase 4.1: Supports entityType, entityId scope. Cached 15s.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { NextActionPriority, NextActionStatus } from "@prisma/client";
import { parseScope } from "@/lib/next-actions/scope";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/next-actions/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { entityType, entityId } = parseScope(
      request.nextUrl.searchParams.get("entityType"),
      request.nextUrl.searchParams.get("entityId")
    );

    try {
      return await withSummaryCache(`next-actions/summary:${entityType}:${entityId}`, async () => {
        const scopeWhere = { entityType, entityId, status: NextActionStatus.queued };
        const [top5, byPriority, lastRun] = await Promise.all([
          db.nextBestAction.findMany({
            where: scopeWhere,
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
              explanationJson: true,
            },
          }),
          db.nextBestAction.groupBy({
            by: ["priority"],
            where: scopeWhere,
            _count: { id: true },
          }),
          db.nextActionRun.findFirst({
            where: { runKey: { contains: `:${entityType}:${entityId}:` } },
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
            explanationJson: a.explanationJson,
          })),
          queuedByPriority: {
            low: counts[NextActionPriority.low] ?? 0,
            medium: counts[NextActionPriority.medium] ?? 0,
            high: counts[NextActionPriority.high] ?? 0,
            critical: counts[NextActionPriority.critical] ?? 0,
          },
          lastRunAt: lastRun?.createdAt?.toISOString() ?? null,
          entityType,
          entityId,
        };
      }, 15_000);
    } catch (err) {
      console.error("[next-actions/summary]", err);
      return jsonError("Failed to load next actions summary", 500);
    }
  });
}
