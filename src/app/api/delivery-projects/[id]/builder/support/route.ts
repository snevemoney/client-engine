/**
 * GET /api/delivery-projects/[id]/builder/support — list support requests for site
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { getSupportRequests } from "@/lib/builder/client";

type RouteCtx = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["open", "in_progress", "resolved"] as const;

export async function GET(
  req: NextRequest,
  { params }: RouteCtx,
) {
  return withRouteTiming(
    "GET /api/delivery-projects/[id]/builder/support",
    async () => {
      const { id } = await params;
      const result = await requireDeliveryProject(id);
      if (!result.ok) return result.response;
      const { project } = result;

      if (!project.builderSiteId) {
        return jsonError("No builder site linked to this project", 400, "NO_SITE");
      }

      const url = new URL(req.url);
      const rawStatus = url.searchParams.get("status") ?? undefined;
      const status = rawStatus && VALID_STATUSES.includes(rawStatus as typeof VALID_STATUSES[number])
        ? rawStatus
        : undefined;

      const requests = await getSupportRequests(project.builderSiteId, status);
      return NextResponse.json(requests);
    },
  );
}
