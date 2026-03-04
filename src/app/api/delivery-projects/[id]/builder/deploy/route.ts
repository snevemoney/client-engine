/**
 * POST /api/delivery-projects/[id]/builder/deploy
 *
 * Queues deploy as BullMQ job when Redis available; returns 202 with jobId.
 * Falls back to sync deploy when Redis unavailable (e.g. dev without Redis).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { deploySite, getSiteStatus, type BuilderSiteStatus } from "@/lib/builder/client";
import { addDeployJob } from "@/lib/builder/deploy-queue";

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

      // Queue when Redis available; return 202
      if (process.env.REDIS_URL) {
        try {
          const jobId = await addDeployJob({
            deliveryProjectId: id,
            siteId: project.builderSiteId,
            domain,
          });
          return NextResponse.json(
            { jobId, status: "queued", message: "Deploy queued. Poll /builder/deploy/status?jobId=" + jobId },
            { status: 202 }
          );
        } catch (e) {
          console.warn("[builder/deploy] Queue failed, falling back to sync:", e);
        }
      }

      // Fallback: sync deploy (dev without Redis)
      const deployed = await deploySite(project.builderSiteId, domain);
      await db.$transaction([
        db.deliveryProject.update({
          where: { id },
          data: { builderLiveUrl: deployed.liveUrl, artifactUrl: deployed.liveUrl },
        }),
        db.deliveryActivity.create({
          data: {
            deliveryProjectId: id,
            type: "note",
            message: `Website deployed to production: ${deployed.liveUrl}`,
            metaJson: { action: "builder_site_deployed", siteId: deployed.siteId, liveUrl: deployed.liveUrl },
          },
        }),
      ]);
      return NextResponse.json({ siteId: deployed.siteId, liveUrl: deployed.liveUrl, status: "live" });
    },
  );
}
