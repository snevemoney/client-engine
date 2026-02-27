/**
 * Phase 4.2: NBA Delivery Paths — action registry and runner.
 * Turns NBAs from informational into actionable items with buttons.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { completeNextAction, snoozeNextAction } from "./service";
import { computeAndStoreScore, type ScoreEntityType } from "@/lib/scoring/compute-and-store";
import { fetchRiskRuleContext } from "@/lib/risk/fetch-context";
import { evaluateRiskRules } from "@/lib/risk/rules";
import { upsertRiskFlags } from "@/lib/risk/service";
import { fetchNextActionContext } from "./fetch-context";
import { produceNextActions } from "./rules";
import type { NBAScope } from "./scope";
import { upsertNextActions, recordNextActionRun } from "./service";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta, sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { enqueueJob } from "@/lib/jobs/enqueue";

export type DeliveryActionDefinition = {
  label: string;
  confirmText?: string;
  uiHints?: "primary" | "secondary" | "danger" | "ghost";
  /** Dedupe key for idempotency (e.g. per-action per-day) */
  idempotencyKey: (nextAction: { id: string; dedupeKey: string; entityType?: string; entityId?: string }) => string;
  run: (params: {
    nextActionId: string;
    nextAction: { entityType: string; entityId: string; dedupeKey: string };
    actorUserId?: string;
  }) => Promise<{ success: boolean; errorCode?: string; errorMessage?: string; meta?: Record<string, unknown> }>;
};

const SNOOZE_1D_MS = 24 * 60 * 60 * 1000;

export const DELIVERY_ACTIONS: Record<string, DeliveryActionDefinition> = {
  mark_done: {
    label: "Mark done",
    uiHints: "primary",
    idempotencyKey: (n) => `nba:mark_done:${n.id}`,
    run: async ({ nextActionId }) => {
      await completeNextAction(nextActionId);
      return { success: true, meta: { action: "done" } };
    },
  },

  snooze_1d: {
    label: "Snooze 1 day",
    confirmText: "Hide this action for 1 day?",
    uiHints: "secondary",
    idempotencyKey: (n) => `nba:snooze_1d:${n.id}:${new Date().toISOString().slice(0, 10)}`,
    run: async ({ nextActionId }) => {
      const until = new Date(Date.now() + SNOOZE_1D_MS);
      await snoozeNextAction(nextActionId, until);
      return { success: true, meta: { snoozedUntil: until.toISOString() } };
    },
  },

  recompute_score: {
    label: "Recompute score",
    confirmText: "Refresh command center score now?",
    uiHints: "secondary",
    idempotencyKey: (n) => `nba:recompute_score:${n.entityType}:${n.entityId}:${Date.now().toString().slice(0, -4)}`,
    run: async ({ nextAction }) => {
      const raw = nextAction.entityType || "command_center";
      const entityType: ScoreEntityType =
        raw === "review_stream" || raw === "command_center" ? raw : "command_center";
      const entityId = nextAction.entityId || "command_center";
      const result = await computeAndStoreScore(entityType, entityId);
      return {
        success: true,
        meta: { snapshotId: result.snapshotId, score: result.score, band: result.band },
      };
    },
  },

  run_risk_rules: {
    label: "Run risk rules",
    confirmText: "Evaluate risk rules now?",
    uiHints: "secondary",
    idempotencyKey: (n) => `nba:run_risk_rules:${Date.now().toString().slice(0, -4)}`,
    run: async () => {
      const ctx = await fetchRiskRuleContext();
      const candidates = evaluateRiskRules(ctx);
      const result = await upsertRiskFlags(candidates);
      return {
        success: true,
        meta: { created: result.created, updated: result.updated },
      };
    },
  },

  run_next_actions: {
    label: "Run next actions",
    confirmText: "Regenerate next actions for this scope?",
    uiHints: "secondary",
    idempotencyKey: (n) => `nba:run_next_actions:${n.entityType}:${n.entityId}:${Date.now().toString().slice(0, -4)}`,
    run: async ({ nextAction, actorUserId }) => {
      const raw = nextAction.entityType || "command_center";
      const entityType: NBAScope =
        raw === "review_stream" || raw === "command_center" ? raw : "command_center";
      const entityId = nextAction.entityId || "command_center";
      const now = new Date();
      const ctx = await fetchNextActionContext({ now });
      const candidates = produceNextActions(ctx, entityType);
      const result = await upsertNextActions(candidates);
      const runKey = `nba:${actorUserId ?? "anon"}:${entityType}:${entityId}:${now.toISOString().slice(0, 10)}`;
      await recordNextActionRun(runKey, "manual", {
        created: result.created,
        updated: result.updated,
        candidateCount: candidates.length,
      });
      return {
        success: true,
        meta: { created: result.created, updated: result.updated, runKey },
      };
    },
  },

  retry_failed_deliveries: {
    label: "Retry failed deliveries",
    confirmText: "Enqueue retry job?",
    uiHints: "secondary",
    idempotencyKey: (n) => `nba:retry_failed_deliveries:${n.id}:${Date.now().toString().slice(0, -4)}`,
    run: async ({ nextActionId }) => {
      const { id } = await enqueueJob({
        jobType: "retry_failed_deliveries",
        payload: { nextActionId },
        sourceType: "nba_delivery",
        sourceId: nextActionId,
        dedupeKey: `retry_failed_deliveries:${nextActionId}`,
      });
      logOpsEventSafe({
        category: "system",
        eventKey: "nba.delivery.stubbed",
        meta: sanitizeMeta({
          actionKey: "retry_failed_deliveries",
          nextActionId,
          jobId: id,
        }),
      });
      return { success: true, meta: { jobId: id, stubbed: true } };
    },
  },
};

export type RunDeliveryActionInput = {
  nextActionId: string;
  actionKey: string;
  actorUserId?: string;
};

export type RunDeliveryActionResult = {
  ok: boolean;
  executionId?: string;
  errorCode?: string;
  errorMessage?: string;
};

/**
 * Run a delivery action: validate, execute, record execution, update NBA.
 */
export async function runDeliveryAction(input: RunDeliveryActionInput): Promise<RunDeliveryActionResult> {
  const { nextActionId, actionKey, actorUserId } = input;

  const def = DELIVERY_ACTIONS[actionKey];
  if (!def) {
    return { ok: false, errorCode: "unknown_action", errorMessage: `Unknown action: ${actionKey}` };
  }

  const nextAction = await db.nextBestAction.findUnique({
    where: { id: nextActionId },
    select: { id: true, entityType: true, entityId: true, dedupeKey: true },
  });
  if (!nextAction) {
    return { ok: false, errorCode: "not_found", errorMessage: "Next action not found" };
  }

  const idempotencyKey = def.idempotencyKey(nextAction);
  const recent = await db.nextActionExecution.findFirst({
    where: {
      nextActionId,
      actionKey,
      status: "success",
      startedAt: { gte: new Date(Date.now() - 60_000) },
    },
  });
  if (recent) {
    return { ok: true, executionId: recent.id };
  }

  const startedAt = new Date();
  let executionId: string | undefined;

  try {
    const result = await def.run({
      nextActionId,
      nextAction: {
        entityType: nextAction.entityType,
        entityId: nextAction.entityId,
        dedupeKey: nextAction.dedupeKey,
      },
      actorUserId,
    });

    const finishedAt = new Date();
    const status = result.success ? "success" : "failed";
    const metaJson = result.meta != null ? (sanitizeMeta(result.meta) as Prisma.InputJsonValue) : Prisma.JsonNull;

    const exec = await db.nextActionExecution.create({
      data: {
        nextActionId,
        actionKey,
        status,
        startedAt,
        finishedAt,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
        metaJson,
      },
    });
    executionId = exec.id;

    await db.nextBestAction.update({
      where: { id: nextActionId },
      data: {
        lastExecutedAt: finishedAt,
        lastExecutionStatus: status,
        lastExecutionErrorCode: result.errorCode ?? null,
        lastExecutionErrorMessage: result.errorMessage ?? null,
        updatedAt: finishedAt,
      },
    });

    logOpsEventSafe({
      category: "api_action",
      eventKey: "nba.delivery.executed",
      actorType: "user",
      actorId: actorUserId ?? undefined,
      meta: sanitizeMeta({
        nextActionId,
        actionKey,
        status,
        executionId: exec.id,
      }),
    });

    return {
      ok: result.success,
      executionId: exec.id,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    };
  } catch (err) {
    const errorMessage = sanitizeErrorMessage(err);
    const finishedAt = new Date();

    const exec = await db.nextActionExecution.create({
      data: {
        nextActionId,
        actionKey,
        status: "failed",
        startedAt,
        finishedAt,
        errorCode: "internal_error",
        errorMessage: errorMessage.slice(0, 500),
        metaJson: Prisma.JsonNull,
      },
    });
    executionId = exec.id;

    await db.nextBestAction.update({
      where: { id: nextActionId },
      data: {
        lastExecutedAt: finishedAt,
        lastExecutionStatus: "failed",
        lastExecutionErrorCode: "internal_error",
        lastExecutionErrorMessage: errorMessage.slice(0, 500),
        updatedAt: finishedAt,
      },
    });

    logOpsEventSafe({
      category: "api_action",
      eventKey: "nba.delivery.failed",
      status: "failure",
      actorType: "user",
      actorId: actorUserId ?? undefined,
      errorMessage,
      meta: sanitizeMeta({ nextActionId, actionKey, executionId: exec.id }),
    });

    return {
      ok: false,
      executionId: exec.id,
      errorCode: "internal_error",
      errorMessage,
    };
  }
}
