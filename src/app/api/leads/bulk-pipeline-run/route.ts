import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadStatus } from "@prisma/client";
import { runPipelineIfEligible } from "@/lib/pipeline/runPipeline";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const MAX_PER_RUN = 10;

/**
 * POST /api/leads/bulk-pipeline-run
 * Run pipeline (Enrich → Score → Position → Propose) for leads that need it.
 * Eligible: status NEW or ENRICHED, no project, not REJECTED.
 */
export async function POST() {
  return withRouteTiming("POST /api/leads/bulk-pipeline-run", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const eligible = await db.lead.findMany({
      where: {
        status: { in: [LeadStatus.NEW, LeadStatus.ENRICHED] },
        project: null,
      },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: MAX_PER_RUN,
    });

    const results: { leadId: string; run: boolean; reason?: string }[] = [];

    for (const lead of eligible) {
      try {
        const result = await runPipelineIfEligible(lead.id, "bulk_pipeline_run");
        results.push({
          leadId: lead.id,
          run: result.run,
          reason: result.run ? undefined : result.reason,
        });
      } catch (err) {
        results.push({
          leadId: lead.id,
          run: false,
          reason: err instanceof Error ? err.message : "Pipeline run failed",
        });
      }
    }

    const runCount = results.filter((r) => r.run).length;
    return NextResponse.json({
      ok: true,
      processed: results.length,
      ran: runCount,
      results,
    });
  });
}
