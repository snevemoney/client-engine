/**
 * GET /api/ops/orphan-check — Data integrity check for orphaned entities.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/ops/orphan-check", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const [
      unlinkedProposals,
      proofMissingIntake,
      proofMissingLead,
    ] = await Promise.all([
      // Proposals with no linked lead at all
      db.proposal.count({
        where: {
          intakeLeadId: null,
          pipelineLeadId: null,
        },
      }),
      // ProofCandidates where sourceType=intake_lead but intakeLeadId is null
      db.proofCandidate.count({
        where: {
          sourceType: "intake_lead",
          intakeLeadId: null,
        },
      }),
      // ProofCandidates where sourceType=pipeline_lead but leadId is null
      db.proofCandidate.count({
        where: {
          sourceType: "pipeline_lead",
          leadId: null,
        },
      }),
    ]);

    return NextResponse.json({
      unlinkedProposals,
      proofSourceMismatch: proofMissingIntake + proofMissingLead,
      details: {
        proofMissingIntake,
        proofMissingLead,
      },
      healthy: unlinkedProposals === 0 && proofMissingIntake === 0 && proofMissingLead === 0,
    });
  });
}
