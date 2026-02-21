import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRun, startStep, finishStep, finishRun } from "@/lib/pipeline-metrics";
import { normalizeUsage } from "@/lib/pipeline/usage";
import { runPropose } from "@/lib/pipeline/propose";
import { formatStepFailureNotes } from "@/lib/pipeline/error-classifier";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const runId = await createRun(id);
  const stepId = await startStep(runId, "propose");

  try {
    const { artifactId, usage } = await runPropose(id);
    const norm = normalizeUsage(usage, "gpt-4o-mini");
    await finishStep(stepId, {
      success: true,
      outputArtifactIds: [artifactId],
      tokensUsed: norm.tokensUsed,
      costEstimate: norm.costEstimate,
    });
    await finishRun(runId, true);
    const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
    return NextResponse.json(artifact);
  } catch (err: any) {
    console.error("[propose] Error:", err);
    await finishStep(stepId, { success: false, notes: formatStepFailureNotes(err) });
    await finishRun(runId, false, err?.message ?? "Proposal generation failed");
    return NextResponse.json({ error: err.message || "Proposal generation failed" }, { status: 500 });
  }
}
