/**
 * GET /api/meta-ads/dashboard — Meta Ads Monitor (read-only).
 * Query: range=today|yesterday|last_7d|last_14d|last_30d
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchMetaAdsDashboard } from "@/lib/meta-ads/fetch";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import type { DateRangePreset } from "@/lib/meta-ads/types";

const VALID_RANGES: DateRangePreset[] = ["today", "yesterday", "last_7d", "last_14d", "last_30d"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/meta-ads/dashboard", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const range = (req.nextUrl.searchParams.get("range") ?? "last_7d") as DateRangePreset;
    if (!VALID_RANGES.includes(range)) {
      return jsonError("Invalid range; use today|yesterday|last_7d|last_14d|last_30d", 400);
    }

    const accountId = req.nextUrl.searchParams.get("account") ?? process.env.META_AD_ACCOUNT_ID ?? "";
    const skipCache = req.nextUrl.searchParams.get("skipCache") === "1";

    const result = await fetchMetaAdsDashboard(accountId, range, { skipCache });

    if (!result.ok) {
      const status =
        result.code === "NO_TOKEN" ? 503 :
        result.code === "INVALID_TOKEN" || result.code === "PERMISSION_DENIED" ? 401 :
        result.code === "RATE_LIMIT" ? 429 : 502;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  });
}
