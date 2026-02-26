/**
 * POST /api/delivery-projects/[id]/referral/receive — Receive referral.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  notes: z.string().max(5000).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/referral/receive", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const body = parsed.success ? parsed.data : { notes: null, note: null };
    const notes = body.notes?.trim() || body.note?.trim() || project.referralNotes || null;

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          referralReceivedAt: now,
          referralStatus: "received",
          referralNotes: notes ?? undefined,
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "referral_received" as DeliveryActivityType,
          message: body.note ?? "Referral received",
          metaJson: { notes },
        },
      });
    });

    return NextResponse.json({
      referralReceivedAt: now.toISOString(),
      referralStatus: "received",
      referralNotes: notes ?? null,
    });
  });
}
