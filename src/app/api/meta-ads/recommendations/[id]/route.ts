/**
 * PATCH /api/meta-ads/recommendations/[id]
 * Actions: approve, dismiss, reset
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { z } from "zod";

const BodySchema = z.object({
  action: z.enum(["approve", "dismiss", "reset", "false_positive"]),
});

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/meta-ads/recommendations/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    let body: z.infer<typeof BodySchema>;
    try {
      const json = await req.json();
      body = BodySchema.parse(json);
    } catch (e) {
      return jsonError(
        e instanceof z.ZodError ? e.issues.map((err) => err.message).join("; ") : "Invalid body",
        400
      );
    }

    const rec = await db.metaAdsRecommendation.findUnique({ where: { id } });
    if (!rec) return jsonError("Recommendation not found", 404);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (!accountId || (accountId.startsWith("act_") ? accountId : `act_${accountId}`) !== rec.accountId) {
      return jsonError("Forbidden", 403);
    }

    const now = new Date();
    let data: Record<string, unknown> = { updatedAt: now };

    if (body.action === "approve") {
      if (rec.status !== "queued" && rec.status !== "approved") {
        return jsonError(`Cannot approve from status ${rec.status}`, 400);
      }
      data = { ...data, status: "approved", approvedAt: now };
    } else if (body.action === "dismiss") {
      if (rec.status !== "queued" && rec.status !== "approved") {
        return jsonError(`Cannot dismiss from status ${rec.status}`, 400);
      }
      data = { ...data, status: "dismissed", dismissedAt: now };
    } else if (body.action === "reset") {
      if (!["approved", "dismissed", "false_positive"].includes(rec.status)) {
        return jsonError(`Cannot reset from status ${rec.status}`, 400);
      }
      data = { ...data, status: "queued", approvedAt: null, dismissedAt: null };
    } else if (body.action === "false_positive") {
      if (rec.status !== "queued" && rec.status !== "approved") {
        return jsonError(`Cannot mark false_positive from status ${rec.status}`, 400);
      }
      data = { ...data, status: "false_positive", approvedAt: null };
    }

    const updated = await db.metaAdsRecommendation.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  });
}
