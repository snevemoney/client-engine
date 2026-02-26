/**
 * GET /api/integrations/usage — API usage summary and logs.
 * Query params: period=24h|7d|30d|all, provider=<key>, detail=1 (for individual logs)
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getUsageSummary, getUsageLogs, type UsagePeriod } from "@/lib/integrations/usage";

export const dynamic = "force-dynamic";

const VALID_PERIODS = new Set(["24h", "7d", "30d", "all"]);

export async function GET(req: Request) {
  return withRouteTiming("GET /api/integrations/usage", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const period = (url.searchParams.get("period") ?? "30d") as UsagePeriod;
    const provider = url.searchParams.get("provider") ?? undefined;
    const detail = url.searchParams.get("detail") === "1";

    if (!VALID_PERIODS.has(period)) {
      return jsonError("Invalid period. Use 24h, 7d, 30d, or all", 400);
    }

    const summary = await getUsageSummary(period);
    const totalRequests = summary.reduce((s, r) => s + r.totalRequests, 0);
    const totalCost = summary.reduce((s, r) => s + r.totalCostUsd, 0);

    const result: Record<string, unknown> = {
      period,
      totalRequests,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
      providers: summary,
    };

    if (detail) {
      result.logs = await getUsageLogs({ provider, period, limit: 200 });
    }

    return NextResponse.json(result);
  });
}
