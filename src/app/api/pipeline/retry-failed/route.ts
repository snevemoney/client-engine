/**
 * POST /api/pipeline/retry-failed
 * Bulk retry all failed pipeline runs (including OPENAI_4XX).
 * Auth: session or Bearer AGENT_CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runPipelineIfEligible } from "@/lib/pipeline/runPipeline";
import { withRouteTiming } from "@/lib/api-utils";

const RETRY_CAP = 10;

async function isAllowed(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.AGENT_CRON_SECRET;
  if (cronSecret && authHeader?.startsWith("Bearer ")) {
    if (authHeader.slice(7) === cronSecret) return true;
  }
  const session = await auth();
  return !!session?.user;
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/pipeline/retry-failed", async () => {
    if (!(await isAllowed(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const failed = await db.pipelineRun.findMany({
      where: { success: false },
      orderBy: { lastErrorAt: "desc" },
      take: RETRY_CAP * 2,
      select: { leadId: true, lastErrorCode: true },
    });
    const leadIds = [...new Set(failed.map((r) => r.leadId))].slice(0, RETRY_CAP);

    let retried = 0;
    const errors: string[] = [];

    for (const leadId of leadIds) {
      try {
        const result = await runPipelineIfEligible(leadId, "bulk_retry");
        if (result.run) retried++;
      } catch (err) {
        errors.push(`${leadId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      retried,
      total: leadIds.length,
      leadIds,
      ...(errors.length ? { errors } : {}),
    });
  });
}
