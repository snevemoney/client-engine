import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runPipelineIfEligible } from "@/lib/pipeline/runPipeline";
import { rateLimit } from "@/lib/rate-limit";

const LIMIT = 10;
const WINDOW_MS = 60_000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = `${session.user.id}:pipeline-run`;
  const { ok, remaining, resetAt } = rateLimit(key, LIMIT, WINDOW_MS);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests", resetAt },
      { status: 429, headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(resetAt) } }
    );
  }

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
  } catch (err: unknown) {
    console.error("[pipeline/run] Error:", err);
    const msg = err instanceof Error ? err.message : "Pipeline run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
