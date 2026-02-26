/**
 * POST /api/delivery-projects/[id]/review/request — Request review.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  platform: z.string().max(100).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/review/request", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const body = parsed.success ? parsed.data : { platform: null, note: null };

    const now = new Date();
    if (project.reviewRequestedAt) {
      const updated = await db.deliveryProject.update({
        where: { id },
        data: { reviewPlatform: body.platform ?? project.reviewPlatform },
      });
      return NextResponse.json({
        reviewRequestedAt: updated.reviewRequestedAt?.toISOString() ?? null,
        reviewPlatform: updated.reviewPlatform ?? null,
        message: "Review already requested; platform updated",
      });
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          reviewRequestedAt: now,
          reviewPlatform: body.platform ?? undefined,
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "review_requested" as DeliveryActivityType,
          message: body.note ?? "Review requested",
          metaJson: { platform: body.platform },
        },
      });
    });

    return NextResponse.json({
      reviewRequestedAt: now.toISOString(),
      reviewPlatform: body.platform ?? null,
    });
  });
}
