/**
 * Voice Phase 1: Get proposals eligible for outbound proposal follow-up.
 * Trigger conditions per VOICE_ASSISTANT_PHASE_1_MVP.md.
 */
import { db } from "@/lib/db";

const STALE_DAYS = 3;
const RECENT_CALL_DAYS = 7;

export type VoiceEligibleProposal = {
  id: string;
  title: string;
  company: string | null;
  clientName: string | null;
  clientEmail: string | null;
  contactPhone: string;
  sentAt: Date;
  voiceConsentAt: Date | null;
  intakeLeadId: string | null;
  pipelineLeadId: string | null;
};

/**
 * Fetch proposals matching the voice follow-up trigger.
 * Conditions: sent, not accepted/rejected/meeting_booked, stale 3+ days,
 * consent given, no opt-out, no call in last 7 days, has contactPhone.
 */
export async function getEligibleProposals(limit = 50): Promise<VoiceEligibleProposal[]> {
  const now = new Date();
  const staleCutoff = new Date(now);
  staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS);
  const recentCallCutoff = new Date(now);
  recentCallCutoff.setDate(recentCallCutoff.getDate() - RECENT_CALL_DAYS);

  const recentLogs = await db.voiceCallLog.findMany({
    where: { calledAt: { gte: recentCallCutoff } },
    select: { proposalId: true },
  });
  const recentProposalIds = [...new Set(recentLogs.map((l) => l.proposalId))];

  const proposals = await db.proposal.findMany({
    where: {
      status: "sent",
      responseStatus: { notIn: ["accepted", "rejected", "meeting_booked"] },
      sentAt: { lte: staleCutoff },
      voiceConsentAt: { not: null },
      voiceOptedOutAt: null,
      contactPhone: { not: null },
      ...(recentProposalIds.length > 0 ? { id: { notIn: recentProposalIds } } : {}),
    },
    select: {
      id: true,
      title: true,
      company: true,
      clientName: true,
      clientEmail: true,
      contactPhone: true,
      sentAt: true,
      voiceConsentAt: true,
      intakeLeadId: true,
      pipelineLeadId: true,
    },
    orderBy: { sentAt: "asc" },
    take: limit,
  });

  return proposals.filter((p) => p.contactPhone != null) as VoiceEligibleProposal[];
}
