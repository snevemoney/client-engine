import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { IntakeLeadStatus, LeadActivityType } from "@prisma/client";

/**
 * POST /api/intake-leads/bulk-promote — Promote all ready intake leads to pipeline.
 * Ready = promotedLeadId null, status not won/lost/archived, title and summary present.
 */
export async function POST() {
  return withRouteTiming("POST /api/intake-leads/bulk-promote", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const ready = await db.intakeLead.findMany({
      where: {
        promotedLeadId: null,
        status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost, IntakeLeadStatus.archived] },
        title: { not: "" },
        summary: { not: "" },
      },
      select: { id: true },
    });

    const results: { id: string; promotedLeadId: string }[] = [];

    for (const { id } of ready) {
      const intake = await db.intakeLead.findUnique({
        where: { id },
        include: { promotedLead: true },
      });
      if (!intake || intake.promotedLeadId) continue;

      const budgetStr =
        intake.budgetMin != null || intake.budgetMax != null
          ? [intake.budgetMin, intake.budgetMax].filter((x) => x != null).join("–")
          : null;

      const lead = await db.lead.create({
        data: {
          title: intake.title.trim(),
          source: intake.source,
          sourceUrl: intake.link ?? undefined,
          description: intake.summary.trim(),
          budget: budgetStr ?? undefined,
          contactName: intake.contactName ?? undefined,
          contactEmail: intake.contactEmail ?? undefined,
          score: intake.score ?? undefined,
          scoreReason: intake.scoreReason ?? undefined,
          techStack: [],
          tags: intake.tags ?? [],
        },
      });

      await db.$transaction([
        db.intakeLead.update({
          where: { id },
          data: { promotedLeadId: lead.id, status: "qualified" },
        }),
        db.leadActivity.create({
          data: {
            intakeLeadId: id,
            type: LeadActivityType.manual,
            content: "Promoted to pipeline",
            metadataJson: { promotedLeadId: lead.id },
          },
        }),
      ]);

      results.push({ id, promotedLeadId: lead.id });

      void (async () => {
        try {
          const { runPipelineIfEligible } = await import("@/lib/pipeline/runPipeline");
          await runPipelineIfEligible(lead.id, "bulk_promote");
        } catch (err) {
          console.error("[bulk-promote] pipeline run failed", { leadId: lead.id }, err);
        }
      })();
    }

    return NextResponse.json({
      ok: true,
      promoted: results.length,
      results,
    });
  });
}
