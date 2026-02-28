/**
 * Phase 6.2: POST /api/internal/founder/os/week/suggest — Deterministic suggestions.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { RiskStatus, NextActionStatus, LeadStatus } from "@prisma/client";
import { buildWeekSuggestions } from "@/lib/founder/os/suggest-week";

export const dynamic = "force-dynamic";

const ENTITY = { entityType: "command_center", entityId: "command_center" };

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/internal/founder/os/week/suggest", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session.user?.id);
    const rl = rateLimitByKey({
      key: `rl:founder-os-suggest:${clientKey}`,
      windowMs: 60_000,
      max: 10,
    });
    if (!rl.ok) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return jsonError("Rate limit exceeded. Try again in a minute.", 429, undefined, {
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "private, no-store" },
        bodyExtra: { retryAfterSeconds: retryAfter },
      });
    }

    try {
      const since7d = new Date();
      since7d.setDate(since7d.getDate() - 7);

      const [
        scoreLatest,
        riskTop,
        nbaTop,
        pipelineSnapshot,
        copilotActions,
        nbaExecutions,
      ] = await Promise.all([
        db.scoreSnapshot.findFirst({
          where: { entityType: ENTITY.entityType, entityId: ENTITY.entityId },
          orderBy: { computedAt: "desc" },
          select: { id: true, score: true, band: true, computedAt: true },
        }),
        db.riskFlag.findMany({
          where: { status: RiskStatus.open },
          orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
          take: 5,
          select: {
            id: true,
            title: true,
            severity: true,
            createdByRule: true,
          },
        }),
        db.nextBestAction.findMany({
          where: {
            entityType: ENTITY.entityType,
            entityId: ENTITY.entityId,
            status: NextActionStatus.queued,
          },
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
        getPipelineSnapshot(),
        db.copilotActionLog.findMany({
          where: { mode: "execute", createdAt: { gte: since7d } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { actionKey: true, status: true },
        }),
        db.nextActionExecution.findMany({
          where: { startedAt: { gte: since7d } },
          orderBy: { startedAt: "desc" },
          take: 10,
          select: { actionKey: true, status: true },
        }),
      ]);

      const byStage = pipelineSnapshot?.byStage ?? {};
      const stuckOver7d = pipelineSnapshot?.stuckOver7d ?? 0;
      const noNextStep = pipelineSnapshot?.noNextStep ?? 0;

      const summary = {
        score: {
          latest: scoreLatest
            ? {
                id: scoreLatest.id,
                score: scoreLatest.score,
                band: scoreLatest.band,
                computedAt: scoreLatest.computedAt.toISOString(),
              }
            : null,
        },
        risk: {
          summary: { openBySeverity: {} as Record<string, number> },
          topOpen5: riskTop.map((r) => ({
            id: r.id,
            title: r.title,
            severity: r.severity,
            createdByRule: r.createdByRule,
          })),
        },
        nba: {
          topQueued5: nbaTop.map((a) => ({
            id: a.id,
            title: a.title,
            reason: a.reason,
            priority: a.priority,
            score: a.score,
            createdByRule: a.createdByRule,
            dedupeKey: a.dedupeKey,
          })),
        },
        pipeline: {
          byStage,
          stuckOver7d,
          noNextStep,
        },
        execution: {
          recentCopilotActions: copilotActions.map((a) => ({
            actionKey: a.actionKey,
            status: a.status,
          })),
          recentNextActionExecutions: nbaExecutions.map((e) => ({
            actionKey: e.actionKey,
            status: e.status,
          })),
        },
      };

      const suggestions = buildWeekSuggestions(summary);

      return NextResponse.json({
        topOutcomes: suggestions.topOutcomes,
        milestones: suggestions.milestones,
        focusConstraint: suggestions.focusConstraint,
      });
    } catch (err) {
      console.error("[founder/os/week/suggest]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}

async function getPipelineSnapshot(): Promise<{
  byStage: Record<string, number>;
  stuckOver7d: number;
  noNextStep: number;
} | null> {
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
