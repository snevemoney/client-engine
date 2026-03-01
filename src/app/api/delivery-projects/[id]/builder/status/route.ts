/**
 * GET /api/delivery-projects/[id]/builder/status
 *
 * Fetch the current builder site status from the builder service
 * and sync preview/live URLs if they've changed.
 * Falls back to cached data if the builder service is unreachable.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { getSiteStatus } from "@/lib/builder/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming(
    "GET /api/delivery-projects/[id]/builder/status",
    async () => {
      const { id } = await params;
      const result = await requireDeliveryProject(id);
      if (!result.ok) return result.response;
      const { project } = result;

      if (!project.builderSiteId) {
        return jsonError("No builder site linked to this project", 400, "NO_SITE");
      }

      let site;
      try {
        site = await getSiteStatus(project.builderSiteId);
      } catch (err) {
        // Builder service unreachable — return cached data instead of crashing
        console.error("[builder/status] Builder service error:", err);
        return NextResponse.json({
          siteId: project.builderSiteId,
          status: "unknown",
          previewUrl: project.builderPreviewUrl,
          liveUrl: project.builderLiveUrl,
          pages: [],
          serviceDown: true,
        });
      }

      // Sync URLs if they've changed
      const updates: Record<string, string> = {};
      if (site.previewUrl && site.previewUrl !== project.builderPreviewUrl) {
        updates.builderPreviewUrl = site.previewUrl;
      }
      if (site.liveUrl && site.liveUrl !== project.builderLiveUrl) {
        updates.builderLiveUrl = site.liveUrl;
        updates.artifactUrl = site.liveUrl;
      }

      if (Object.keys(updates).length > 0) {
        await db.deliveryProject.update({
          where: { id },
          data: updates,
        });
      }

      return NextResponse.json({
        siteId: site.siteId,
        status: site.status,
        previewUrl: site.previewUrl,
        liveUrl: site.liveUrl,
        pages: site.pages,
      });
    },
  );
}
