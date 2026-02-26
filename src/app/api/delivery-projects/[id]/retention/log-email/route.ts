/**
 * POST /api/delivery-projects/[id]/retention/log-email — Log retention email contact.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/retention/log-email", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const note = parsed.success ? parsed.data.note : null;

    const now = new Date();
    const newCount = (project.retentionFollowUpCount ?? 0) + 1;

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          retentionLastContactedAt: now,
          retentionFollowUpCount: newCount,
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "retention_followup_email" as DeliveryActivityType,
          message: note ?? "Retention email logged",
          metaJson: note ? { note } : undefined,
        },
      });
    });

    return NextResponse.json({
      retentionLastContactedAt: now.toISOString(),
      retentionFollowUpCount: newCount,
    });
  });
}
