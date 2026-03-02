/**
 * GET /api/internal/revenue/portfolio — Portfolio health metrics.
 * Returns revenue/hour, client ROI ranking, concentration risk, pipeline velocity.
 */

import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { computePortfolioHealth } from "@/lib/revenue/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/internal/revenue/portfolio", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const health = await computePortfolioHealth();
      return NextResponse.json(health);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return jsonError(message, 500);
    }
  });
}
