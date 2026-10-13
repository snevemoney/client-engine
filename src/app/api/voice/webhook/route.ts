/**
 * POST /api/voice/webhook — Receives outcome from Retell/Vapi.
 * Fail-closed HMAC on the raw body. Idempotent by externalCallId.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { VoiceCallOutcome } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { firstHeader, verifyHmacSha256Signature } from "@/lib/crypto/hmac";
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

const VOICE_SIGNATURE_HEADERS = [
  "x-voice-signature",
  "x-webhook-signature",
  "x-retell-signature",
  "x-vapi-signature",
];

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/voice/webhook", async () => {
    const rawBody = await req.text();
    const signature = firstHeader(req.headers, VOICE_SIGNATURE_HEADERS);
    const verified = verifyHmacSha256Signature({
      secret: process.env.VOICE_WEBHOOK_SECRET,
      signatureHeader: signature,
      rawBody,
    });
    if (!verified) return jsonError("Unauthorized", 401);

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return jsonError("Invalid webhook body", 400);
    }

    const parsed = bodySchema.safeParse(json);
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
