import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { isValidHttpUrl, isGitHubUrl, isLoomUrl } from "@/lib/delivery/url";

const PostSchema = z.object({
  githubUrl: z.string().max(500).optional().nullable().or(z.literal("")),
  loomUrl: z.string().max(500).optional().nullable().or(z.literal("")),
  deliverySummary: z.string().max(5000).optional().nullable(),
  deliveryCompletedAt: z.string().datetime().optional().nullable().or(z.literal("")),
});

/** POST /api/intake-leads/[id]/delivery */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/delivery", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const intake = await db.intakeLead.findUnique({ where: { id } });
    if (!intake) return jsonError("Lead not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const githubVal = body.githubUrl?.trim();
    const loomVal = body.loomUrl?.trim();
    if (githubVal && !isGitHubUrl(githubVal)) {
      return jsonError("Invalid GitHub URL", 400, "VALIDATION");
    }
    if (loomVal && !isLoomUrl(loomVal)) {
      return jsonError("Invalid Loom URL", 400, "VALIDATION");
    }

    const deliveryCompletedAt =
      body.deliveryCompletedAt?.trim() && !Number.isNaN(new Date(body.deliveryCompletedAt).getTime())
        ? new Date(body.deliveryCompletedAt)
        : body.deliveryCompletedAt === ""
          ? null
          : undefined;

    const updateData: Record<string, unknown> = {};
    if (body.githubUrl !== undefined) updateData.githubUrl = githubVal || null;
    if (body.loomUrl !== undefined) updateData.loomUrl = loomVal || null;
    if (body.deliverySummary !== undefined) updateData.deliverySummary = body.deliverySummary?.trim() || null;
    if (body.deliveryCompletedAt !== undefined) updateData.deliveryCompletedAt = deliveryCompletedAt ?? null;

    await db.$transaction(async (tx) => {
      await tx.intakeLead.update({
        where: { id },
        data: updateData,
      });
      await tx.leadActivity.create({
        data: {
          intakeLeadId: id,
          type: LeadActivityType.delivery_logged,
          content: [
            githubVal && "GitHub link added",
            loomVal && "Loom link added",
            body.deliverySummary?.trim() && "Delivery summary updated",
          ]
            .filter(Boolean)
            .join(". ") || "Delivery evidence updated",
          metadataJson: {
            githubUrl: githubVal || null,
            loomUrl: loomVal || null,
            deliveryCompletedAt: deliveryCompletedAt?.toISOString() ?? null,
          },
        },
      });
    });

    const updated = await db.intakeLead.findUnique({
      where: { id },
      select: {
        githubUrl: true,
        loomUrl: true,
        deliverySummary: true,
        deliveryCompletedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      lead: updated
        ? {
            githubUrl: updated.githubUrl ?? null,
            loomUrl: updated.loomUrl ?? null,
            deliverySummary: updated.deliverySummary ?? null,
            deliveryCompletedAt: updated.deliveryCompletedAt?.toISOString() ?? null,
          }
        : null,
    });
  });
}
