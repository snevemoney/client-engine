import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { LeadActivityType } from "@prisma/client";

/** POST /api/intake-leads/[id]/promote — Promote IntakeLead to pipeline Lead. Idempotent. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/promote", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const intake = await db.intakeLead.findUnique({
      where: { id },
      include: { promotedLead: true },
    });

    if (!intake) return jsonError("Lead not found", 404);

    if (!intake.title?.trim()) return jsonError("Title required to promote", 400, "VALIDATION");
    if (!intake.summary?.trim()) return jsonError("Summary required to promote", 400, "VALIDATION");

    if (intake.promotedLeadId) {
      const lead = intake.promotedLead;
      return NextResponse.json({
        ok: true,
        promotedLeadId: lead?.id ?? intake.promotedLeadId,
        message: "Already promoted",
        lead: lead
          ? {
              id: lead.id,
              title: lead.title,
              status: lead.status,
              createdAt: lead.createdAt.toISOString(),
            }
          : { id: intake.promotedLeadId },
      });
    }

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
        data: {
          promotedLeadId: lead.id,
          status: "qualified",
        },
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

    return NextResponse.json({
      ok: true,
      promotedLeadId: lead.id,
      lead: {
        id: lead.id,
        title: lead.title,
        status: lead.status,
        createdAt: lead.createdAt.toISOString(),
      },
    });
  });
}
