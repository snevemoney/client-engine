/**
 * Phase 7.1: Operator memory ingestion — deterministic, non-blocking.
 */
import { db } from "@/lib/db";
import { OperatorMemorySourceType, OperatorMemoryOutcome } from "@prisma/client";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta, sanitizeErrorMessage } from "@/lib/ops-events/sanitize";

const WEIGHT_CLAMP = { min: -10, max: 10 };
const WEIGHT_DELTA = {
  success: 1,
  failure: -1,
  dismiss: -0.5,
  snooze: -0.25,
};

async function safeIngest(fn: () => Promise<void>, label: string): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[memory.ingest] ${label}:`, err);
    logOpsEventSafe({
      category: "system",
      eventKey: "memory.ingest.failed",
      status: "failure",
      errorMessage: sanitizeErrorMessage(err),
      meta: sanitizeMeta({ label }),
    });
  }
}

function clamp(weight: number): number {
  return Math.max(WEIGHT_CLAMP.min, Math.min(WEIGHT_CLAMP.max, weight));
}

async function upsertWeight(
  actorUserId: string,
  kind: "rule" | "action",
  key: string,
  delta: number,
  stats: { total?: number; successCount?: number; lastSeenAt?: string }
): Promise<void> {
  const existing = await db.operatorLearnedWeight.findUnique({
    where: {
      actorUserId_kind_key: { actorUserId, kind, key },
    },
  });

  const now = new Date();
  const newWeight = clamp((existing?.weight ?? 0) + delta);
  const prev = (existing?.statsJson as Record<string, unknown>) ?? {};
  const prevTotal = (prev.total as number) ?? 0;
  const prevSuccess = (prev.successCount as number) ?? 0;
  const statsJson = {
    total: prevTotal + (stats.total ?? 1),
    successCount: prevSuccess + (stats.successCount ?? (delta > 0 ? 1 : 0)),
    lastSeenAt: stats.lastSeenAt ?? now.toISOString(),
  };

  if (existing) {
    await db.operatorLearnedWeight.update({
      where: { id: existing.id },
      data: { weight: newWeight, statsJson, updatedAt: now },
    });
  } else {
    await db.operatorLearnedWeight.create({
      data: {
        actorUserId,
        kind,
        key,
        weight: newWeight,
        statsJson,
        updatedAt: now,
      },
    });
  }
}

/** Phase 7.3: Attribution outcome override when before/after context is available. */
export type AttributionOutcome = "improved" | "neutral" | "worsened";

/**
 * Ingest from NextActionExecution. Call after execution is persisted.
 * Phase 7.3: When attributionOutcome is provided, use it instead of success/failure.
 */
export async function ingestFromNextActionExecution(
  executionId: string,
  actorUserId: string,
  opts?: { attributionOutcome?: AttributionOutcome }
): Promise<void> {
  await safeIngest(async () => {
    const exec = await db.nextActionExecution.findUnique({
      where: { id: executionId },
      include: { nextAction: { select: { createdByRule: true, templateKey: true, dedupeKey: true } } },
    });
    if (!exec) return;

    let outcome: OperatorMemoryOutcome;
    if (opts?.attributionOutcome) {
      outcome =
        opts.attributionOutcome === "improved"
          ? "improved"
          : opts.attributionOutcome === "worsened"
            ? "worsened"
            : "neutral";
    } else {
      outcome =
        exec.status === "success" ? "success" : exec.status === "failed" ? "failure" : "neutral";
    }
    const ruleKey = exec.nextAction?.createdByRule ?? (exec.metaJson as Record<string, unknown>)?.ruleKey as string | undefined;
    const actionKey = exec.actionKey;

    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.nba_execute,
        entityType: null,
        entityId: null,
        ruleKey: ruleKey ?? null,
        actionKey: actionKey ?? null,
        outcome,
        metaJson: {
          executionId,
          nextActionId: exec.nextActionId,
          ruleKey: ruleKey ?? exec.nextAction?.createdByRule,
          templateKey: exec.nextAction?.templateKey,
          dedupeKey: exec.nextAction?.dedupeKey,
        },
      },
    });

    const delta =
      outcome === "success" || outcome === "improved"
        ? WEIGHT_DELTA.success
        : outcome === "failure" || outcome === "worsened"
          ? WEIGHT_DELTA.failure
          : 0;
    if (ruleKey && delta !== 0) {
      await upsertWeight(actorUserId, "rule", ruleKey, delta, {
        successCount: outcome === "success" || outcome === "improved" ? 1 : 0,
        total: 1,
        lastSeenAt: exec.startedAt.toISOString(),
      });
    }
    if (actionKey && delta !== 0) {
      await upsertWeight(actorUserId, "action", actionKey, delta, {
        successCount: outcome === "success" || outcome === "improved" ? 1 : 0,
        total: 1,
        lastSeenAt: exec.startedAt.toISOString(),
      });
    }
  }, "ingestFromNextActionExecution");
}

/**
 * Ingest from NBA dismiss (dismiss or don_t_suggest_again_30d).
 */
export async function ingestFromNextActionDismiss(
  nextActionId: string,
  actorUserId: string,
  preferenceId?: string
): Promise<void> {
  await safeIngest(async () => {
    const nba = await db.nextBestAction.findUnique({
      where: { id: nextActionId },
      select: { createdByRule: true, templateKey: true, dedupeKey: true },
    });
    if (!nba) return;

    const ruleKey = nba.createdByRule ?? "unknown";

    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.nba_dismiss,
        entityType: null,
        entityId: null,
        ruleKey,
        actionKey: "dismiss",
        outcome: OperatorMemoryOutcome.neutral,
        metaJson: {
          nextActionId,
          preferenceId: preferenceId ?? null,
          ruleKey,
          templateKey: nba.templateKey,
          dedupeKey: nba.dedupeKey,
        },
      },
    });

    await upsertWeight(actorUserId, "rule", ruleKey, WEIGHT_DELTA.dismiss, {
      total: 1,
      lastSeenAt: new Date().toISOString(),
    });
  }, "ingestFromNextActionDismiss");
}

/**
 * Ingest from NBA snooze.
 */
export async function ingestFromNextActionSnooze(
  nextActionId: string,
  actorUserId: string,
  ruleKey?: string
): Promise<void> {
  await safeIngest(async () => {
    const nba = ruleKey
      ? { createdByRule: ruleKey, templateKey: null, dedupeKey: null }
      : await db.nextBestAction.findUnique({
          where: { id: nextActionId },
          select: { createdByRule: true, templateKey: true, dedupeKey: true },
        });
    if (!nba) return;

    const rk = nba.createdByRule ?? "unknown";

    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.nba_snooze,
        entityType: null,
        entityId: null,
        ruleKey: rk,
        actionKey: "snooze_1d",
        outcome: OperatorMemoryOutcome.neutral,
        metaJson: { nextActionId, ruleKey: rk },
      },
    });

    await upsertWeight(actorUserId, "rule", rk, WEIGHT_DELTA.snooze, {
      total: 1,
      lastSeenAt: new Date().toISOString(),
    });
  }, "ingestFromNextActionSnooze");
}

/**
 * Ingest from CopilotActionLog. Call after action log is persisted.
 */
export async function ingestFromCopilotActionLog(
  actionLogId: string,
  actorUserId: string
): Promise<void> {
  await safeIngest(async () => {
    const log = await db.copilotActionLog.findUnique({
      where: { id: actionLogId },
    });
    if (!log || log.mode !== "execute") return;

    const outcome: OperatorMemoryOutcome =
      log.status === "success" ? "success" : log.status === "failed" ? "failure" : "neutral";

    const meta = (log.resultJson as Record<string, unknown>) ?? {};
    const ruleKey = (meta.ruleKey as string) ?? (meta.createdByRule as string) ?? null;
    const actionKey = log.actionKey ?? log.nbaActionKey ?? null;

    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.copilot_action,
        entityType: null,
        entityId: null,
        ruleKey,
        actionKey,
        outcome,
        metaJson: {
          actionLogId,
          sessionId: log.sessionId,
          nextActionId: log.nextActionId,
          nbaActionKey: log.nbaActionKey,
        },
      },
    });

    if (ruleKey && outcome !== "neutral") {
      const delta = outcome === "success" ? WEIGHT_DELTA.success : WEIGHT_DELTA.failure;
      await upsertWeight(actorUserId, "rule", ruleKey, delta, {
        successCount: outcome === "success" ? 1 : 0,
        total: 1,
        lastSeenAt: log.createdAt.toISOString(),
      });
    }
    if (actionKey && outcome !== "neutral") {
      const delta = outcome === "success" ? WEIGHT_DELTA.success : WEIGHT_DELTA.failure;
      await upsertWeight(actorUserId, "action", actionKey, delta, {
        successCount: outcome === "success" ? 1 : 0,
        total: 1,
        lastSeenAt: log.createdAt.toISOString(),
      });
    }
  }, "ingestFromCopilotActionLog");
}

/**
 * Ingest from FounderWeekReview. Parse misses/deltas for recurring ruleKeys.
 */
export async function ingestFromFounderWeekReview(
  weekId: string,
  actorUserId: string
): Promise<void> {
  await safeIngest(async () => {
    const review = await db.founderWeekReview.findUnique({
      where: { weekId },
    });
    if (!review) return;

    const misses = (review.missesJson as unknown[]) ?? [];
    const deltas = (review.deltasJson as unknown[]) ?? [];

    const ruleKeys = new Set<string>();
    for (const m of misses) {
      const s = typeof m === "string" ? m : (m as Record<string, unknown>)?.ruleKey ?? (m as Record<string, unknown>)?.title;
      if (typeof s === "string" && s.length > 0) ruleKeys.add(s);
    }
    for (const d of deltas) {
      const s = typeof d === "string" ? d : (d as Record<string, unknown>)?.ruleKey ?? (d as Record<string, unknown>)?.key;
      if (typeof s === "string" && s.length > 0) ruleKeys.add(s);
    }

    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.founder_review,
        entityType: "founder_week",
        entityId: weekId,
        ruleKey: null,
        actionKey: null,
        outcome: OperatorMemoryOutcome.neutral,
        metaJson: {
          weekId,
          ruleKeys: Array.from(ruleKeys),
          missesCount: misses.length,
          deltasCount: deltas.length,
        },
      },
    });

    for (const rk of ruleKeys) {
      await upsertWeight(actorUserId, "rule", rk, -0.25, {
        total: 1,
        lastSeenAt: new Date().toISOString(),
      });
    }
  }, "ingestFromFounderWeekReview");
}
