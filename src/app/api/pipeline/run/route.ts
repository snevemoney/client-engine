import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runPipelineIfEligible } from "@/lib/pipeline/runPipeline";

/**
 * POST /api/pipeline/run?leadId=...
 * Manual pipeline run (admin only). Use from lead creation or rerun button.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId required (query param)" }, { status: 400 });

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  try {
    const result = await runPipelineIfEligible(leadId, "manual-run");
    if (result.run) {
      return NextResponse.json({
        run: true,
        runId: result.runId,
        stepsRun: result.stepsRun,
        stepsSkipped: result.stepsSkipped,
      });
    }
    return NextResponse.json({ run: false, reason: result.reason }, { status: 200 });
  } catch (err: any) {
    console.error("[pipeline/run] Error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Pipeline run failed" },
      { status: 500 }
    );
  }
}
