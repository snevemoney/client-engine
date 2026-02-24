import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { LeadActivityType } from "@prisma/client";

const PostSchema = z.object({
  nextAction: z.string().max(2000).optional().nullable(),
  followUpDueAt: z.string().max(50).optional().nullable().or(z.literal("")),
});

/** POST /api/intake-leads/[id]/set-followup */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/set-followup", async () => {
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

    let dueAt: Date | null = null;
    if (body.followUpDueAt?.trim()) {
      try {
        dueAt = new Date(body.followUpDueAt.trim());
        if (Number.isNaN(dueAt.getTime())) dueAt = null;
      } catch {
        dueAt = null;
      }
    }

    const nextAction = body.nextAction?.trim() ?? intake.nextAction;

    await db.$transaction(async (tx) => {
      await tx.intakeLead.update({
        where: { id },
        data: {
          nextAction: nextAction || null,
          nextActionDueAt: dueAt,
          followUpDueAt: dueAt ?? intake.followUpDueAt,
        },
      });
      await tx.leadActivity.create({
        data: {
          intakeLeadId: id,
          type: LeadActivityType.followup,
          content: nextAction
            ? `Follow-up: ${nextAction}${dueAt ? ` (due ${dueAt.toISOString()})` : ""}`
            : "Follow-up set",
          metadataJson: {
            nextAction: nextAction || null,
            followUpDueAt: dueAt?.toISOString() ?? null,
          },
        },
      });
      if (intake.promotedLeadId && intake.promotedLead && dueAt) {
        await tx.lead.update({
          where: { id: intake.promotedLeadId },
          data: { nextContactAt: dueAt },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      nextAction: nextAction ?? null,
      followUpDueAt: dueAt?.toISOString() ?? null,
    });
  });
}
