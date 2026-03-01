/**
 * GET /api/internal/execution/metrics — Aggregate execution intelligence.
 * Returns agent performance, pipeline health, NBA stats, and time-to-cash
 * computed from existing tables (no new models needed).
 *
 * Query params:
 *   ?days=7 (default) — rolling window for most metrics
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Sonnet pricing: $3/M input, $15/M output
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/internal/execution/metrics", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const days = Math.min(Number(req.nextUrl.searchParams.get("days") ?? 7), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [agents, pipeline, nba, timeToCash] = await Promise.all([
      getAgentMetrics(since),
      getPipelineMetrics(since),
      getNbaMetrics(today),
      getTimeToCashMetrics(),
    ]);

    // FlywheelRun may not exist yet (needs prisma generate + restart)
    let flywheel;
    try { flywheel = await getFlywheelMetrics(since); } catch { flywheel = null; }

    return NextResponse.json({ days, since: since.toISOString(), agents, pipeline, nba, timeToCash, flywheel });
  });
}

async function getAgentMetrics(since: Date) {
  const runs = await db.agentRun.findMany({
    where: { startedAt: { gte: since } },
    select: {
      agentId: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      tokenUsage: true,
    },
  });

  const total = runs.length;
  const completed = runs.filter((r) => r.status === "completed").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const successRate = total > 0 ? Math.round((completed / (completed + failed || 1)) * 100) : null;

  let totalDurationMs = 0;
  let durationCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const byAgent: Record<string, { runs: number; completed: number; failed: number; totalDurationMs: number; durationCount: number }> = {};

  for (const r of runs) {
    // Parse token usage
    const usage = r.tokenUsage as { inputTokens?: number; outputTokens?: number } | null;
    if (usage) {
      totalInputTokens += usage.inputTokens ?? 0;
      totalOutputTokens += usage.outputTokens ?? 0;
    }

    // Duration
    if (r.finishedAt && r.startedAt) {
      const d = r.finishedAt.getTime() - r.startedAt.getTime();
      totalDurationMs += d;
      durationCount++;

      const agent = byAgent[r.agentId] ?? (byAgent[r.agentId] = { runs: 0, completed: 0, failed: 0, totalDurationMs: 0, durationCount: 0 });
      agent.totalDurationMs += d;
      agent.durationCount++;
    }

    const agent = byAgent[r.agentId] ?? (byAgent[r.agentId] = { runs: 0, completed: 0, failed: 0, totalDurationMs: 0, durationCount: 0 });
    agent.runs++;
    if (r.status === "completed") agent.completed++;
    if (r.status === "failed") agent.failed++;
  }

  const totalTokens = totalInputTokens + totalOutputTokens;
  const estimatedCost = totalInputTokens * INPUT_COST_PER_TOKEN + totalOutputTokens * OUTPUT_COST_PER_TOKEN;

  const byAgentSummary: Record<string, { runs: number; successRate: number | null; avgDurationMs: number | null }> = {};
  for (const [id, a] of Object.entries(byAgent)) {
    byAgentSummary[id] = {
      runs: a.runs,
      successRate: a.runs > 0 ? Math.round((a.completed / (a.completed + a.failed || 1)) * 100) : null,
      avgDurationMs: a.durationCount > 0 ? Math.round(a.totalDurationMs / a.durationCount) : null,
    };
  }

  return {
    totalRuns: total,
    successRate,
    avgDurationMs: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : null,
    totalTokens,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    byAgent: byAgentSummary,
  };
}

async function getPipelineMetrics(since: Date) {
  const [total, succeeded, failed] = await Promise.all([
    db.pipelineRun.count({ where: { startedAt: { gte: since } } }),
    db.pipelineRun.count({ where: { success: true, startedAt: { gte: since } } }),
    db.pipelineRun.count({ where: { success: false, startedAt: { gte: since } } }),
  ]);

  // Compute average duration from completed runs
  const completedRuns = await db.pipelineRun.findMany({
    where: { startedAt: { gte: since }, finishedAt: { not: null } },
    select: { startedAt: true, finishedAt: true },
  });
  let totalDurationMs = 0;
  for (const r of completedRuns) {
    if (r.finishedAt) totalDurationMs += r.finishedAt.getTime() - r.startedAt.getTime();
  }

  return {
    totalRuns: total,
    successRate: total > 0 ? Math.round((succeeded / total) * 100) : null,
    avgDurationMs: completedRuns.length > 0 ? Math.round(totalDurationMs / completedRuns.length) : null,
    succeeded,
    failed,
  };
}

async function getNbaMetrics(today: Date) {
  const [pending, completedToday] = await Promise.all([
    db.nextBestAction.count({ where: { status: "queued" } }),
    db.nextBestAction.count({ where: { status: "done", updatedAt: { gte: today } } }),
  ]);

  // Average score of completed actions (all time, recent 100)
  const recentDone = await db.nextBestAction.findMany({
    where: { status: "done" },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { score: true },
  });
  const avgScore = recentDone.length > 0
    ? Math.round(recentDone.reduce((sum, a) => sum + a.score, 0) / recentDone.length)
    : null;

  return { pendingCount: pending, completedToday, avgScoreCompleted: avgScore };
}

async function getTimeToCashMetrics() {
  // Leads with wonAt set (last 90 days for meaningful sample)
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const wonLeads = await db.lead.findMany({
    where: { wonAt: { not: null, gte: since90d } },
    select: { createdAt: true, wonAt: true },
  });

  if (wonLeads.length === 0) {
    return { avgDays: null, medianDays: null, deals: 0 };
  }

  const daysList = wonLeads
    .map((l) => {
      if (!l.wonAt) return null;
      return (l.wonAt.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    })
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);

  const avgDays = Math.round((daysList.reduce((s, d) => s + d, 0) / daysList.length) * 10) / 10;
  const medianDays = Math.round(daysList[Math.floor(daysList.length / 2)] * 10) / 10;

  return { avgDays, medianDays, deals: daysList.length };
}

async function getFlywheelMetrics(since: Date) {
  const runs = await db.flywheelRun.findMany({
    where: { createdAt: { gte: since } },
    select: { status: true, totalDurationMs: true, failedStep: true },
  });

  const total = runs.length;
  const completed = runs.filter((r) => r.status === "completed").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : null;

  const durations = runs
    .map((r) => r.totalDurationMs)
    .filter((d): d is number => d !== null);
  const avgDurationMs = durations.length > 0
    ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
    : null;

  // Count which steps fail most often
  const failedSteps: Record<string, number> = {};
  for (const r of runs) {
    if (r.failedStep) {
      failedSteps[r.failedStep] = (failedSteps[r.failedStep] ?? 0) + 1;
    }
  }

  return {
    totalRuns: total,
    completed,
    failed,
    successRate,
    avgDurationMs,
    failedSteps,
  };
}
