/**
 * POST /api/voice/webhook — Receives outcome from Retell/Vapi.
 * Idempotent by externalCallId. Parses proposalId, outcome, externalCallId, durationSeconds.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { VoiceCallOutcome } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { logCallOutcome, recordOptOut } from "@/lib/voice";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_OUTCOMES: VoiceCallOutcome[] = [
  "booked_callback",
  "requested_manual_followup",
  "not_interested",
  "no_answer",
  "opted_out",
];

const bodySchema = z.object({
  proposalId: z.string().min(1).optional(),
  proposal_id: z.string().min(1).optional(),
  outcome: z.enum(VALID_OUTCOMES as unknown as [string, ...string[]]),
  externalCallId: z.string().optional(),
  external_call_id: z.string().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  duration_seconds: z.number().int().nonnegative().optional(),
}).transform((d) => ({
  proposalId: d.proposalId ?? d.proposal_id ?? "",
  outcome: d.outcome,
  externalCallId: d.externalCallId ?? d.external_call_id,
  durationSeconds: d.durationSeconds ?? d.duration_seconds,
}));

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/voice/webhook", async () => {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid webhook body", 400);
    }

    const { proposalId, outcome, externalCallId, durationSeconds } = parsed.data;
    if (!proposalId) return jsonError("proposalId required", 400);

    const proposal = await db.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true, contactPhone: true, pipelineLeadId: true },
    });
    if (!proposal) return jsonError("Proposal not found", 404);
    if (!proposal.contactPhone) return jsonError("Proposal has no contact phone", 400);

    const { id, created } = await logCallOutcome({
      proposalId,
      pipelineLeadId: proposal.pipelineLeadId,
      contactPhone: proposal.contactPhone,
      outcome: outcome as VoiceCallOutcome,
      durationSeconds: durationSeconds ?? null,
      externalCallId: externalCallId ?? null,
    });

    if (outcome === "opted_out") {
      await recordOptOut(proposalId);
    }

    return NextResponse.json({ ok: true, id, created });
  });
}
