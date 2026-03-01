/**
 * POST /api/delivery-projects/[id]/builder/deploy
 *
 * Deploy the builder site to production. Validates that content generation
 * is complete before deploying. Stores the live URL on the delivery project.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { deploySite, getSiteStatus, type BuilderSiteStatus } from "@/lib/builder/client";

const DEPLOY_BLOCKED_STATUSES: BuilderSiteStatus[] = ["creating", "content_generating", "error"];

const PostSchema = z.object({
  domain: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming(
    "POST /api/delivery-projects/[id]/builder/deploy",
    async () => {
      const { id } = await params;
      const result = await requireDeliveryProject(id);
      if (!result.ok) return result.response;
      const { project } = result;

      if (!project.builderSiteId) {
        return jsonError("No builder site linked to this project", 400, "NO_SITE");
      }

      // Check site status before deploying
      const site = await getSiteStatus(project.builderSiteId);
      if (DEPLOY_BLOCKED_STATUSES.includes(site.status)) {
        return jsonError(
          `Cannot deploy while site is "${site.status}". Wait for content generation to finish.`,
          409,
          "NOT_READY",
        );
      }

      const raw = await req.json().catch(() => ({}));
      const parsed = PostSchema.safeParse(raw);
      const domain = parsed.success ? parsed.data.domain : undefined;

      const deployed = await deploySite(project.builderSiteId, domain);

      await db.$transaction([
        db.deliveryProject.update({
          where: { id },
          data: {
            builderLiveUrl: deployed.liveUrl,
            artifactUrl: deployed.liveUrl,
          },
        }),
        db.deliveryActivity.create({
          data: {
            deliveryProjectId: id,
            type: "note",
            message: `Website deployed to production: ${deployed.liveUrl}`,
            metaJson: {
              action: "builder_site_deployed",
              siteId: deployed.siteId,
              liveUrl: deployed.liveUrl,
            },
          },
        }),
      ]);

      return NextResponse.json({
        siteId: deployed.siteId,
        liveUrl: deployed.liveUrl,
        status: "live",
      });
    },
  );
}
