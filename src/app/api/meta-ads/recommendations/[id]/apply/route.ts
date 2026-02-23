/**
 * POST /api/meta-ads/recommendations/[id]/apply
 * Executes Meta action. Uses shared apply service. Respects settings dryRun. Enforces guardrails.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { applyRecommendation } from "@/lib/meta-ads/apply-recommendation";
import { z } from "zod";

const BodySchema = z.object({
  forceQueued: z.boolean().optional().default(false),
});

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/meta-ads/recommendations/[id]/apply", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    let body: z.infer<typeof BodySchema>;
    try {
      const json = await req.json().catch(() => ({}));
      body = BodySchema.parse(json);
    } catch (e) {
      return jsonError(
        e instanceof z.ZodError ? e.issues.map((err) => err.message).join("; ") : "Invalid body",
        400
      );
    }

    const result = await applyRecommendation(id, {
      triggeredBy: "user",
      forceQueued: body.forceQueued,
    });

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        result: {
          outcome: result.outcome,
          simulated: result.simulated,
        },
      });
    }

    if (result.outcome === "skipped") {
      if (result.code === "not_found") return jsonError(result.error, 404);
      if (result.code === "forbidden") return jsonError(result.error, 403);
      return jsonError(result.error, 400);
    }
    if (result.outcome === "blocked") return jsonError(result.error, 409);
    return jsonError(result.error, 500);
  });
}
