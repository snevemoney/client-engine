/**
 * GET /api/meta-ads/actions — Action history (audit log)
 * Query: from?, to?, status?, actionType?, limit?
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/meta-ads/actions", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (!accountId) {
      return NextResponse.json({ actions: [] });
    }

    const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const actionType = req.nextUrl.searchParams.get("actionType") ?? undefined;
    const from = req.nextUrl.searchParams.get("from") ?? undefined;
    const to = req.nextUrl.searchParams.get("to") ?? undefined;
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10), 100);

    const where: { accountId: string; status?: string; actionType?: string; createdAt?: object } = { accountId: acc };
    if (status) where.status = status;
    if (actionType) where.actionType = actionType;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, Date>).lte = new Date(to);
    }

    const actions = await db.metaAdsActionLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ actions });
  });
}
