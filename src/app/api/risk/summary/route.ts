/**
 * GET /api/risk/summary — Counts by severity, snoozed, lastRunAt.
 * Cached 15s.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { RiskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/risk/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("risk/summary", async () => {
        const [openBySeverity, snoozedCount, lastRun] = await Promise.all([
          db.riskFlag.groupBy({
            by: ["severity"],
            where: { status: RiskStatus.open },
            _count: { id: true },
          }),
          db.riskFlag.count({ where: { status: RiskStatus.snoozed } }),
          db.riskFlag.findFirst({
            where: {},
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);

        const bySeverity: Record<string, number> = {};
        for (const g of openBySeverity) {
          bySeverity[g.severity] = g._count.id;
        }

        return {
          openBySeverity: {
            low: bySeverity.low ?? 0,
            medium: bySeverity.medium ?? 0,
            high: bySeverity.high ?? 0,
            critical: bySeverity.critical ?? 0,
          },
          snoozedCount: snoozedCount ?? 0,
          lastRunAt: lastRun?.updatedAt?.toISOString() ?? null,
        };
      }, 15_000);
    } catch (err) {
      console.error("[risk/summary]", err);
      return jsonError("Failed to load risk summary", 500);
    }
  });
}
