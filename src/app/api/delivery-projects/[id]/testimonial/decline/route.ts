/**
 * POST /api/delivery-projects/[id]/testimonial/decline — Decline testimonial.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/testimonial/decline", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    if (project.testimonialStatus === "declined") {
      return NextResponse.json({
        testimonialStatus: "declined",
        message: "Testimonial already declined",
      });
    }

    await db.deliveryProject.update({
      where: { id },
      data: { testimonialStatus: "declined" },
    });

    return NextResponse.json({ testimonialStatus: "declined" });
  });
}
