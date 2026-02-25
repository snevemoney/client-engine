/**
 * GET /api/forecast/targets — Resolved targets for week/month.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getMonthStart } from "@/lib/operator-score/trends";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/forecast/targets", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const now = new Date();
      const weekStart = getWeekStart(now);
      const monthStart = getMonthStart(now);

      const [strategyWeek, strategyTargets] = await Promise.all([
        db.strategyWeek.findUnique({
          where: { weekStart },
          select: { weeklyTargetValue: true, weeklyTargetUnit: true },
        }),
        db.strategyWeekTarget.findMany({
          where: { strategyWeek: { weekStart } },
          select: { category: true, name: true, targetValue: true, unit: true },
        }),
      ]);

      let weeklyTargetValue: number | null = strategyWeek?.weeklyTargetValue ? Number(strategyWeek.weeklyTargetValue) : null;
      let weeklyTargetUnit: string | null = strategyWeek?.weeklyTargetUnit ?? null;
      let source = "none";

      if (strategyTargets?.length) {
        source = "strategy_week_targets";
        for (const t of strategyTargets) {
          if (t.category === "revenue" && (t.unit === "$" || t.unit === "value")) {
            weeklyTargetValue = Number(t.targetValue);
            weeklyTargetUnit = t.unit;
          }
        }
      } else if (weeklyTargetValue != null) {
        source = "strategy_week";
      }

      return NextResponse.json({
        weekly: {
          targetValue: weeklyTargetValue,
          targetUnit: weeklyTargetUnit,
          source,
        },
        monthly: {
          targetValue: null,
          targetUnit: null,
          source: "none",
        },
      });
    } catch (err) {
      console.error("[forecast/targets]", err);
      return jsonError("Failed to load targets", 500);
    }
  });
}
