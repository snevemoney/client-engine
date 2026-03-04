/**
 * Outcome scorecard: win rate by source/score bucket, quoted vs actual revenue,
 * time-to-close, channel performance. Powers /dashboard/scorecard.
 */

import { db } from "@/lib/db";

const RECENT_DAYS = 365;

export type WinRateBySource = {
  source: string;
  won: number;
  lost: number;
  winRate: number;
};

export type WinRateByScoreBucket = {
  bucket: string;
  won: number;
  lost: number;
  winRate: number;
};

export type QuotedVsActual = {
  projectId: string;
  leadId: string;
  projectName: string;
  quotedCents: number | null;
  actualCents: number | null;
  variancePct: number | null;
};

export type OutcomeScorecard = {
  at: string;
  winRateBySource: WinRateBySource[];
  winRateByScoreBucket: WinRateByScoreBucket[];
  quotedVsActual: QuotedVsActual[];
  timeToCloseMedianDays: number | null;
  channelPerformance: WinRateBySource[];
};

function getScoreBucket(score: number | null): string {
  if (score == null) return "unscored";
  if (score <= 33) return "0-33";
  if (score <= 66) return "34-66";
  return "67-100";
}

export async function getOutcomeScorecard(): Promise<OutcomeScorecard> {
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

  const leads = await db.lead.findMany({
    where: {
      OR: [{ dealOutcome: "won" }, { dealOutcome: "lost" }],
      proposalSentAt: { not: null },
      updatedAt: { gte: since },
    },
    take: 500,
    select: {
      id: true,
      source: true,
      score: true,
      dealOutcome: true,
      proposalSentAt: true,
      updatedAt: true,
    },
  });

  const projects = await db.project.findMany({
    where: { leadId: { in: leads.map((l) => l.id) } },
    select: {
      id: true,
      leadId: true,
      name: true,
      paymentAmount: true,
      lead: { select: { id: true } },
    },
  });

  const projectIds = projects.map((p) => p.id);
  const outcomes = await db.outcome.findMany({
    where: { projectId: { in: projectIds } },
    select: { projectId: true, actualRevenue: true },
  });
  const outcomeByProject = new Map(outcomes.map((o) => [o.projectId, o]));

  const won = leads.filter((l) => l.dealOutcome === "won");
  const lost = leads.filter((l) => l.dealOutcome === "lost");

  const sourceCounts = new Map<string, { won: number; lost: number }>();
  for (const l of [...won, ...lost]) {
    const src = l.source || "unknown";
    const c = sourceCounts.get(src) ?? { won: 0, lost: 0 };
    if (l.dealOutcome === "won") c.won++;
    else c.lost++;
    sourceCounts.set(src, c);
  }
  const winRateBySource: WinRateBySource[] = Array.from(sourceCounts.entries())
    .map(([source, { won: w, lost: l }]) => ({
      source,
      won: w,
      lost: l,
      winRate: w + l > 0 ? Math.round((w / (w + l)) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.won + b.lost - (a.won + a.lost));

  const bucketCounts = new Map<string, { won: number; lost: number }>();
  for (const l of [...won, ...lost]) {
    const bucket = getScoreBucket(l.score);
    const c = bucketCounts.get(bucket) ?? { won: 0, lost: 0 };
    if (l.dealOutcome === "won") c.won++;
    else c.lost++;
    bucketCounts.set(bucket, c);
  }
  const bucketOrder = ["0-33", "34-66", "67-100", "unscored"];
  const winRateByScoreBucket: WinRateByScoreBucket[] = bucketOrder
    .filter((b) => bucketCounts.has(b))
    .map((bucket) => {
      const { won: w, lost: l } = bucketCounts.get(bucket)!;
      return {
        bucket,
        won: w,
        lost: l,
        winRate: w + l > 0 ? Math.round((w / (w + l)) * 1000) / 10 : 0,
      };
    });

  const quotedVsActual: QuotedVsActual[] = projects
    .filter((p) => p.leadId && outcomeByProject.has(p.id))
    .map((p) => {
      const outcome = outcomeByProject.get(p.id)!;
      const quotedCents =
        p.paymentAmount != null
          ? Math.round(Number(p.paymentAmount) * 100)
          : null;
      const actualCents = outcome.actualRevenue;
      let variancePct: number | null = null;
      if (
        quotedCents != null &&
        quotedCents > 0 &&
        actualCents != null
      ) {
        variancePct =
          Math.round(((actualCents - quotedCents) / quotedCents) * 1000) / 10;
      }
      return {
        projectId: p.id,
        leadId: p.leadId!,
        projectName: p.name,
        quotedCents,
        actualCents,
        variancePct,
      };
    })
    .sort((a, b) => (b.actualCents ?? 0) - (a.actualCents ?? 0));

  const sentToOutcome = [...won, ...lost].filter(
    (l) => l.proposalSentAt && l.updatedAt
  );
  const timeToCloseMs = sentToOutcome.map(
    (l) => +new Date(l.updatedAt!) - +new Date(l.proposalSentAt!)
  );
  const timeToCloseMedianDays =
    timeToCloseMs.length > 0
      ? Math.round(
          (timeToCloseMs.sort((a, b) => a - b)[
            Math.floor(timeToCloseMs.length / 2)
          ]! /
            (24 * 60 * 60 * 1000)) *
            10
        ) / 10
      : null;

  return {
    at: new Date().toISOString(),
    winRateBySource,
    winRateByScoreBucket,
    quotedVsActual,
    timeToCloseMedianDays,
    channelPerformance: winRateBySource,
  };
}
