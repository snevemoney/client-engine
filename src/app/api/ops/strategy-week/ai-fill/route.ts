/**
 * POST /api/ops/strategy-week/ai-fill
 * Use AI to infer Strategy Quadrant fields from operator context.
 * Returns suggested values; does not persist. User reviews and saves.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { inferStrategyWeekFields } from "@/lib/ops/strategyWeekAiFill";
import { withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function POST() {
  return withRouteTiming("POST /api/ops/strategy-week/ai-fill", async () => {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      const result = await inferStrategyWeekFields();
      return NextResponse.json(result);
    } catch (err) {
      console.error("[strategy-week/ai-fill]", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "AI fill failed" },
        { status: 500 }
      );
    }
  });
}
