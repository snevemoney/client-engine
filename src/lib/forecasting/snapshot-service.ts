/**
 * Phase 2.8.4: Forecast snapshot service — shared by route and job handler.
 */

import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getMonthStart } from "@/lib/operator-score/trends";
import { fetchWeeklyForecastInput, fetchMonthlyForecastInput } from "@/lib/forecasting/fetch-input";
import { computeWeeklyForecast, computeMonthlyForecast } from "@/lib/forecasting/forecast";

export type CaptureForecastSnapshotResult = {
  recordsWritten: number;
  weekStart: string;
  monthStart: string;
};

export async function captureForecastSnapshot(nowOverride?: Date): Promise<CaptureForecastSnapshotResult> {
  const now = nowOverride ?? new Date();
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);

  const [weeklyInput, monthlyInput] = await Promise.all([
    fetchWeeklyForecastInput(now),
    fetchMonthlyForecastInput(now),
  ]);

  const weekly = computeWeeklyForecast(weeklyInput);
  const monthly = computeMonthlyForecast(monthlyInput);

  let written = 0;

  for (const m of weekly.metrics) {
    await db.forecastSnapshot.upsert({
      where: {
        periodType_periodStart_forecastKey: {
          periodType: "weekly",
          periodStart: weekStart,
          forecastKey: m.key,
        },
      },
      create: {
        periodType: "weekly",
        periodStart: weekStart,
        forecastKey: m.key,
        forecastLabel: m.label,
        forecastValue: m.projected,
        confidence: m.confidence,
      },
      update: {
        forecastLabel: m.label,
        forecastValue: m.projected,
        confidence: m.confidence,
      },
    });
    written++;
  }

  for (const m of monthly.metrics) {
    await db.forecastSnapshot.upsert({
      where: {
        periodType_periodStart_forecastKey: {
          periodType: "monthly",
          periodStart: monthStart,
          forecastKey: m.key,
        },
      },
      create: {
        periodType: "monthly",
        periodStart: monthStart,
        forecastKey: m.key,
        forecastLabel: m.label,
        forecastValue: m.projected,
        confidence: m.confidence,
      },
      update: {
        forecastLabel: m.label,
        forecastValue: m.projected,
        confidence: m.confidence,
      },
    });
    written++;
  }

  return {
    recordsWritten: written,
    weekStart: weekStart.toISOString().slice(0, 10),
    monthStart: monthStart.toISOString().slice(0, 10),
  };
}
