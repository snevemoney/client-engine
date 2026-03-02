/**
 * POST /api/delivery-projects/[id]/review/receive — Receive review.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { logInteraction } from "@/lib/interactions/service";

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
    const { project, session } = result;

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
      const activity = await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "review_received" as DeliveryActivityType,
          message: body.note ?? "Review received",
          metaJson: { platform, reviewUrl },
        },
      });
      await logInteraction({
        category: "review_received",
        summary: "Review received for delivery project",
        deliveryProjectId: id,
        channel: "email",
        direction: "inbound",
        actorType: "user",
        actorId: session.user?.id,
        sourceModel: "DeliveryActivity",
        sourceId: activity.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, tx as any);
    });

    return NextResponse.json({
      reviewReceivedAt: now.toISOString(),
      reviewPlatform: platform ?? null,
      reviewUrl: reviewUrl ?? null,
    });
  });
}
