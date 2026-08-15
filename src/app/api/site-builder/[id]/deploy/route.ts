/**
 * POST /api/site-builder/[id]/deploy
 *
 * Deploy the site to production. Proxies to builder deploy.
 * Blocked unless all 9 phases approved. Phase 9 QA verdict READY recommended.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming("POST /api/site-builder/[id]/deploy", async () => {
    const { id: deliveryProjectId } = await params;
    const result = await requireDeliveryProject(deliveryProjectId);
    if (!result.ok) return result.response;

    const plan = await db.siteBuildPlan.findUnique({
      where: { deliveryProjectId },
    });
    if (!plan) return jsonError("No site build plan", 404, "NOT_FOUND");
    if (plan.phasesCompleted.length !== 9) {
      return jsonError("All 9 phases must be approved before deploy", 400, "PHASES_INCOMPLETE");
    }

    const project = await db.deliveryProject.findUnique({
      where: { id: deliveryProjectId },
      select: { builderSiteId: true },
    });
    if (!project?.builderSiteId) {
      return jsonError("No builder site; create site first via builder/create", 400, "NO_SITE");
    }

    const { deploySite } = await import("@/lib/builder/client");
    const deployResult = await deploySite(project.builderSiteId);

    return NextResponse.json({
      ok: true,
      liveUrl: deployResult.liveUrl,
      status: deployResult.status,
    });
  });
}
