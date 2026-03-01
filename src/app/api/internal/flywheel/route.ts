/**
 * POST /api/internal/flywheel
 *
 * Full agentic flywheel: takes prospect data and runs the entire pipeline
 * from lead creation through website build — zero manual steps.
 *
 * Prospect → Lead → Pipeline (enrich/score/position/propose)
 *   → Proposal (auto-send) → Accept → DeliveryProject → Builder
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { runFlywheel } from "@/lib/orchestrator/flywheel";

const PostSchema = z.object({
  title: z.string().min(1).max(500),
  source: z.string().max(100).optional(),
  sourceUrl: z.string().max(2000).optional(),
  description: z.string().max(10000).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  company: z.string().max(200).optional(),
  budget: z.string().max(200).optional(),
  timeline: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  builderPreset: z
    .enum([
      "health_coaching",
      "life_coaching",
      "business_coaching",
      "fitness",
      "consulting",
      "freelance",
      "agency",
      "custom",
    ])
    .optional(),
  builderScope: z.array(z.string()).optional(),
  contentHints: z.string().max(5000).optional(),
});

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/internal/flywheel", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues.map((i) => i.message).join("; "),
        400,
        "VALIDATION",
      );
    }

    const result = await runFlywheel(parsed.data);

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  });
}
