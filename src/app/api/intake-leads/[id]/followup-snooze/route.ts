import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { computeSnoozeDate, isValidDate, type SnoozeType } from "@/lib/followup/dates";

const PostSchema = z.object({
  snoozeType: z.enum(["2d", "5d", "next_monday", "custom"]),
  nextActionDueAt: z.string().max(50).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

/** POST /api/intake-leads/[id]/followup-snooze */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/followup-snooze", async () => {
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

    const fromDate =
      (intake.nextActionDueAt && isValidDate(intake.nextActionDueAt)
        ? intake.nextActionDueAt
        : intake.followUpDueAt) ?? new Date();

    const newDue = computeSnoozeDate(
      body.snoozeType as SnoozeType,
      fromDate,
      body.snoozeType === "custom" ? body.nextActionDueAt : undefined
    );

    if (!newDue || !isValidDate(newDue)) {
      return jsonError(
        body.snoozeType === "custom"
          ? "Invalid custom due date"
          : "Could not compute snooze date",
        400,
        "VALIDATION"
      );
    }

    await db.$transaction(async (tx) => {
      await tx.intakeLead.update({
        where: { id },
        data: {
          nextActionDueAt: newDue,
          followUpDueAt: newDue,
        },
      });
      const reasonPart = body.reason?.trim() ? ` (${body.reason})` : "";
      await tx.leadActivity.create({
        data: {
          intakeLeadId: id,
          type: LeadActivityType.followup_snoozed,
          content: `Snoozed until ${newDue.toISOString()}${reasonPart}`,
          metadataJson: {
            snoozeType: body.snoozeType,
            nextActionDueAt: newDue.toISOString(),
            reason: body.reason ?? null,
          },
        },
      });
      if (intake.promotedLeadId) {
        await tx.lead.update({
          where: { id: intake.promotedLeadId },
          data: { nextContactAt: newDue },
        });
      }
    });

    const updated = await db.intakeLead.findUnique({
      where: { id },
      select: {
        id: true,
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
            nextAction: updated.nextAction ?? null,
            nextActionDueAt: updated.nextActionDueAt?.toISOString() ?? null,
            followUpDueAt: updated.followUpDueAt?.toISOString() ?? null,
          }
        : null,
    });
  });
}
