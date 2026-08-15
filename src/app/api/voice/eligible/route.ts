/**
 * GET /api/voice/eligible — List proposals matching voice follow-up trigger.
 */
import { NextResponse } from "next/server";
import { requireAuth, jsonError, withRouteTiming } from "@/lib/api-utils";
import { getEligibleProposals } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/voice/eligible", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const proposals = await getEligibleProposals(50);
    return NextResponse.json({
      proposals: proposals.map((p) => ({
        id: p.id,
        title: p.title,
        company: p.company,
        clientName: p.clientName,
        clientEmail: p.clientEmail,
        contactPhone: p.contactPhone,
        sentAt: p.sentAt.toISOString(),
        intakeLeadId: p.intakeLeadId,
        pipelineLeadId: p.pipelineLeadId,
      })),
    });
  });
}
