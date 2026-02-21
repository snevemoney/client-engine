import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runPipelineIfEligible } from "@/lib/pipeline/runPipeline";

function detailsForLead(lead: { status: string; scoredAt: Date | null; artifacts: { type: string; title: string }[] }) {
  const hasEnrich = lead.artifacts.some((a) => a.type === "notes" && a.title === "AI Enrichment Report");
  const hasScore = lead.scoredAt != null;
  const hasPosition = lead.artifacts.some((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");
  const hasProposal = lead.artifacts.some((a) => a.type === "proposal");
  return {
    hasEnrich,
    hasScore,
    hasPosition,
    hasProposal,
    leadStatus: lead.status,
  };
}

/**
 * Manual retry for a lead's pipeline (e.g. after OPENAI_429 or transient failure).
 * Calls runPipelineIfEligible(leadId, "manual_retry").
 * When run: false, returns reason + details so UI/debugging is clear.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId } = await params;
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { artifacts: { select: { type: true, title: true } } },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  try {
    const result = await runPipelineIfEligible(leadId, "manual_retry");
    if (result.run) {
      return NextResponse.json({
        run: true,
        runId: result.runId,
        stepsRun: result.stepsRun,
        stepsSkipped: result.stepsSkipped,
      });
    }
    const details = detailsForLead(lead);
    return NextResponse.json({ run: false, reason: result.reason, details }, { status: 200 });
  } catch (err: any) {
    console.error("[pipeline/retry] Error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Pipeline retry failed" },
      { status: 500 }
    );
  }
}
