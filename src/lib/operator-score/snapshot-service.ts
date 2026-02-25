/**
 * Phase 2.8.4: Operator score snapshot service — shared by route and job handler.
 */

import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getMonthStart } from "@/lib/operator-score/trends";
import { fetchOperatorScoreInput } from "@/lib/operator-score/fetch-input";
import { computeOperatorScore } from "@/lib/operator-score/score";

export type CaptureOperatorScoreSnapshotResult = {
  recordsWritten: number;
  weekStart: string;
  monthStart: string;
};

export async function captureOperatorScoreSnapshot(nowOverride?: Date): Promise<CaptureOperatorScoreSnapshotResult> {
  const now = nowOverride ?? new Date();
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);

  const [weeklyInput, monthlyInput] = await Promise.all([
    fetchOperatorScoreInput("weekly"),
    fetchOperatorScoreInput("monthly"),
  ]);

  const weekly = computeOperatorScore(weeklyInput);
  const monthly = computeOperatorScore(monthlyInput);

  const records = [
    { periodType: "weekly" as const, periodStart: weekStart, result: weekly },
    { periodType: "monthly" as const, periodStart: monthStart, result: monthly },
  ];

  for (const r of records) {
    await db.operatorScoreSnapshot.upsert({
      where: {
        periodType_periodStart: {
          periodType: r.periodType,
          periodStart: r.periodStart,
        },
      },
      create: {
        periodType: r.periodType,
        periodStart: r.periodStart,
        score: r.result.score,
        grade: r.result.grade,
        summary: r.result.summary,
        breakdownJson: r.result.breakdown as object,
      },
      update: {
        score: r.result.score,
        grade: r.result.grade,
        summary: r.result.summary,
        breakdownJson: r.result.breakdown as object,
      },
    });
  }

  return {
    recordsWritten: records.length,
    weekStart: weekStart.toISOString().slice(0, 10),
    monthStart: monthStart.toISOString().slice(0, 10),
  };
}
