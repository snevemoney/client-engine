/**
 * POST /api/meta-ads/recommendations/generate
 * Fetches dashboard data, runs rules, stores recommendations.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { runGenerateRecommendations } from "@/lib/meta-ads/generate-recommendations";

export const dynamic = "force-dynamic";

export async function POST() {
  return withRouteTiming("POST /api/meta-ads/recommendations/generate", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (!accountId) {
      return NextResponse.json({ ok: false, error: "META_AD_ACCOUNT_ID not set", generated: 0 });
    }

    const result = await runGenerateRecommendations(accountId);
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error,
        code: result.code,
        generated: 0,
      });
    }
    return NextResponse.json({
      ok: true,
      generated: result.generated,
      recommendations: result.generated,
    });
  });
}
