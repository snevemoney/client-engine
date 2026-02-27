/**
 * Phase 4.0: Next Best Action service — upsert, complete, dismiss, recordRun.
 */

import { db } from "@/lib/db";
import { NextActionStatus } from "@prisma/client";
import type { NextActionCandidate } from "./types";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta } from "@/lib/ops-events/sanitize";

export type UpsertNextActionsResult = {
  created: number;
  updated: number;
};

/**
 * Upsert next actions. Dedupe via dedupeKey. Only upsert queued/done/dismissed — don't change done/dismissed.
 */
export async function upsertNextActions(candidates: NextActionCandidate[]): Promise<UpsertNextActionsResult> {
  let created = 0;
  let updated = 0;

  for (const c of candidates) {
    const existing = await db.nextBestAction.findUnique({
      where: { dedupeKey: c.dedupeKey },
    });

    const data = {
      title: c.title,
      reason: c.reason ?? null,
      priority: c.priority,
      score: c.score,
      sourceType: c.sourceType,
      sourceId: c.sourceId ?? null,
      actionUrl: c.actionUrl ?? null,
      payloadJson: c.payloadJson ?? undefined,
      explanationJson: c.explanationJson ?? undefined,
      createdByRule: c.createdByRule,
      entityType: c.entityType ?? "command_center",
      entityId: c.entityId ?? "command_center",
    };

    if (!existing) {
      await db.nextBestAction.create({
        data: {
          ...data,
          status: NextActionStatus.queued,
          dedupeKey: c.dedupeKey,
        },
      });
      created++;
    } else if (existing.status === NextActionStatus.queued) {
      await db.nextBestAction.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    }
  }

  logOpsEventSafe({
    category: "system",
    eventKey: "nba.upsert",
    meta: sanitizeMeta({ created, updated, candidateCount: candidates.length }),
  });

  return { created, updated };
}

export async function completeNextAction(id: string): Promise<void> {
  const now = new Date();
  await db.nextBestAction.update({
    where: { id },
    data: { status: NextActionStatus.done, completedAt: now, updatedAt: now },
  });
}

export async function dismissNextAction(id: string): Promise<void> {
  const now = new Date();
  await db.nextBestAction.update({
    where: { id },
    data: { status: NextActionStatus.dismissed, dismissedAt: now, updatedAt: now },
  });
}

/** Phase 4.2: Snooze NBA until given date (parity with Risk). */
export async function snoozeNextAction(id: string, until: Date): Promise<void> {
  await db.nextBestAction.update({
    where: { id },
    data: { snoozedUntil: until, updatedAt: new Date() },
  });
}

export async function recordNextActionRun(runKey: string, mode: string, meta?: Record<string, unknown>): Promise<void> {
  await db.nextActionRun.upsert({
    where: { runKey },
    create: { runKey, mode, metaJson: meta ?? undefined },
    update: { metaJson: meta ?? undefined },
  });
}
