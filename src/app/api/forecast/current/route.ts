/**
 * GET /api/forecast/current — Weekly and monthly forecasts.
 */
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { swrCacheHeaders } from "@/lib/http/response";
import { fetchWeeklyForecastInput, fetchMonthlyForecastInput } from "@/lib/forecasting/fetch-input";
import { computeWeeklyForecast, computeMonthlyForecast } from "@/lib/forecasting/forecast";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/forecast/current", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("forecast/current", async () => {
        const now = new Date();
        const [weeklyInput, monthlyInput] = await Promise.all([
          fetchWeeklyForecastInput(now),
          fetchMonthlyForecastInput(now),
        ]);

        const weekly = computeWeeklyForecast(weeklyInput);
        const monthly = computeMonthlyForecast(monthlyInput);

        const behindCount = weekly.metrics.filter((m) => m.status === "behind").length +
          monthly.metrics.filter((m) => m.status === "behind").length;

        return {
          weekly,
          monthly,
          warnings: [...weekly.warnings, ...monthly.warnings],
          behindPaceCount: behindCount,
        };
      }, 30_000, swrCacheHeaders(30, 60));
    } catch (err) {
      console.error("[forecast/current]", err);
      return jsonError("Failed to load forecast", 500);
    }
  });
}
