/**
 * GET /api/operator-score/current — Current weekly and monthly operator scores.
 */
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { swrCacheHeaders } from "@/lib/http/response";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getMonthStart } from "@/lib/operator-score/trends";
import { fetchOperatorScoreInput } from "@/lib/operator-score/fetch-input";
import { computeOperatorScore } from "@/lib/operator-score/score";
import { compareScoreToPrevious } from "@/lib/operator-score/trends";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/operator-score/current", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("operator-score/current", async () => {
        const now = new Date();
      const weekStart = getWeekStart(now);
      const monthStart = getMonthStart(now);

      const [weeklyInput, monthlyInput, prevWeekly, prevMonthly] = await Promise.all([
        fetchOperatorScoreInput("weekly"),
        fetchOperatorScoreInput("monthly"),
        db.operatorScoreSnapshot.findUnique({
          where: {
            periodType_periodStart: {
              periodType: "weekly",
              periodStart: new Date(weekStart.getTime() - 7 * 86400000),
            },
          },
        }),
        db.operatorScoreSnapshot.findUnique({
          where: {
            periodType_periodStart: {
              periodType: "monthly",
              periodStart: new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1),
            },
          },
        }),
      ]);

      const weekly = computeOperatorScore(weeklyInput);
      const monthly = computeOperatorScore(monthlyInput);

      const deltaVsPrevWeekly = prevWeekly
        ? compareScoreToPrevious(weekly.score, prevWeekly.score)
        : { current: weekly.score, previous: 0, delta: 0, deltaPercent: 0, direction: "flat" as const };
      const deltaVsPrevMonthly = prevMonthly
        ? compareScoreToPrevious(monthly.score, prevMonthly.score)
        : { current: monthly.score, previous: 0, delta: 0, deltaPercent: 0, direction: "flat" as const };

        return {
          weekly: {
            score: weekly.score,
            grade: weekly.grade,
            breakdown: weekly.breakdown,
            summary: weekly.summary,
            topWins: weekly.topWins ?? [],
            topRisks: weekly.topRisks ?? [],
            deltaVsPrev: deltaVsPrevWeekly,
          },
          monthly: {
            score: monthly.score,
            grade: monthly.grade,
            breakdown: monthly.breakdown,
            summary: monthly.summary,
            topWins: monthly.topWins ?? [],
            topRisks: monthly.topRisks ?? [],
            deltaVsPrev: deltaVsPrevMonthly,
          },
          weekStart: weekStart.toISOString().slice(0, 10),
          monthStart: monthStart.toISOString().slice(0, 10),
        };
      }, 30_000, swrCacheHeaders(30, 60));
    } catch (err) {
      console.error("[operator-score/current]", err);
      return jsonError("Failed to load operator score", 500);
    }
  });
}
