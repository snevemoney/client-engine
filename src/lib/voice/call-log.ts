/**
 * Voice Phase 1: Call outcome logging. Idempotent by externalCallId.
 */
import { db } from "@/lib/db";
import type { VoiceCallOutcome } from "@prisma/client";

export type LogCallParams = {
  proposalId: string;
  pipelineLeadId?: string | null;
  contactPhone: string;
  outcome: VoiceCallOutcome;
  durationSeconds?: number | null;
  externalCallId?: string | null;
  meta?: Record<string, unknown> | null;
};

/**
 * Log a voice call outcome. Idempotent: if externalCallId exists, skip.
 */
export async function logCallOutcome(params: LogCallParams): Promise<{ id: string; created: boolean }> {
  if (params.externalCallId) {
    const existing = await db.voiceCallLog.findUnique({
      where: { externalCallId: params.externalCallId },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };
  }

  const log = await db.voiceCallLog.create({
    data: {
      proposalId: params.proposalId,
      pipelineLeadId: params.pipelineLeadId ?? null,
      contactPhone: params.contactPhone,
      outcome: params.outcome,
      durationSeconds: params.durationSeconds ?? null,
      externalCallId: params.externalCallId ?? null,
      meta: params.meta ?? undefined,
    },
  });
  return { id: log.id, created: true };
}
