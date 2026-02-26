/**
 * Phase 4.0: Risk flag service — upsert, snooze, resolve.
 */

import { db } from "@/lib/db";
import { RiskStatus } from "@prisma/client";
import type { RiskCandidate } from "./types";
import { createNotificationEvent, queueNotificationDeliveries } from "@/lib/notifications/service";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta } from "@/lib/ops-events/sanitize";

export type UpsertRiskFlagsResult = {
  created: number;
  updated: number;
  criticalNotified: number;
};

/**
 * Upsert risk flags from candidates. Dedupe via dedupeKey.
 * Do NOT reopen resolved/snoozed unless rule explicitly says so (we don't reopen in 4.0).
 */
export async function upsertRiskFlags(candidates: RiskCandidate[]): Promise<UpsertRiskFlagsResult> {
  let created = 0;
  let updated = 0;
  let criticalNotified = 0;
  const now = new Date();

  for (const c of candidates) {
    const existing = await db.riskFlag.findUnique({
      where: { dedupeKey: c.dedupeKey },
    });

    const data = {
      key: c.key,
      title: c.title,
      description: c.description ?? null,
      severity: c.severity,
      sourceType: c.sourceType,
      sourceId: c.sourceId ?? null,
      actionUrl: c.actionUrl ?? null,
      suggestedFix: c.suggestedFix ?? null,
      evidenceJson: c.evidenceJson ?? undefined,
      createdByRule: c.createdByRule,
      lastSeenAt: now,
    };

    if (!existing) {
      await db.riskFlag.create({
        data: {
          ...data,
          status: RiskStatus.open,
          dedupeKey: c.dedupeKey,
        },
      });
      created++;

      // Notify on new CRITICAL
      if (c.severity === "critical") {
        const { id: eventId, created: notifCreated } = await createNotificationEvent({
          eventKey: "risk.created.critical",
          title: c.title,
          message: c.suggestedFix ?? c.title,
          severity: "critical",
          sourceType: "risk_flag",
          sourceId: c.dedupeKey,
          actionUrl: c.actionUrl ?? "/dashboard/risk",
          dedupeKey: `risk:${c.dedupeKey}`,
          createdByRule: "risk.service",
        });
        if (notifCreated) {
          await queueNotificationDeliveries(eventId, ["in_app"]);
          criticalNotified++;
          logOpsEventSafe({
            category: "system",
            eventKey: "risk.critical_notified",
            sourceType: "risk_flag",
            sourceId: c.dedupeKey,
            meta: { riskTitle: c.title },
          });
        }
      }
    } else {
      // Don't reopen resolved or snoozed
      if (existing.status === RiskStatus.resolved || existing.status === RiskStatus.dismissed) {
        continue;
      }
      if (existing.status === RiskStatus.snoozed && existing.snoozedUntil && existing.snoozedUntil > now) {
        continue;
      }

      await db.riskFlag.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    }
  }

  logOpsEventSafe({
    category: "system",
    eventKey: "risk.upsert",
    meta: sanitizeMeta({ created, updated, criticalNotified, candidateCount: candidates.length }),
  });

  return { created, updated, criticalNotified };
}

export async function snoozeRisk(id: string, until: Date): Promise<void> {
  await db.riskFlag.update({
    where: { id },
    data: { status: RiskStatus.snoozed, snoozedUntil: until, updatedAt: new Date() },
  });
}

export async function resolveRisk(id: string): Promise<void> {
  const now = new Date();
  await db.riskFlag.update({
    where: { id },
    data: { status: RiskStatus.resolved, resolvedAt: now, updatedAt: now },
  });
}

export async function dismissRisk(id: string): Promise<void> {
  await db.riskFlag.update({
    where: { id },
    data: { status: RiskStatus.dismissed, updatedAt: new Date() },
  });
}
