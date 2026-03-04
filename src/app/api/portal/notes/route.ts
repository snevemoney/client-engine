/**
 * POST /api/portal/notes
 *
 * Client note submission. Token in body. No auth.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { checkStateChangeRateLimit, jsonError, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  token: z.string().min(1, "Token required"),
  content: z.string().min(1, "Content required").max(10000),
});

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/portal/notes", async () => {
    const rl = checkStateChangeRateLimit(req, "portal-notes");
    if (rl) return rl;

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400, "VALIDATION");
    }

    const { token, content } = parsed.data;

    const project = await db.deliveryProject.findUnique({
      where: { clientToken: token },
    });
    if (!project) {
      return jsonError("Invalid or expired link", 404, "NOT_FOUND");
    }

    await db.deliveryActivity.create({
      data: {
        deliveryProjectId: project.id,
        type: "client_note" as DeliveryActivityType,
        message: content.trim(),
        metaJson: { source: "client", isBuilderFeedback: true },
      },
    });

    return NextResponse.json({ ok: true });
  });
}
