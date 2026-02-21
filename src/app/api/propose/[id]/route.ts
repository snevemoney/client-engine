import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRun, startStep, finishStep, finishRun } from "@/lib/pipeline-metrics";
import { normalizeUsage } from "@/lib/pipeline/usage";
import { runPropose } from "@/lib/pipeline/propose";
import { formatStepFailureNotes } from "@/lib/pipeline/error-classifier";
import { buildProvenance } from "@/lib/pipeline/provenance";
import { rateLimit } from "@/lib/rate-limit";

const LIMIT = 10;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = `${session.user.id}:propose`;
  const { ok, remaining, resetAt } = rateLimit(key, LIMIT, WINDOW_MS);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests", resetAt },
      { status: 429, headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(resetAt) } }
    );
  }

  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const runId = await createRun(id);
  const stepId = await startStep(runId, "propose");

  try {
    const provenance = buildProvenance(runId, "propose", { temperature: 0.6 });
    const { artifactId, usage } = await runPropose(id, provenance);
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
  } catch (err: unknown) {
    console.error("[propose] Error:", err);
    const msg = err instanceof Error ? err.message : "Proposal generation failed";
    await finishStep(stepId, { success: false, notes: formatStepFailureNotes(err) });
    await finishRun(runId, false, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
