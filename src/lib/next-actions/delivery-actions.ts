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
import { loadLearnedWeights } from "@/lib/memory/weights";
import { loadEffectivenessMap } from "@/lib/memory/effectiveness";
import { filterByPreferences } from "./preferences";
import type { NBAScope } from "./scope";
import { upsertNextActions, recordNextActionRun } from "./service";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta, sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { enqueueJob } from "@/lib/jobs/enqueue";
import {
  ingestFromNextActionExecution,
  ingestFromNextActionDismiss,
  ingestFromNextActionSnooze,
} from "@/lib/memory/ingest";
import {
  loadAttributionContext,
  computeAttributionDelta,
  recordAttribution,
  deltaToOutcome,
} from "@/lib/memory/attribution";

export type DeliveryActionDefinition = {
  label: string;
  confirmText?: string;
  uiHints?: "primary" | "secondary" | "danger" | "ghost";
  /** Dedupe key for idempotency (e.g. per-action per-day) */
  idempotencyKey: (nextAction: {
    id: string;
    dedupeKey: string;
    entityType?: string;
    entityId?: string;
    payloadJson?: Record<string, unknown> | null;
  }) => string;
  run: (params: {
    nextActionId: string;
    nextAction: {
      entityType: string;
      entityId: string;
      dedupeKey: string;
      createdByRule?: string;
      payloadJson?: Record<string, unknown> | null;
    };
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
    run: async ({ nextActionId, nextAction, actorUserId }) => {
      const until = new Date(Date.now() + SNOOZE_1D_MS);
      await snoozeNextAction(nextActionId, until);
      if (actorUserId) {
        ingestFromNextActionSnooze(nextActionId, actorUserId, nextAction.createdByRule).catch((err) => console.error("[memory-ingest]", err));
      }
      return { success: true, meta: { snoozedUntil: until.toISOString() } };
    },
  },

  dismiss: {
    label: "Dismiss",
    uiHints: "ghost",
    idempotencyKey: (n) => `nba:dismiss:${n.id}`,
    run: async ({ nextActionId, actorUserId }) => {
      const { dismissNextAction } = await import("./service");
      await dismissNextAction(nextActionId);
      if (actorUserId) {
        ingestFromNextActionDismiss(nextActionId, actorUserId).catch((err) => console.error("[memory-ingest]", err));
      }
      return { success: true, meta: { action: "dismiss" } };
    },
  },

  don_t_suggest_again_30d: {
    label: "Don't suggest again (30d)",
    confirmText: "Hide this type of action for 30 days?",
    uiHints: "ghost",
    idempotencyKey: (n) => `nba:don_t_suggest:${n.dedupeKey}`,
    run: async ({ nextActionId, nextAction, actorUserId }) => {
      const { dismissNextAction } = await import("./service");
      await dismissNextAction(nextActionId);
      const entityType = nextAction.entityType || "command_center";
      const entityId = nextAction.entityId || "command_center";
      const ruleKey = nextAction.createdByRule ?? (nextAction.dedupeKey?.split(":")[1] ?? null);
      const suppressedUntil = new Date();
      suppressedUntil.setDate(suppressedUntil.getDate() + 30);
      const existing = await db.nextActionPreference.findFirst({
        where: {
          entityType,
          entityId,
          OR: ruleKey ? [{ ruleKey }] : [{ dedupeKey: nextAction.dedupeKey }],
        },
      });
      if (existing) {
        await db.nextActionPreference.update({
          where: { id: existing.id },
          data: { status: "active", suppressedUntil },
        });
      } else {
        await db.nextActionPreference.create({
          data: {
            entityType,
            entityId,
            ruleKey: ruleKey ?? undefined,
            dedupeKey: nextAction.dedupeKey,
            status: "active",
            suppressedUntil,
            reason: "Don't suggest again",
          },
        });
      }
      if (actorUserId) {
        ingestFromNextActionDismiss(nextActionId, actorUserId, existing?.id).catch((err) => console.error("[memory-ingest]", err));
      }
      return { success: true, meta: { suppressed: true, duration: "30d" } };
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
    run: async ({ actorUserId }) => {
      const ctx = await fetchRiskRuleContext({ ownerUserId: actorUserId });
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
        raw === "review_stream" || raw === "command_center" || raw === "founder_growth"
          ? raw
          : "command_center";
      const entityId = nextAction.entityId || "command_center";
      const now = new Date();
      const ownerUserId = entityType === "founder_growth" ? actorUserId : undefined;
      const ctx = await fetchNextActionContext({ now, ownerUserId });
      const [learnedWeights, effectivenessByRuleKey] = actorUserId
        ? await Promise.all([loadLearnedWeights(actorUserId), loadEffectivenessMap(actorUserId)])
        : [undefined, undefined];
      let candidates = produceNextActions(ctx, entityType, learnedWeights, effectivenessByRuleKey);
      candidates = await filterByPreferences(candidates, entityType, entityId);
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

  // Phase 6.3.1: Growth execution actions
  growth_open_deal: {
    label: "Open deal",
    uiHints: "primary",
    idempotencyKey: (n) => `nba:growth_open_deal:${n.id}`,
    run: async ({ nextAction, actorUserId }) => {
      const dealId = (nextAction.payloadJson as Record<string, unknown>)?.dealId as string | undefined;
      const url = dealId ? `/dashboard/growth/deals/${dealId}` : "/dashboard/growth";
      return { success: true, meta: { redirectUrl: url } };
    },
  },

  growth_schedule_followup_3d: {
    label: "Schedule follow-up (3d)",
    confirmText: "Set next follow-up in 3 days?",
    uiHints: "secondary",
    idempotencyKey: (n) =>
      `nba:growth_schedule:${(n.payloadJson as Record<string, unknown>)?.dealId ?? n.id}:${new Date().toISOString().slice(0, 10)}`,
    run: async ({ nextAction, actorUserId }) => {
      const dealId = (nextAction.payloadJson as Record<string, unknown>)?.dealId as string | undefined;
      if (!dealId || !actorUserId) {
        return { success: false, errorCode: "missing_params", errorMessage: "dealId required" };
      }
      const deal = await db.deal.findFirst({ where: { id: dealId, ownerUserId: actorUserId } });
      if (!deal) return { success: false, errorCode: "not_found", errorMessage: "Deal not found" };
      const next = new Date();
      next.setDate(next.getDate() + 3);
      const existing = await db.followUpSchedule.findFirst({ where: { dealId, status: "active" } });
      if (existing) {
        await db.followUpSchedule.update({
          where: { id: existing.id },
          data: { nextFollowUpAt: next, cadenceDays: 3 },
        });
      } else {
        await db.followUpSchedule.create({
          data: { dealId, nextFollowUpAt: next, cadenceDays: 3, status: "active" },
        });
      }
      await db.deal.update({ where: { id: dealId }, data: { nextFollowUpAt: next } });
      await db.outreachEvent.create({
        data: {
          ownerUserId: actorUserId,
          dealId,
          channel: "other",
          type: "followup_scheduled",
          occurredAt: new Date(),
          metaJson: { nextFollowUpAt: next.toISOString(), cadenceDays: 3, source: "nba_delivery" },
        },
      });
      return { success: true, meta: { dealId, nextFollowUpAt: next.toISOString() } };
    },
  },

  growth_mark_replied: {
    label: "Mark replied",
    uiHints: "primary",
    idempotencyKey: (n) => `nba:growth_mark_replied:${(n.payloadJson as Record<string, unknown>)?.dealId ?? n.id}`,
    run: async ({ nextAction, actorUserId }) => {
      const dealId = (nextAction.payloadJson as Record<string, unknown>)?.dealId as string | undefined;
      if (!dealId || !actorUserId) {
        return { success: false, errorCode: "missing_params", errorMessage: "dealId required" };
      }
      const deal = await db.deal.findFirst({ where: { id: dealId, ownerUserId: actorUserId } });
      if (!deal) return { success: false, errorCode: "not_found", errorMessage: "Deal not found" };
      await db.$transaction([
        db.deal.update({ where: { id: dealId }, data: { stage: "replied" } }),
        db.outreachEvent.create({
          data: {
            ownerUserId: actorUserId,
            dealId,
            channel: "other",
            type: "reply",
            occurredAt: new Date(),
            metaJson: { source: "nba_delivery" },
          },
        }),
      ]);
      const { ingestFromGrowthStageChange } = await import("@/lib/memory/growth-ingest");
      ingestFromGrowthStageChange(dealId, actorUserId, deal.stage, "replied").catch((err) => console.error("[memory-ingest]", err));
      return { success: true, meta: { dealId, stage: "replied" } };
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
    select: {
      id: true,
      entityType: true,
      entityId: true,
      dedupeKey: true,
      createdByRule: true,
      payloadJson: true,
    },
  });
  if (!nextAction) {
    return { ok: false, errorCode: "not_found", errorMessage: "Next action not found" };
  }

  const idempotencyKey = def.idempotencyKey({
    ...nextAction,
    payloadJson: (nextAction.payloadJson as Record<string, unknown>) ?? undefined,
  });
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

  const ATTRIBUTION_ACTIONS = new Set(["mark_done", "recompute_score", "run_next_actions", "run_risk_rules"]);
  const entityType = nextAction.entityType || "command_center";
  const entityId = nextAction.entityId || "command_center";
  let beforeCtx: Awaited<ReturnType<typeof loadAttributionContext>> | null = null;
  if (ATTRIBUTION_ACTIONS.has(actionKey) && actorUserId) {
    beforeCtx = await loadAttributionContext(actorUserId, { entityType, entityId });
  }

  try {
    const result = await def.run({
      nextActionId,
      nextAction: {
        entityType: nextAction.entityType,
        entityId: nextAction.entityId,
        dedupeKey: nextAction.dedupeKey,
        createdByRule: nextAction.createdByRule ?? undefined,
        payloadJson: (nextAction.payloadJson as Record<string, unknown>) ?? undefined,
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

    let attributionOutcome: "improved" | "neutral" | "worsened" | undefined;
    if (beforeCtx && actorUserId && result.success) {
      try {
        const afterCtx = await loadAttributionContext(actorUserId, { entityType, entityId });
        const delta = computeAttributionDelta(beforeCtx, afterCtx);
        await recordAttribution({
          actorUserId,
          sourceType: "nba_execute",
          ruleKey: nextAction.createdByRule ?? null,
          actionKey,
          entityType,
          entityId,
          before: beforeCtx,
          after: afterCtx,
          delta,
        });
        attributionOutcome = deltaToOutcome(delta);
      } catch (_) {
        // Non-blocking; attribution failure does not affect execution
      }
    }

    if (actorUserId) {
      ingestFromNextActionExecution(exec.id, actorUserId, {
        attributionOutcome,
      }).catch((err) => console.error("[memory-ingest]", err));
    }

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

    if (actorUserId) {
      ingestFromNextActionExecution(exec.id, actorUserId).catch((err) => console.error("[memory-ingest]", err));
    }

    return {
      ok: false,
      executionId: exec.id,
      errorCode: "internal_error",
      errorMessage,
    };
  }
}
