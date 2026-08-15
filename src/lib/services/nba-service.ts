/**
 * Phase 2: NBA (Next Best Action) service — summary, list, runRules.
 * Extracted from /api/next-actions routes for use by coach-tools and routes.
 */

import { db } from "@/lib/db";
import { NextActionPriority, NextActionStatus, RiskSourceType } from "@prisma/client";
import { fetchNextActionContext } from "@/lib/next-actions/fetch-context";
import { produceNextActions } from "@/lib/next-actions/rules";
import { filterByPreferences } from "@/lib/next-actions/preferences";
import { loadLearnedWeights } from "@/lib/memory/weights";
import { loadEffectivenessMap } from "@/lib/memory/effectiveness";
import { upsertNextActions, recordNextActionRun } from "@/lib/next-actions/service";
import { parseScope } from "@/lib/next-actions/scope";
import type { NBAScope } from "@/lib/next-actions/scope";

export type NBASummary = {
  top5: Array<{
    id: string;
    title: string;
    reason: string | null;
    priority: string;
    score: number;
    actionUrl: string | null;
    sourceType: string;
    explanationJson: unknown;
    templateKey: string | null;
  }>;
  queuedByPriority: { low: number; medium: number; high: number; critical: number };
  lastRunAt: string | null;
  entityType: NBAScope;
  entityId: string;
};

export async function getSummary(
  entityType: string | null,
  entityId: string | null
): Promise<NBASummary> {
  const scope = parseScope(entityType, entityId);

  const scopeWhere = { entityType: scope.entityType, entityId: scope.entityId, status: NextActionStatus.queued };
  const [top5, byPriority, lastRun] = await Promise.all([
    db.nextBestAction.findMany({
      where: scopeWhere,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        reason: true,
        priority: true,
        score: true,
        actionUrl: true,
        sourceType: true,
        explanationJson: true,
        templateKey: true,
      },
    }),
    db.nextBestAction.groupBy({
      by: ["priority"],
      where: scopeWhere,
      _count: { id: true },
    }),
    db.nextActionRun.findFirst({
      where: { runKey: { contains: `:${scope.entityType}:${scope.entityId}:` } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const g of byPriority) {
    counts[g.priority] = g._count.id;
  }

  return {
    top5: top5.map((a) => ({
      id: a.id,
      title: a.title,
      reason: a.reason,
      priority: a.priority,
      score: a.score,
      actionUrl: a.actionUrl,
      sourceType: a.sourceType,
      explanationJson: a.explanationJson,
      templateKey: a.templateKey ?? null,
    })),
    queuedByPriority: {
      low: counts[NextActionPriority.low] ?? 0,
      medium: counts[NextActionPriority.medium] ?? 0,
      high: counts[NextActionPriority.high] ?? 0,
      critical: counts[NextActionPriority.critical] ?? 0,
    },
    lastRunAt: lastRun?.createdAt?.toISOString() ?? null,
    entityType: scope.entityType,
    entityId: scope.entityId,
  };
}

export type NBAListOptions = {
  entityType?: string | null;
  entityId?: string | null;
  status?: NextActionStatus;
  priority?: NextActionPriority;
  sourceType?: RiskSourceType;
  search?: string;
  skip?: number;
  take?: number;
};

export type NBAItem = {
  id: string;
  title: string;
  reason: string | null;
  priority: string;
  score: number;
  status: string;
  sourceType: string;
  sourceId: string | null;
  actionUrl: string | null;
  payloadJson: unknown;
  explanationJson: unknown;
  createdByRule: string | null;
  dedupeKey: string | null;
  templateKey: string | null;
  entityType: string;
  entityId: string;
  snoozedUntil: string | null;
  lastExecutedAt: string | null;
  lastExecutionStatus: string | null;
  lastExecutionErrorCode: string | null;
  createdAt: string;
  completedAt: string | null;
  dismissedAt: string | null;
};

const VALID_STATUS = ["queued", "done", "dismissed"];
const VALID_PRIORITY = ["low", "medium", "high", "critical"];
const VALID_SOURCE: string[] = Object.values(RiskSourceType);

export async function list(options: NBAListOptions): Promise<{ items: NBAItem[]; total: number }> {
  const scope = parseScope(options.entityType ?? null, options.entityId ?? null);
  const now = new Date();

  const where: Record<string, unknown> = {
    entityType: scope.entityType,
    entityId: scope.entityId,
  };
  if (options.status && VALID_STATUS.includes(options.status)) {
    where.status = options.status;
  }
  if (!options.status || options.status === "queued") {
    where.OR = [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }];
  }
  if (options.priority && VALID_PRIORITY.includes(options.priority)) {
    where.priority = options.priority;
  }
  if (options.sourceType && VALID_SOURCE.includes(options.sourceType)) {
    where.sourceType = options.sourceType;
  }
  if (options.search?.trim()) {
    where.OR = [
      { title: { contains: options.search, mode: "insensitive" } },
      { reason: { contains: options.search, mode: "insensitive" } },
      { createdByRule: { contains: options.search, mode: "insensitive" } },
    ];
  }

  const skip = options.skip ?? 0;
  const take = options.take ?? 25;

  const [items, total] = await Promise.all([
    db.nextBestAction.findMany({
      where,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
    db.nextBestAction.count({ where }),
  ]);

  return {
    items: items.map((a) => ({
      id: a.id,
      title: a.title,
      reason: a.reason,
      priority: a.priority,
      score: a.score,
      status: a.status,
      sourceType: a.sourceType,
      sourceId: a.sourceId,
      actionUrl: a.actionUrl,
      payloadJson: a.payloadJson,
      explanationJson: a.explanationJson,
      createdByRule: a.createdByRule,
      dedupeKey: a.dedupeKey,
      templateKey: a.templateKey ?? null,
      entityType: a.entityType,
      entityId: a.entityId,
      snoozedUntil: a.snoozedUntil?.toISOString() ?? null,
      lastExecutedAt: a.lastExecutedAt?.toISOString() ?? null,
      lastExecutionStatus: a.lastExecutionStatus ?? null,
      lastExecutionErrorCode: a.lastExecutionErrorCode ?? null,
      createdAt: a.createdAt.toISOString(),
      completedAt: a.completedAt?.toISOString() ?? null,
      dismissedAt: a.dismissedAt?.toISOString() ?? null,
    })),
    total,
  };
}

export type RunNBAResult = {
  created: number;
  updated: number;
  runKey: string;
  lastRunAt: string;
};

export async function runRules(
  entityType: string | null,
  entityId: string | null,
  ownerUserId?: string
): Promise<RunNBAResult> {
  const scope = parseScope(entityType, entityId);
  const now = new Date();
  const runKey = `nba:${ownerUserId ?? "anon"}:${scope.entityType}:${scope.entityId}:${now.toISOString().slice(0, 10)}`;

  const ownerUserIdForContext =
    scope.entityType === "founder_growth" ? ownerUserId : undefined;
  const ctx = await fetchNextActionContext({ now, ownerUserId: ownerUserIdForContext });
  const [learnedWeights, effectivenessByRuleKey] =
    ownerUserId
      ? await Promise.all([loadLearnedWeights(ownerUserId), loadEffectivenessMap(ownerUserId)])
      : [undefined, undefined];
  let candidates = produceNextActions(ctx, scope.entityType, learnedWeights, effectivenessByRuleKey);
  candidates = await filterByPreferences(candidates, scope.entityType, scope.entityId);
  const result = await upsertNextActions(candidates);
  await recordNextActionRun(runKey, "manual", {
    created: result.created,
    updated: result.updated,
    candidateCount: candidates.length,
  });

  return {
    created: result.created,
    updated: result.updated,
    runKey,
    lastRunAt: now.toISOString(),
  };
}
