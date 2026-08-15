/**
 * POST /api/voice/schedule-follow-up — Schedule voice follow-up for a proposal.
 * Validates consent, stubs voice platform (logs intent, returns success).
 * No actual Retell/Vapi call without API key.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError, withRouteTiming, checkStateChangeRateLimit } from "@/lib/api-utils";
import { checkConsent } from "@/lib/voice";
import { db } from "@/lib/db";
import { logOpsEventSafe } from "@/lib/ops-events/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ proposalId: z.string().min(1) });

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/voice/schedule-follow-up", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const rl = checkStateChangeRateLimit(req, "voice:schedule");
    if (rl) return rl;

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input: proposalId required", 400);

    const { proposalId } = parsed.data;

    const hasConsent = await checkConsent(proposalId);
    if (!hasConsent) return jsonError("Consent required before scheduling voice follow-up", 400);

    const proposal = await db.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true, contactPhone: true, pipelineLeadId: true },
    });
    if (!proposal) return jsonError("Proposal not found", 404);
    if (!proposal.contactPhone) return jsonError("Proposal has no contact phone", 400);

    const hasApiKey = !!(process.env.VAPI_API_KEY || process.env.RETELL_API_KEY);
    await db.proposalActivity.create({
      data: {
        proposalId,
        type: "followup_scheduled",
        message: hasApiKey ? "Voice follow-up scheduled" : "Voice follow-up scheduled (stub — no API key)",
        metaJson: { source: "voice", stub: !hasApiKey },
      },
    });
    logOpsEventSafe({
      category: "voice",
      eventKey: hasApiKey ? "voice.schedule_intent" : "voice.schedule_stub",
      status: "success",
      sourceType: "proposal",
      sourceId: proposalId,
    });
    return NextResponse.json({
      ok: true,
      stub: !hasApiKey,
      message: hasApiKey ? "Scheduled" : "Intent logged; no call placed (no API key)",
    });
  });
}
