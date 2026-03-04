/**
 * Score calibration: AI score vs actual revenue for scatter plot.
 * Join Lead (score) + Project (leadId) + Outcome (projectId).
 */

import { db } from "@/lib/db";

export type ScoreCalibrationPoint = {
  leadId: string;
  projectId: string;
  score: number;
  actualRevenueCents: number;
};

export async function getScoreCalibrationData(): Promise<
  ScoreCalibrationPoint[]
> {
  const outcomes = await db.outcome.findMany({
    where: { actualRevenue: { not: null } },
    select: {
      projectId: true,
      actualRevenue: true,
      project: {
        select: {
          leadId: true,
          lead: { select: { score: true } },
        },
      },
    },
  });

  return outcomes
    .filter(
      (o) =>
        o.actualRevenue != null &&
        o.project?.leadId &&
        o.project.lead?.score != null
    )
    .map((o) => ({
      leadId: o.project!.leadId!,
      projectId: o.projectId,
      score: o.project!.lead!.score!,
      actualRevenueCents: o.actualRevenue!,
    }));
}
