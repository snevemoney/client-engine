/**
 * POST /api/delivery-projects/[id]/upsell — Log upsell opportunity.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType, RetentionStatus } from "@prisma/client";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  upsellOpportunity: z.string().min(1, "upsellOpportunity required").max(1000),
  upsellValueEstimate: z.number().int().min(0).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/upsell", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const newStatus: RetentionStatus =
      project.retentionStatus === "none" || project.retentionStatus === "monitoring"
        ? "upsell_open"
        : project.retentionStatus;

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          upsellOpportunity: body.upsellOpportunity,
          upsellValueEstimate: body.upsellValueEstimate ?? undefined,
          retentionStatus: newStatus,
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "upsell_logged" as DeliveryActivityType,
          message: body.note ?? `Upsell: ${body.upsellOpportunity}`,
          metaJson: {
            upsellOpportunity: body.upsellOpportunity,
            upsellValueEstimate: body.upsellValueEstimate,
          },
        },
      });
    });

    return NextResponse.json({
      upsellOpportunity: body.upsellOpportunity,
      upsellValueEstimate: body.upsellValueEstimate ?? null,
      retentionStatus: newStatus,
    });
  });
}
