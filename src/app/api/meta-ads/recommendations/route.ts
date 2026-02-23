/**
 * GET /api/meta-ads/recommendations
 * Query: status?, entityType?
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/meta-ads/recommendations", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (!accountId) {
      return NextResponse.json({
        recommendations: [],
        counts: { queued: 0, approved: 0, dismissed: 0, applied: 0, failed: 0 },
        settingsSummary: null,
      });
    }

    const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const entityType = req.nextUrl.searchParams.get("entityType") ?? undefined;
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10), 100);

    const where: { accountId: string; status?: string; entityType?: string } = { accountId: acc };
    if (status) where.status = status;
    if (entityType) where.entityType = entityType;

    const [recommendations, counts, settings] = await Promise.all([
      db.metaAdsRecommendation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.metaAdsRecommendation.groupBy({
        by: ["status"],
        where: { accountId: acc },
        _count: true,
      }),
      db.metaAdsAutomationSettings.findUnique({
        where: { accountId: acc },
      }),
    ]);

    const countMap: Record<string, number> = {};
    for (const c of counts) {
      countMap[c.status] = c._count;
    }

    const lastGenerated = recommendations[0]?.createdAt ?? null;

    return NextResponse.json({
      recommendations,
      counts: {
        queued: countMap.queued ?? 0,
        approved: countMap.approved ?? 0,
        dismissed: countMap.dismissed ?? 0,
        applied: countMap.applied ?? 0,
        failed: countMap.failed ?? 0,
      },
      settingsSummary: settings
        ? {
            mode: settings.mode,
            dryRun: settings.dryRun,
            targetCpl: settings.targetCpl,
          }
        : null,
      lastGenerated,
    });
  });
}
