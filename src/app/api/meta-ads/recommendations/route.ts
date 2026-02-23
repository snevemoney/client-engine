/**
 * GET /api/meta-ads/recommendations
 * Query: status?, entityType?
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMetaMode } from "@/lib/meta-ads/mode";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/meta-ads/recommendations", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const mode = getMetaMode();
    let accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (mode === "mock" && !accountId) accountId = "act_mock";
    if (!accountId) {
      return NextResponse.json({
        recommendations: [],
        lastActionByEntity: {},
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

    let lastActionByEntity: Record<string, { createdAt: string; status: string; actionType: string }> = {};
    if (recommendations.length > 0) {
      const entityKeys = new Set(recommendations.map((r) => `${r.entityType}:${r.entityId}`));
      const recentActions = await db.metaAdsActionLog.findMany({
        where: { accountId: acc },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { entityType: true, entityId: true, createdAt: true, status: true, actionType: true },
      });
      for (const a of recentActions) {
        const key = `${a.entityType}:${a.entityId}`;
        if (!(key in lastActionByEntity) && entityKeys.has(key)) {
          lastActionByEntity[key] = {
            createdAt: a.createdAt.toISOString(),
            status: a.status,
            actionType: a.actionType,
          };
        }
      }
    }

    return NextResponse.json({
      recommendations,
      lastActionByEntity,
      counts: {
        queued: countMap.queued ?? 0,
        approved: countMap.approved ?? 0,
        dismissed: countMap.dismissed ?? 0,
        applied: countMap.applied ?? 0,
        failed: countMap.failed ?? 0,
        false_positive: countMap.false_positive ?? 0,
      },
      settingsSummary: settings
        ? {
            mode: settings.mode,
            dryRun: settings.dryRun,
            targetCpl: settings.targetCpl,
            protectedCampaignIds: (settings.protectedCampaignIds as string[]) ?? [],
          }
        : null,
      lastGenerated,
    });
  });
}
