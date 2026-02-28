/**
 * GET /api/intelligence/context — Unified risk + NBA + score context per entity.
 * Phase 4: Cross-page intelligence sharing. Cached 15s.
 *
 * Returns a lightweight summary so operational pages (Growth, Delivery,
 * Retention, etc.) can display cross-cutting intelligence without making
 * three separate API calls.
 */
import { NextRequest } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { withSummaryCache, summaryCacheKey } from "@/lib/http/cached-handler";
import { RiskStatus } from "@prisma/client";
import { NextActionStatus } from "@prisma/client";
import { parseScope } from "@/lib/next-actions/scope";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/intelligence/context", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const sp = request.nextUrl.searchParams;
    const { entityType, entityId } = parseScope(
      sp.get("entityType"),
      sp.get("entityId"),
    );

    try {
      const key = summaryCacheKey("intelligence/context", { entityType, entityId });

      return await withSummaryCache(key, async () => {
        const [
          riskBySeverity,
          riskTopFlags,
          nbaByCounts,
          nbaTop3,
          latestScore,
        ] = await Promise.all([
          // Risk: open counts grouped by severity
          db.riskFlag.groupBy({
            by: ["severity"],
            where: { status: RiskStatus.open },
            _count: { id: true },
          }),

          // Risk: top 3 open flags (most recent)
          db.riskFlag.findMany({
            where: { status: RiskStatus.open },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              title: true,
              severity: true,
              key: true,
            },
          }),

          // NBA: queued counts grouped by priority
          db.nextBestAction.groupBy({
            by: ["priority"],
            where: {
              entityType,
              entityId,
              status: NextActionStatus.queued,
            },
            _count: { id: true },
          }),

          // NBA: top 3 queued actions by score
          db.nextBestAction.findMany({
            where: {
              entityType,
              entityId,
              status: NextActionStatus.queued,
            },
            orderBy: [{ score: "desc" }, { createdAt: "desc" }],
            take: 3,
            select: {
              id: true,
              title: true,
              priority: true,
              score: true,
              actionUrl: true,
              templateKey: true,
            },
          }),

          // Score: latest snapshot
          db.scoreSnapshot.findFirst({
            where: { entityType, entityId },
            orderBy: { computedAt: "desc" },
            select: {
              score: true,
              band: true,
              delta: true,
              computedAt: true,
            },
          }),
        ]);

        // Build risk severity map
        const riskCounts: Record<string, number> = {};
        let openCount = 0;
        for (const g of riskBySeverity) {
          riskCounts[g.severity] = g._count.id;
          openCount += g._count.id;
        }

        // Build NBA priority map
        const nbaPriorityCounts: Record<string, number> = {};
        let queuedCount = 0;
        for (const g of nbaByCounts) {
          nbaPriorityCounts[g.priority] = g._count.id;
          queuedCount += g._count.id;
        }

        return {
          risk: {
            openCount,
            criticalCount: riskCounts.critical ?? 0,
            highCount: riskCounts.high ?? 0,
            topFlags: riskTopFlags.map((f) => ({
              id: f.id,
              title: f.title,
              severity: f.severity,
              ruleKey: f.key,
            })),
          },
          nba: {
            queuedCount,
            criticalCount: nbaPriorityCounts.critical ?? 0,
            highCount: nbaPriorityCounts.high ?? 0,
            topActions: nbaTop3.map((a) => ({
              id: a.id,
              title: a.title,
              priority: a.priority,
              score: a.score,
              actionUrl: a.actionUrl,
              templateKey: a.templateKey ?? null,
            })),
          },
          score: latestScore
            ? {
                value: latestScore.score,
                band: latestScore.band,
                delta: latestScore.delta,
                computedAt: latestScore.computedAt.toISOString(),
              }
            : null,
          entityType,
          entityId,
        };
      }, 15_000);
    } catch (err) {
      console.error("[intelligence/context]", err);
      return jsonError("Failed to load intelligence context", 500);
    }
  });
}
