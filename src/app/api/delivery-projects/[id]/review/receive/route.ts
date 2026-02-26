/**
 * POST /api/delivery-projects/[id]/review/receive — Receive review.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  platform: z.string().max(100).optional().nullable(),
  reviewUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/review/receive", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const body = parsed.success ? parsed.data : { platform: null, reviewUrl: null, note: null };

    const now = new Date();
    const platform = body.platform?.trim() || project.reviewPlatform || null;
    const reviewUrl = body.reviewUrl?.trim() || project.reviewUrl || null;

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          reviewReceivedAt: now,
          reviewPlatform: platform ?? undefined,
          reviewUrl: reviewUrl ?? undefined,
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "review_received" as DeliveryActivityType,
          message: body.note ?? "Review received",
          metaJson: { platform, reviewUrl },
        },
      });
    });

    return NextResponse.json({
      reviewReceivedAt: now.toISOString(),
      reviewPlatform: platform ?? null,
      reviewUrl: reviewUrl ?? null,
    });
  });
}
