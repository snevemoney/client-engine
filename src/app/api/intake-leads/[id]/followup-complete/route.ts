import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { parseDate, isValidDate } from "@/lib/followup/dates";

const PostSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
  nextAction: z.string().max(2000).optional().nullable(),
  nextActionDueAt: z.string().max(50).optional().nullable(),
});

/** POST /api/intake-leads/[id]/followup-complete */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/followup-complete", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const intake = await db.intakeLead.findUnique({
      where: { id },
      include: { promotedLead: true },
    });

    if (!intake) return jsonError("Lead not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const now = new Date();
    const nextAction = body.nextAction !== undefined ? (body.nextAction?.trim() ?? intake.nextAction) : intake.nextAction;
    const nextActionDueAtRaw = body.nextActionDueAt?.trim();
    const parsedDue = nextActionDueAtRaw ? parseDate(nextActionDueAtRaw) : null;
    const validDue = parsedDue && isValidDate(parsedDue) ? parsedDue : null;
    const dueAt = body.nextActionDueAt !== undefined ? validDue : intake.nextActionDueAt;

    await db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        followUpCompletedAt: now,
        lastContactedAt: now,
        followUpCount: (intake.followUpCount ?? 0) + 1,
      };
      if (body.nextAction !== undefined) updateData.nextAction = nextAction;
      if (body.nextActionDueAt !== undefined && dueAt) {
        updateData.nextActionDueAt = dueAt;
        updateData.followUpDueAt = dueAt;
      }
      await tx.intakeLead.update({
        where: { id },
        data: updateData,
      });
      const content = body.note?.trim()
        ? `Follow-up completed: ${body.note}`
        : "Follow-up completed";
      await tx.leadActivity.create({
        data: {
          intakeLeadId: id,
          type: LeadActivityType.followup_completed,
          content,
          metadataJson: {
            note: body.note ?? null,
            nextAction: nextAction ?? null,
            nextActionDueAt: dueAt?.toISOString() ?? null,
          },
        },
      });
      if (intake.promotedLeadId && dueAt) {
        await tx.lead.update({
          where: { id: intake.promotedLeadId },
          data: { nextContactAt: dueAt, lastContactAt: now },
        });
      }
    });

    const updated = await db.intakeLead.findUnique({
      where: { id },
      select: {
        id: true,
        followUpCompletedAt: true,
        lastContactedAt: true,
        followUpCount: true,
        nextAction: true,
        nextActionDueAt: true,
        followUpDueAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      lead: updated
        ? {
            id: updated.id,
            followUpCompletedAt: updated.followUpCompletedAt?.toISOString() ?? null,
            lastContactedAt: updated.lastContactedAt?.toISOString() ?? null,
            followUpCount: updated.followUpCount ?? 0,
            nextAction: updated.nextAction ?? null,
            nextActionDueAt: updated.nextActionDueAt?.toISOString() ?? null,
            followUpDueAt: updated.followUpDueAt?.toISOString() ?? null,
          }
        : null,
    });
  });
}
