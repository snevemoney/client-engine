/**
 * POST /api/delivery-projects/[id]/retention/schedule — Schedule retention follow-up.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliveryActivityType, RetentionStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  nextFollowUpAt: z.string().datetime(),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/retention/schedule", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError("nextFollowUpAt (ISO datetime) required", 400, "VALIDATION");
    }
    const body = parsed.data;

    const nextFollowUpAt = new Date(body.nextFollowUpAt);
    if (Number.isNaN(nextFollowUpAt.getTime())) {
      return jsonError("Invalid nextFollowUpAt", 400, "VALIDATION");
    }

    const newStatus: RetentionStatus =
      project.retentionStatus === "none" ? "followup_due" : project.retentionStatus;

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          retentionNextFollowUpAt: nextFollowUpAt,
          retentionStatus: newStatus,
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "retention_followup_scheduled" as DeliveryActivityType,
          message: body.note ?? "Retention follow-up scheduled",
          metaJson: { nextFollowUpAt: nextFollowUpAt.toISOString() },
        },
      });
    });

    return NextResponse.json({
      retentionNextFollowUpAt: nextFollowUpAt.toISOString(),
      retentionStatus: newStatus,
    });
  });
}
