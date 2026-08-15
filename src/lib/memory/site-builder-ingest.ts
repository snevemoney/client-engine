/**
 * Sprint 6: Site Builder memory ingestion.
 * Emits OperatorMemoryEvent on phase approve (site_phase_approved) and reject (site_phase_revised).
 */
import { db } from "@/lib/db";
import { OperatorMemorySourceType, OperatorMemoryOutcome, Prisma } from "@prisma/client";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta, sanitizeErrorMessage } from "@/lib/ops-events/sanitize";

async function safeIngest(fn: () => Promise<void>, label: string): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[memory.site-builder-ingest] ${label}:`, err);
    logOpsEventSafe({
      category: "system",
      eventKey: "memory.site_builder.ingest.failed",
      status: "failure",
      errorMessage: sanitizeErrorMessage(err),
      meta: sanitizeMeta({ label }),
    });
  }
}

/**
 * Ingest from phase approval. Creates OperatorMemoryEvent with site_phase_approved.
 */
export async function ingestFromSitePhaseApproved(
  deliveryProjectId: string,
  phaseNum: number,
  actorUserId: string,
  meta?: { phaseName?: string; designPersonality?: string; contentStyle?: string }
): Promise<void> {
  await safeIngest(async () => {
    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.site_builder,
        entityType: "delivery_project",
        entityId: deliveryProjectId,
        ruleKey: "site_phase_approved",
        actionKey: `site_phase_${phaseNum}`,
        outcome: OperatorMemoryOutcome.success,
        metaJson: (sanitizeMeta({
          phaseNum,
          phaseName: meta?.phaseName,
          designPersonality: meta?.designPersonality,
          contentStyle: meta?.contentStyle,
        }) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }, "site_phase_approved");
}

/**
 * Ingest from phase reject or regenerate. Creates OperatorMemoryEvent with site_phase_revised.
 */
export async function ingestFromSitePhaseRevised(
  deliveryProjectId: string,
  phaseNum: number,
  actorUserId: string,
  operatorNotes?: string
): Promise<void> {
  await safeIngest(async () => {
    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.site_builder,
        entityType: "delivery_project",
        entityId: deliveryProjectId,
        ruleKey: "site_phase_revised",
        actionKey: `site_phase_${phaseNum}`,
        outcome: OperatorMemoryOutcome.neutral,
        metaJson: (sanitizeMeta({
          phaseNum,
          operatorNotes: operatorNotes?.slice(0, 500),
        }) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }, "site_phase_revised");
}
