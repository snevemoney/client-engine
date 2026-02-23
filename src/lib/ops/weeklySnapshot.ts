/**
 * Weekly snapshot: persist Leverage Score + key metrics for 8-week trend.
 * Stored as artifact on system lead "Research Engine Runs", type weekly_snapshot.
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getCachedSystemLead, getCachedMoneyScorecard, getCachedConstraintSnapshot } from "./cached";
import { getLeverageScore } from "./leverageScore";

const ARTIFACT_TYPE = "weekly_snapshot";

export type WeeklySnapshotMeta = {
  weekEnding: string; // ISO date (e.g. Saturday)
  leverageScore: number;
  proposalWinRatePct: number | null;
  outcomesTrackedPct: number;
  dealsWon90d: number;
  bottleneckLabel: string | null;
  at: string;
};

export async function getWeeklySnapshotHistory(weeks: number = 8): Promise<WeeklySnapshotMeta[]> {
  const systemLeadId = await getCachedSystemLead();
  const artifacts = await db.artifact.findMany({
    where: { leadId: systemLeadId, type: ARTIFACT_TYPE },
    orderBy: { createdAt: "desc" },
    take: weeks,
    select: { meta: true },
  });
  const out: WeeklySnapshotMeta[] = [];
  for (const a of artifacts) {
    const m = a.meta as Record<string, unknown> | null;
    if (
      m &&
      typeof m.weekEnding === "string" &&
      typeof m.leverageScore === "number"
    ) {
      out.push({
        weekEnding: m.weekEnding,
        leverageScore: m.leverageScore,
        proposalWinRatePct: typeof m.proposalWinRatePct === "number" ? m.proposalWinRatePct : null,
        outcomesTrackedPct: typeof m.outcomesTrackedPct === "number" ? m.outcomesTrackedPct : 0,
        dealsWon90d: typeof m.dealsWon90d === "number" ? m.dealsWon90d : 0,
        bottleneckLabel: typeof m.bottleneckLabel === "string" ? m.bottleneckLabel : null,
        at: typeof m.at === "string" ? m.at : m.weekEnding,
      });
    }
  }
  return out.reverse();
}

export async function saveWeeklySnapshot(): Promise<WeeklySnapshotMeta> {
  const [leverage, money, constraint] = await Promise.all([
    getLeverageScore(),
    getCachedMoneyScorecard(),
    getCachedConstraintSnapshot(),
  ]);
  const weekEnding = new Date().toISOString().slice(0, 10);
  const meta: WeeklySnapshotMeta = {
    weekEnding,
    leverageScore: leverage.score,
    proposalWinRatePct: leverage.components.proposalWinRatePct,
    outcomesTrackedPct: leverage.components.outcomesTrackedPct,
    dealsWon90d: money.dealsWon90d ?? 0,
    bottleneckLabel: constraint?.label ?? null,
    at: new Date().toISOString(),
  };
  const systemLeadId = await getCachedSystemLead();
  const content = [
    `# Weekly Snapshot ${weekEnding}`,
    ``,
    `- Leverage Score: ${meta.leverageScore}`,
    `- Win rate: ${meta.proposalWinRatePct ?? "—"}%`,
    `- Outcomes tracked: ${meta.outcomesTrackedPct}%`,
    `- Deals won (90d): ${meta.dealsWon90d}`,
    meta.bottleneckLabel ? `- Bottleneck: ${meta.bottleneckLabel}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await db.artifact.create({
    data: {
      leadId: systemLeadId,
      type: ARTIFACT_TYPE,
      title: `WEEKLY_${weekEnding}`,
      content,
      meta: meta as Prisma.InputJsonValue,
    },
  });
  return meta;
}
