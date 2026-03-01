/**
 * POST /api/flywheel/batch — Run the flywheel on all eligible leads.
 *
 * Body: { autoSendProposal?: boolean, autoBuild?: boolean }
 *
 * Returns:
 *   - leads found (eligible for flywheel)
 *   - per-lead results as they complete
 *   - summary counts
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { runFlywheel } from "@/lib/orchestrator/flywheel";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BatchSchema = z.object({
  autoSendProposal: z.boolean().optional().default(true),
  autoBuild: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/flywheel/batch", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const raw = await req.json().catch(() => ({}));
    const parsed = BatchSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError("Invalid options", 400);
    }

    const { autoSendProposal, autoBuild } = parsed.data;

    // Find leads eligible for flywheel:
    // - status NEW or APPROVED (not already processed)
    // - no existing proposal (proposalCount === 0)
    const leads = await db.lead.findMany({
      where: {
        status: { in: ["NEW", "APPROVED"] },
        proposalCount: 0,
      },
      orderBy: { createdAt: "desc" },
      take: 50, // safety cap
    });

    if (leads.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No eligible leads found",
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      });
    }

    const results: Array<{
      leadId: string;
      title: string;
      ok: boolean;
      proposalId: string | null;
      deliveryProjectId: string | null;
      builderSiteId: string | null;
      totalDurationMs: number;
      error?: string;
    }> = [];

    // Run sequentially to avoid overwhelming the system
    for (const lead of leads) {
      try {
        const result = await runFlywheel({
          leadId: lead.id,
          title: lead.title,
          source: lead.source ?? "manual",
          sourceUrl: lead.sourceUrl ?? undefined,
          description: lead.description ?? undefined,
          contactName: lead.contactName ?? undefined,
          contactEmail: lead.contactEmail ?? undefined,
          company: (lead as Record<string, unknown>).company as string | undefined,
          budget: lead.budget ?? undefined,
          timeline: lead.timeline ?? undefined,
          tags: lead.tags ?? [],
          autoSendProposal,
          autoBuild,
        });

        results.push({
          leadId: lead.id,
          title: lead.title,
          ok: result.ok,
          proposalId: result.proposalId,
          deliveryProjectId: result.deliveryProjectId,
          builderSiteId: result.builderSiteId,
          totalDurationMs: result.totalDurationMs,
        });
      } catch (err) {
        results.push({
          leadId: lead.id,
          title: lead.title,
          ok: false,
          proposalId: null,
          deliveryProjectId: null,
          builderSiteId: null,
          totalDurationMs: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      ok: failed === 0,
      total: results.length,
      succeeded,
      failed,
      results,
    });
  }, { eventKey: "flywheel.batch", method: "POST", sourceType: "flywheel" });
}

/** GET — preview which leads would be processed by a batch run */
export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("Unauthorized", 401);

  const leads = await db.lead.findMany({
    where: {
      status: { in: ["NEW", "APPROVED"] },
      proposalCount: 0,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      source: true,
      status: true,
      contactName: true,
      contactEmail: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ leads, count: leads.length });
}
