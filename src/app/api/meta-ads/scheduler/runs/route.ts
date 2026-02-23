/**
 * GET /api/meta-ads/scheduler/runs
 * Returns recent scheduler run logs. Auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/meta-ads/scheduler/runs", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (!accountId) return NextResponse.json({ runs: [] });

    const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10), 100);

    const runs = await db.metaAdsSchedulerRunLog.findMany({
      where: { accountId: acc },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ runs });
  });
}
