/**
 * POST /api/delivery-projects/[id]/testimonial/request — Request testimonial.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/testimonial/request", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    const now = new Date();
    if (project.testimonialStatus === "requested" && project.testimonialRequestedAt) {
      return NextResponse.json({
        testimonialRequestedAt: project.testimonialRequestedAt.toISOString(),
        testimonialStatus: "requested",
        message: "Testimonial already requested",
      });
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          testimonialRequestedAt: now,
          testimonialStatus: "requested",
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "testimonial_requested" as DeliveryActivityType,
          message: "Testimonial requested",
        },
      });
    });

    return NextResponse.json({
      testimonialRequestedAt: now.toISOString(),
      testimonialStatus: "requested",
    });
  });
}
