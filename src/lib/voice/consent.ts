/**
 * Voice Phase 1: Consent and opt-out handling.
 */
import { db } from "@/lib/db";
import type { VoiceCallOutcome } from "@prisma/client";

export function checkConsent(proposalId: string): Promise<boolean> {
  return db.proposal
    .findUnique({
      where: { id: proposalId },
      select: { voiceConsentAt: true, voiceOptedOutAt: true },
    })
    .then((p) => p != null && p.voiceConsentAt != null && p.voiceOptedOutAt == null);
}

export async function recordConsent(proposalId: string): Promise<void> {
  await db.proposal.update({
    where: { id: proposalId },
    data: { voiceConsentAt: new Date() },
  });
}

export async function recordOptOut(proposalId: string): Promise<void> {
  await db.proposal.update({
    where: { id: proposalId },
    data: { voiceOptedOutAt: new Date() },
  });
}
