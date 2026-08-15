/**
 * POST /api/site-builder/[id]/export
 *
 * Export the full site specification as genInput. Requires all 9 phases approved.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { exportSiteBuildPlan } from "@/lib/site-builder/export";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming("POST /api/site-builder/[id]/export", async () => {
    const { id: deliveryProjectId } = await params;
    const result = await requireDeliveryProject(deliveryProjectId);
    if (!result.ok) return result.response;

    const plan = await db.siteBuildPlan.findUnique({
      where: { deliveryProjectId },
    });
    if (!plan) return jsonError("No site build plan", 404, "NOT_FOUND");

    const exportResult = await exportSiteBuildPlan(plan.id);
    if (!exportResult.ok) {
      return jsonError(exportResult.error, 400, "EXPORT_FAILED");
    }

    return NextResponse.json({
      ok: true,
      genInput: exportResult.genInput,
    });
  });
}
