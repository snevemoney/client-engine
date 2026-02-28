/**
 * Phase 6.1: GET /api/internal/founder/summary — Founder Mode aggregate.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { RiskStatus, NextActionStatus, LeadStatus } from "@prisma/client";
import { pickTopMoves } from "@/lib/founder/today-plan";

export const dynamic = "force-dynamic";

const ENTITY = { entityType: "command_center", entityId: "command_center" };

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/founder/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") ?? ENTITY.entityType;
    const entityId = searchParams.get("entityId") ?? ENTITY.entityId;

    try {
      return await withSummaryCache(
        `founder/summary:${entityType}:${entityId}`,
        async () => {
          try {
            return await buildFounderSummary(entityType, entityId);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("groupBy") || msg.includes("Cannot read properties of undefined")) {
              console.warn("[founder/summary] DB init issue, returning fallback:", msg);
              return buildFounderSummaryFallback(entityType, entityId);
            }
            throw err;
          }
        },
        15_000
      );
    } catch (err) {
      console.error("[founder/summary]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}

async function buildFounderSummary(entityType: string, entityId: string) {
  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);

  const [
    scoreLatest,
    scorePrevious,
    scoreHistory,
    riskSummary,
    riskLastRun,
    riskTop,
    nbaTop,
    nbaSummary,
    pipelineSnapshot,
    copilotActions,
    nbaExecutions,
    lastJobRuns,
  ] = await Promise.all([
            db.scoreSnapshot.findFirst({
              where: { entityType, entityId },
              orderBy: { computedAt: "desc" },
            }),
            db.scoreSnapshot.findMany({
              where: { entityType, entityId },
              orderBy: { computedAt: "desc" },
              skip: 1,
              take: 1,
            }),
            db.scoreSnapshot.findMany({
              where: { entityType, entityId, computedAt: { gte: since7d } },
              orderBy: { computedAt: "asc" },
              select: { id: true, score: true, band: true, computedAt: true },
            }),
            db.riskFlag.groupBy({
              by: ["severity"],
              where: { status: RiskStatus.open },
              _count: { id: true },
            }),
            db.riskFlag.findFirst({
              where: {},
              orderBy: { updatedAt: "desc" },
              select: { updatedAt: true },
            }),
            db.riskFlag.findMany({
              where: { status: RiskStatus.open },
              orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
              take: 5,
              select: {
                id: true,
                title: true,
                severity: true,
                status: true,
                createdByRule: true,
              },
            }),
            db.nextBestAction.findMany({
              where: { entityType, entityId, status: NextActionStatus.queued },
              orderBy: [{ score: "desc" }, { createdAt: "desc" }],
              take: 5,
              select: {
                id: true,
                title: true,
                reason: true,
                priority: true,
                score: true,
                createdByRule: true,
                dedupeKey: true,
              },
            }),
            db.nextBestAction.groupBy({
              by: ["priority"],
              where: { entityType, entityId, status: NextActionStatus.queued },
              _count: { id: true },
            }),
            getPipelineSnapshot().catch((e) => {
              console.error("[founder/summary] getPipelineSnapshot failed:", e);
              return null;
            }),
            db.copilotActionLog.findMany({
              where: { mode: "execute", createdAt: { gte: since7d } },
              orderBy: { createdAt: "desc" },
              take: 10,
              include: { session: { select: { id: true } } },
            }),
            db.nextActionExecution.findMany({
              orderBy: { startedAt: "desc" },
              take: 10,
              include: { nextAction: { select: { id: true, title: true } } },
            }),
            db.jobRun.findMany({
              where: { startedAt: { gte: since7d } },
              orderBy: { startedAt: "desc" },
              take: 5,
              select: { id: true, jobType: true, status: true, startedAt: true, finishedAt: true },
            }),
          ]);

          const prevSnapshot = scorePrevious[0] ?? null;
          const bySeverity: Record<string, number> = {};
          for (const g of riskSummary) {
            bySeverity[g.severity] = g._count.id;
          }
          const nbaCounts: Record<string, number> = {};
          for (const g of nbaSummary) {
            nbaCounts[g.priority] = g._count.id;
          }

          const score = {
            latest: scoreLatest
              ? {
                  id: scoreLatest.id,
                  score: scoreLatest.score,
                  band: scoreLatest.band,
                  delta: scoreLatest.delta,
                  computedAt: scoreLatest.computedAt.toISOString(),
                }
              : null,
            previous: prevSnapshot
              ? {
                  score: prevSnapshot.score,
                  band: prevSnapshot.band,
                  computedAt: prevSnapshot.computedAt.toISOString(),
                }
              : null,
            history7d: scoreHistory.map((s) => ({
              id: s.id,
              score: s.score,
              band: s.band,
              computedAt: s.computedAt.toISOString(),
            })),
          };

          const risk = {
            summary: {
              openBySeverity: {
                low: bySeverity.low ?? 0,
                medium: bySeverity.medium ?? 0,
                high: bySeverity.high ?? 0,
                critical: bySeverity.critical ?? 0,
              },
              lastRunAt: riskLastRun?.updatedAt.toISOString() ?? null,
            },
            topOpen5: riskTop.map((r) => ({
              id: r.id,
              title: r.title,
              severity: r.severity,
              status: r.status,
              ruleKey: r.createdByRule,
            })),
          };

          const nba = {
            summary: {
              queuedByPriority: {
                low: nbaCounts.low ?? 0,
                medium: nbaCounts.medium ?? 0,
                high: nbaCounts.high ?? 0,
                critical: nbaCounts.critical ?? 0,
              },
              lastRunAt: null as string | null,
            },
            topQueued5: nbaTop.map((a) => ({
              id: a.id,
              title: a.title,
              reason: a.reason,
              priority: a.priority,
              score: a.score,
              ruleKey: a.createdByRule,
              dedupeKey: a.dedupeKey,
            })),
          };

          const lastRun = await db.nextActionRun.findFirst({
            where: { runKey: { contains: `:${entityType}:${entityId}:` } },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          });
          nba.summary.lastRunAt = lastRun?.createdAt.toISOString() ?? null;

          const todayPlan = pickTopMoves({
            score: {
              latest: score.latest
                ? {
                    id: score.latest.id,
                    score: score.latest.score,
                    band: score.latest.band,
                    computedAt: score.latest.computedAt,
                  }
                : null,
            },
            risk: {
              summary: risk.summary,
              top: risk.topOpen5.map((r) => ({
                id: r.id,
                title: r.title,
                severity: r.severity,
                ruleKey: r.ruleKey,
              })),
            },
            nba: {
              top: nba.topQueued5.map((a) => ({
                id: a.id,
                title: a.title,
                priority: a.priority,
                score: a.score,
                reason: a.reason,
                ruleKey: a.ruleKey,
                dedupeKey: a.dedupeKey ?? a.id,
              })),
            },
          });

          const execution = {
            recentCopilotActions: copilotActions.map((a) => ({
              id: a.id,
              actionKey: a.actionKey,
              status: a.status,
              createdAt: a.createdAt.toISOString(),
              sessionId: a.sessionId,
            })),
            recentNextActionExecutions: nbaExecutions.map((e) => ({
              id: e.id,
              actionKey: e.actionKey,
              status: e.status,
              startedAt: e.startedAt.toISOString(),
              nextActionId: e.nextActionId,
              nextActionTitle: e.nextAction?.title,
            })),
          };

          const system = {
            lastJobRuns: lastJobRuns.map((j) => ({
              id: j.id,
              jobType: j.jobType,
              status: j.status,
              startedAt: j.startedAt?.toISOString(),
              finishedAt: j.finishedAt?.toISOString(),
            })),
          };

          return {
            score,
            risk,
            nba,
            pipeline: pipelineSnapshot,
            execution,
            system,
            todayPlan,
            entityType,
            entityId,
          };
}

function buildFounderSummaryFallback(entityType: string, entityId: string) {
  return {
    score: {
      latest: null,
      previous: null,
      history7d: [],
    },
    risk: {
      summary: {
        openBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
        lastRunAt: null,
      },
      topOpen5: [],
    },
    nba: {
      summary: {
        queuedByPriority: { low: 0, medium: 0, high: 0, critical: 0 },
        lastRunAt: null,
      },
      topQueued5: [],
    },
    pipeline: null,
    execution: {
      recentCopilotActions: [],
      recentNextActionExecutions: [],
    },
    system: { lastJobRuns: [] },
    todayPlan: [],
    entityType,
    entityId,
  };
}

async function getPipelineSnapshot(): Promise<{
  byStage: Record<string, number>;
  stuckOver7d: number;
  noNextStep: number;
} | null> {
  if (!db.lead?.groupBy) return null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const activeWhere = {
    status: { notIn: [LeadStatus.REJECTED, LeadStatus.SHIPPED] },
    dealOutcome: { not: "won" },
  };

  const [byStage, stuck, noNextStep] = await Promise.all([
    db.lead.groupBy({
      by: ["status"],
      where: activeWhere,
      _count: { id: true },
    }),
    db.lead.count({
      where: {
        ...activeWhere,
        OR: [
          { lastContactAt: { lt: sevenDaysAgo } },
          { AND: [{ updatedAt: { lt: sevenDaysAgo } }, { lastContactAt: null }] },
        ],
      },
    }),
    db.lead.count({
      where: {
        ...activeWhere,
        OR: [
          { nextAction: null },
          { nextAction: "" },
          { nextActionDueAt: null },
        ],
      },
    }),
  ]);

  const byStageMap: Record<string, number> = {};
  for (const g of byStage) {
    byStageMap[g.status] = g._count.id;
  }

  return {
    byStage: byStageMap,
    stuckOver7d: stuck,
    noNextStep: noNextStep,
  };
}
