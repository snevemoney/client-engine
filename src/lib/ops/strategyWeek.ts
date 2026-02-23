/**
 * Strategy Quadrant: weekly planning and review.
 * Week start = Monday 00:00 (ISO week).
 */

import { db } from "@/lib/db";
import { getWeekStart } from "./weekStart";

export { getWeekStart } from "./weekStart";
export const PHASES = ["survival", "formulation", "explosion", "plateau"] as const;
export type Phase = (typeof PHASES)[number];

export type StrategyWeekSummary = {
  weekStart: string;
  phase: string | null;
  activeCampaignName: string | null;
  operatorImprovementFocus: string | null;
  salesTarget: string | null;
  reviewChecks: number;
};

/** Fetch current week for Command Center snapshot */
export async function getCurrentStrategyWeek(): Promise<StrategyWeekSummary | null> {
  const weekStart = getWeekStart();
  const record = await db.strategyWeek.findUnique({
    where: { weekStart },
    include: { review: true },
  });
  if (!record) return null;
  return {
    weekStart: record.weekStart.toISOString(),
    phase: record.phase,
    activeCampaignName: record.activeCampaignName,
    operatorImprovementFocus: record.operatorImprovementFocus,
    salesTarget: record.salesTarget,
    reviewChecks: record.review
      ? [record.review.campaignShipped, record.review.systemImproved, record.review.salesActionsDone, record.review.proofCaptured].filter(Boolean).length
      : 0,
  };
}
