/**
 * GET /api/delivery-projects/[id]/builder/feedback — get AI feedback on site quality
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { getSiteFeedback } from "@/lib/builder/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming(
    "GET /api/delivery-projects/[id]/builder/feedback",
    async () => {
      const { id } = await params;
      const result = await requireDeliveryProject(id);
      if (!result.ok) return result.response;
      const { project } = result;

      if (!project.builderSiteId) {
        return jsonError("No builder site linked to this project", 400, "NO_SITE");
      }

      try {
        const feedback = await getSiteFeedback(project.builderSiteId);
        return NextResponse.json(feedback);
      } catch (err) {
        console.error("[builder/feedback] Failed to fetch feedback:", err);
        return NextResponse.json(
          {
            siteId: project.builderSiteId,
            health: { score: 0, label: "unavailable", sectionCount: 0, issueCount: 0 },
            sectionScores: [],
            missingSections: [],
            suggestions: ["Builder service is temporarily unavailable. Try again later."],
          },
        );
      }
    },
  );
}
