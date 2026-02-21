/**
 * System scorecard: inputs, process, outputs from real data.
 * No new DB tables; computed from leads, pipeline runs, artifacts.
 */

import { db } from "@/lib/db";
import type { ScorecardSnapshot } from "./types";

const RECENT_DAYS = 14;

export async function getScorecardSnapshot(): Promise<ScorecardSnapshot> {
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

  const [leads, stepStats, runs] = await Promise.all([
    db.lead.findMany({
      where: { createdAt: { gte: since } },
      select: {
        source: true,
        status: true,
        enrichedAt: true,
        scoredAt: true,
        approvedAt: true,
        buildStartedAt: true,
        buildCompletedAt: true,
        dealOutcome: true,
        createdAt: true,
        artifacts: { select: { type: true, title: true } },
        project: { select: { id: true } },
      },
    }),
    db.pipelineStepRun.groupBy({
      by: ["stepName", "success"],
      where: { run: { startedAt: { gte: since } } },
      _count: true,
    }),
    db.pipelineRun.findMany({
      where: { startedAt: { gte: since } },
      select: { retryCount: true },
    }),
  ]);

  const bySource: Record<string, number> = {};
  for (const l of leads) {
    bySource[l.source] = (bySource[l.source] ?? 0) + 1;
  }

  const byStep: Record<string, { total: number; ok: number; pct: number }> = {};
  for (const { stepName, success, _count } of stepStats) {
    if (!byStep[stepName]) byStep[stepName] = { total: 0, ok: 0, pct: 0 };
    byStep[stepName].total += _count;
    if (success) byStep[stepName].ok += _count;
  }
  for (const k of Object.keys(byStep)) {
    const s = byStep[k]!;
    s.pct = s.total ? Math.round((s.ok / s.total) * 100) : 0;
  }

  const withEnrich = leads.filter((l) =>
    l.artifacts.some((a) => a.type === "notes" && a.title === "AI Enrichment Report")
  );
  const withProposal = leads.filter((l) => l.artifacts.some((a) => a.type === "proposal"));
  const approved = leads.filter((l) => l.approvedAt != null);
  const buildStarted = leads.filter((l) => l.buildStartedAt != null);
  const projectsCreated = leads.filter((l) => l.project != null).length;
  const won = leads.filter((l) => l.dealOutcome === "won").length;
  const lost = leads.filter((l) => l.dealOutcome === "lost").length;

  const retryCounts = runs.reduce((acc, r) => acc + r.retryCount, 0);

  const avgTimeInStageMs: Record<string, number | null> = {};
  const enrichedDeltas = withEnrich
    .filter((l) => l.enrichedAt && l.createdAt)
    .map((l) => +new Date(l.enrichedAt!) - +new Date(l.createdAt));
  avgTimeInStageMs.enrichment = enrichedDeltas.length
    ? Math.round(enrichedDeltas.reduce((a, b) => a + b, 0) / enrichedDeltas.length)
    : null;
  const scoredDeltas = leads
    .filter((l) => l.scoredAt && l.enrichedAt)
    .map((l) => +new Date(l.scoredAt!) - +new Date(l.enrichedAt!));
  avgTimeInStageMs.scoring = scoredDeltas.length
    ? Math.round(scoredDeltas.reduce((a, b) => a + b, 0) / scoredDeltas.length)
    : null;

  const totalLeads = leads.length;
  const enrichmentCoverage = totalLeads ? Math.round((withEnrich.length / totalLeads) * 100) : 0;

  return {
    at: new Date().toISOString(),
    inputs: {
      discovered: leads.length,
      created: leads.length,
      bySource,
      enrichmentCoveragePct: enrichmentCoverage,
    },
    process: {
      byStep,
      avgTimeInStageMs,
      retryCounts,
    },
    outputs: {
      proposalsGenerated: withProposal.length,
      approvals: approved.length,
      buildsCreated: buildStarted.length,
      projectsCreated,
      won,
      lost,
    },
  };
}
