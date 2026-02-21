/**
 * Pat/Tom Weekly Scorecard: 5–7 KPIs that answer
 * "Is the system actually making me more money and more scalable?"
 * Use every Friday (or any day). Evidence only.
 *
 * Pat: deals, cash, turnaround, outcomes, reusable assets.
 * Tom: failures visible, run status (no silent failure).
 */

import { db } from "@/lib/db";
import { getMoneyScorecard } from "./moneyScorecard";
import { getLeverageScore } from "./leverageScore";
import { getFailuresAndInterventions } from "./failuresInterventions";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export type PatTomWeeklyScorecard = {
  at: string;
  /** One-sentence proof: "This week, the app helped me close X, collect $Y…" */
  sentence: string;
  /** Pat: deals closed in last 7d */
  dealsClosed7d: number;
  /** Pat: cash collected (operator-set) */
  cashCollected: number | null;
  /** Pat: median days proposal → close */
  turnaroundDays: number | null;
  /** Pat: % delivery leads with outcome tracked */
  clientOutcomesPct: number;
  /** Pat: % delivery leads with ≥1 reusable asset */
  reusableAssetsPct: number;
  /** Tom: total items in Failures & Interventions (visible = good) */
  failuresSurfaced: number;
  /** Tom: "ok" | "no_run_24h" */
  runStatus: "ok" | "no_run_24h";
};

export async function getPatTomWeeklyScorecard(): Promise<PatTomWeeklyScorecard> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

  const [money, leverage, failures, lastRun] = await Promise.all([
    getMoneyScorecard(),
    getLeverageScore(),
    getFailuresAndInterventions(),
    db.artifact.findFirst({
      where: {
        lead: { source: "system", title: "Research Engine Runs" },
        title: "WORKDAY_RUN_REPORT",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const dealsClosed7d = await db.lead.count({
    where: {
      dealOutcome: "won",
      updatedAt: { gte: sevenDaysAgo },
    },
  });

  const runStatus: "ok" | "no_run_24h" =
    lastRun && now.getTime() - new Date(lastRun.createdAt).getTime() < TWENTY_FOUR_HOURS_MS
      ? "ok"
      : "no_run_24h";

  const cashStr =
    money.cashCollected != null ? `$${money.cashCollected.toLocaleString()}` : "—";
  const sentence =
    `This period: closed ${dealsClosed7d} deal(s), collected ${cashStr}, ` +
    `${leverage.components.outcomesTrackedPct}% outcomes tracked, ` +
    `${leverage.components.reusableAssetPct}% with reusable assets — ` +
    `${failures.totalCount} item(s) in failure panel, run ${runStatus === "ok" ? "OK" : "no run 24h"}.`;

  return {
    at: now.toISOString(),
    sentence,
    dealsClosed7d,
    cashCollected: money.cashCollected ?? null,
    turnaroundDays: money.timeToCloseMedianDays ?? null,
    clientOutcomesPct: leverage.components.outcomesTrackedPct,
    reusableAssetsPct: leverage.components.reusableAssetPct,
    failuresSurfaced: failures.totalCount,
    runStatus,
  };
}
