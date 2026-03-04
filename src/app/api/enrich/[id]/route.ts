import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkStateChangeRateLimit } from "@/lib/api-utils";
import { createRun, startStep, finishStep, finishRun } from "@/lib/pipeline-metrics";
import { normalizeUsage } from "@/lib/pipeline/usage";
import { runEnrich } from "@/lib/pipeline/enrich";
import { formatStepFailureNotes } from "@/lib/pipeline/error-classifier";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateErr = checkStateChangeRateLimit(req, "enrich", session.user?.id, { windowMs: 60_000, max: 20 });
  if (rateErr) return rateErr;

  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const runId = await createRun(id);
  const stepId = await startStep(runId, "enrich");

  try {
    const { artifactId, usage } = await runEnrich(id);
    const norm = normalizeUsage(usage, "gpt-4o-mini");
    await finishStep(stepId, {
      success: true,
      outputArtifactIds: [artifactId],
      tokensUsed: norm.tokensUsed,
      costEstimate: norm.costEstimate,
    });
    await finishRun(runId, true);
    const updated = await db.lead.findUnique({ where: { id } });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error("[enrich] Error:", err);
    const msg = err instanceof Error ? err.message : "Enrichment failed";
    await finishStep(stepId, { success: false, notes: formatStepFailureNotes(err) });
    await finishRun(runId, false, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
