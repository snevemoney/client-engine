/**
 * POST /api/intake-leads/[id]/sync-pipeline — Sync intake fields to promoted pipeline lead.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { computePipelineSyncUpdates } from "@/lib/intake-lead/pipeline-sync";

export async function POST(
  _req: unknown,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/sync-pipeline", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const intake = await db.intakeLead.findUnique({
      where: { id },
      include: { promotedLead: true },
    });

    if (!intake) return jsonError("Lead not found", 404);

    if (!intake.promotedLeadId || !intake.promotedLead) {
      return jsonError("Lead not yet promoted; nothing to sync", 400, "VALIDATION");
    }

    const lead = intake.promotedLead;
    const { updates, changedFields } = computePipelineSyncUpdates(intake, {
      id: lead.id,
      title: lead.title,
      description: lead.description ?? undefined,
      nextAction: lead.nextAction ?? undefined,
      nextActionDueAt: lead.nextActionDueAt ?? undefined,
      nextContactAt: lead.nextContactAt ?? undefined,
      contactName: lead.contactName ?? undefined,
      contactEmail: lead.contactEmail ?? undefined,
      budget: lead.budget ?? undefined,
      proposalSentAt: lead.proposalSentAt ?? undefined,
      buildStartedAt: lead.buildStartedAt ?? undefined,
      buildCompletedAt: lead.buildCompletedAt ?? undefined,
    });

    if (changedFields.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No changes needed",
        lead: {
          id: lead.id,
          title: lead.title,
          status: lead.status,
          updatedAt: lead.updatedAt.toISOString(),
        },
        changedFields: [],
      });
    }

    const updated = await db.$transaction([
      db.lead.update({
        where: { id: lead.id },
        data: updates,
      }),
      db.leadActivity.create({
        data: {
          intakeLeadId: id,
          type: LeadActivityType.pipeline_synced,
          content: `Synced to pipeline: ${changedFields.join(", ")}`,
          metadataJson: { changedFields },
        },
      }),
    ]);

    const updatedLead = updated[0];

    return NextResponse.json({
      ok: true,
      message: `Synced ${changedFields.length} field(s)`,
      lead: {
        id: updatedLead.id,
        title: updatedLead.title,
        status: updatedLead.status,
        description: updatedLead.description ?? null,
        nextAction: updatedLead.nextAction ?? null,
        nextActionDueAt: updatedLead.nextActionDueAt?.toISOString() ?? null,
        updatedAt: updatedLead.updatedAt.toISOString(),
      },
      changedFields,
    });
  });
}
