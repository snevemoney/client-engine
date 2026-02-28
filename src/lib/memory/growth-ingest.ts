/**
 * Phase 6.3: Memory ingestion for Growth Engine events.
 */
import { db } from "@/lib/db";
import { OperatorMemorySourceType, OperatorMemoryOutcome } from "@prisma/client";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta, sanitizeErrorMessage } from "@/lib/ops-events/sanitize";

async function safeIngest(fn: () => Promise<void>, label: string): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[memory.growth-ingest] ${label}:`, err);
    logOpsEventSafe({
      category: "system",
      eventKey: "memory.ingest.failed",
      status: "failure",
      errorMessage: sanitizeErrorMessage(err),
      meta: sanitizeMeta({ label }),
    });
  }
}

/**
 * Ingest from OutreachMessage sent.
 */
export async function ingestFromGrowthOutreach(
  messageId: string,
  actorUserId: string,
  status: "sent" | "replied"
): Promise<void> {
  await safeIngest(async () => {
    const msg = await db.outreachMessage.findUnique({
      where: { id: messageId },
      include: { deal: { include: { prospect: true } } },
    });
    if (!msg) return;

    const outcome: OperatorMemoryOutcome = status === "replied" ? "success" : "neutral";

    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.growth,
        entityType: "deal",
        entityId: msg.dealId,
        ruleKey: msg.templateKey,
        actionKey: "outreach_sent",
        outcome,
        metaJson: {
          messageId,
          dealId: msg.dealId,
          templateKey: msg.templateKey,
          channel: msg.channel,
          prospectId: msg.deal.prospectId,
        },
      },
    });
  }, "ingestFromGrowthOutreach");
}

/**
 * Ingest from Deal stage change.
 */
export async function ingestFromGrowthStageChange(
  dealId: string,
  actorUserId: string,
  fromStage: string,
  toStage: string
): Promise<void> {
  await safeIngest(async () => {
    let outcome: OperatorMemoryOutcome = "neutral";
    if (["replied", "call_scheduled", "won"].includes(toStage)) {
      outcome = "success";
    } else if (toStage === "lost") {
      outcome = "failure";
    }

    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.growth,
        entityType: "deal",
        entityId: dealId,
        ruleKey: `stage_${toStage}`,
        actionKey: "stage_change",
        outcome,
        metaJson: { dealId, fromStage, toStage },
      },
    });
  }, "ingestFromGrowthStageChange");
}
