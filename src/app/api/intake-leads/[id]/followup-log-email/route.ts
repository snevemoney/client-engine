import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { parseDate, isValidDate } from "@/lib/followup/dates";

const OUTCOMES = ["sent", "replied", "bounced", "other"] as const;

const PostSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
  outcome: z.enum(OUTCOMES).optional().default("other"),
  nextAction: z.string().max(2000).optional().nullable(),
  nextActionDueAt: z.string().max(50).optional().nullable(),
});

/** POST /api/intake-leads/[id]/followup-log-email */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/followup-log-email", async () => {
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
    const notePart = body.note?.trim() ? ` — ${body.note}` : "";
    const content = `Email (${body.outcome})${notePart}`;

    const nextAction =
      body.nextAction !== undefined ? (body.nextAction?.trim() ?? intake.nextAction) : intake.nextAction;
    const nextActionDueAtRaw = body.nextActionDueAt?.trim();
    const dueAt = nextActionDueAtRaw ? parseDate(nextActionDueAtRaw) : null;
    const validDue = dueAt && isValidDate(dueAt) ? dueAt : null;

    await db.$transaction(async (tx) => {
      await tx.intakeLead.update({
        where: { id },
        data: {
          lastContactedAt: now,
          followUpCount: (intake.followUpCount ?? 0) + 1,
          ...(body.nextAction !== undefined && { nextAction }),
          ...(validDue && { nextActionDueAt: validDue, followUpDueAt: validDue }),
        },
      });
      await tx.leadActivity.create({
        data: {
          intakeLeadId: id,
          type: LeadActivityType.followup_email,
          content,
          metadataJson: {
            outcome: body.outcome,
            note: body.note ?? null,
            nextAction: nextAction ?? null,
            nextActionDueAt: validDue?.toISOString() ?? null,
          },
        },
      });
      if (intake.promotedLeadId) {
        await tx.lead.update({
          where: { id: intake.promotedLeadId },
          data: {
            lastContactAt: now,
            ...(validDue && { nextContactAt: validDue }),
          },
        });
      }
    });

    const updated = await db.intakeLead.findUnique({
      where: { id },
      select: {
        id: true,
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
