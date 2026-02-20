import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runPipelineIfEligible } from "@/lib/pipeline/orchestrator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId } = await params;
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
