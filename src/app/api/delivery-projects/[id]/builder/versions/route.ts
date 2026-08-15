/**
 * GET /api/delivery-projects/[id]/builder/versions — List section version history.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { getSectionVersions } from "@/lib/builder/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming(
    "GET /api/delivery-projects/[id]/builder/versions",
    async () => {
      const { id } = await params;
      const result = await requireDeliveryProject(id);
      if (!result.ok) return result.response;
      const { project } = result;

      if (!project.builderSiteId) {
        return NextResponse.json(
          { error: "No builder site for this project" },
          { status: 404 },
        );
      }

      try {
        const data = await getSectionVersions(project.builderSiteId);
        return NextResponse.json(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch versions";
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    },
  );
}
