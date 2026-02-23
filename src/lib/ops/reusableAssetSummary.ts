/**
 * Reusable Asset summary: assets this week/month, % delivered with assets, top types.
 * Powers ReusableAssetSummaryCard (Command Center or Results).
 */

import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReusableAssetSummary = {
  assetsThisWeek: number;
  assetsThisMonth: number;
  deliveredCount: number; // leads SHIPPED
  deliveredWithAssetsCount: number;
  pctDeliveredWithAssets: number | null;
  topTypes: { assetType: string; count: number }[];
};

export async function getReusableAssetSummary(): Promise<ReusableAssetSummary> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);

  const [assetsThisWeek, assetsThisMonth, deliveredCount, deliveredWithAssets, byType] = await Promise.all([
    db.reusableAssetLog.count({
      where: { createdAt: { gte: weekAgo }, assetType: { not: "none" } },
    }),
    db.reusableAssetLog.count({
      where: { createdAt: { gte: monthAgo }, assetType: { not: "none" } },
    }),
    db.lead.count({ where: { status: "SHIPPED" } }),
    db.lead.count({
      where: {
        status: "SHIPPED",
        reusableAssetLogs: { some: { assetType: { not: "none" } } },
      },
    }),
    db.reusableAssetLog.groupBy({
      by: ["assetType"],
      where: { assetType: { not: "none" } },
      _count: { id: true },
    }),
  ]);

  const topTypes = byType
    .map((r: { assetType: string; _count: { id: number } }) => ({ assetType: r.assetType, count: r._count.id }))
    .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
    .slice(0, 6);
  const pctDeliveredWithAssets = deliveredCount > 0 ? Math.round((deliveredWithAssets / deliveredCount) * 100) : null;

  return {
    assetsThisWeek,
    assetsThisMonth,
    deliveredCount,
    deliveredWithAssetsCount: deliveredWithAssets,
    pctDeliveredWithAssets,
    topTypes,
  };
}
