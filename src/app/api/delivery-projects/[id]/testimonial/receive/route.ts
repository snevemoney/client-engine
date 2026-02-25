/**
 * POST /api/delivery-projects/[id]/testimonial/receive — Receive testimonial.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  quote: z.string().max(10000).optional().nullable(),
  sourceUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/testimonial/receive", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const body = parsed.success ? parsed.data : { quote: null, sourceUrl: null, note: null };

    const now = new Date();
    const quote = body.quote?.trim() || project.testimonialQuote;
    const sourceUrl = body.sourceUrl?.trim() || project.testimonialSourceUrl || null;

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          testimonialReceivedAt: now,
          testimonialStatus: "received",
          testimonialQuote: quote ?? undefined,
          testimonialSourceUrl: sourceUrl ?? undefined,
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "testimonial_received" as DeliveryActivityType,
          message: body.note ?? "Testimonial received",
          metaJson: { quote, sourceUrl },
        },
      });
    });

    return NextResponse.json({
      testimonialReceivedAt: now.toISOString(),
      testimonialStatus: "received",
      testimonialQuote: quote ?? null,
      testimonialSourceUrl: sourceUrl ?? null,
    });
  });
}
