/**
 * POST /api/delivery-projects/[id]/builder/create
 *
 * Trigger website creation in the builder service for a delivery project.
 * Creates the site from an industry preset, stores the siteId + previewUrl
 * on the DeliveryProject, and creates initial milestones.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { randomBytes } from "crypto";
import {
  createSite,
  generateContent,
  type BuilderIndustryPreset,
} from "@/lib/builder/client";
import { notifyClientPreview, getAppUrl } from "@/lib/notify";
import { ENRICHMENT_ARTIFACT_TYPE, ENRICHMENT_ARTIFACT_TITLE } from "@/lib/pipeline/enrich";

const PostSchema = z.object({
  industry: z
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
    .default("custom"),
  scope: z
    .array(z.string())
    .default(["homepage", "about", "services", "contact"]),
  brandColors: z.array(z.string()).optional(),
  contentHints: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming(
    "POST /api/delivery-projects/[id]/builder/create",
    async () => {
      const { id } = await params;
      const result = await requireDeliveryProject(id, {
        include: {
          pipelineLead: {
            select: {
              id: true,
              title: true,
              description: true,
              contactName: true,
              contactEmail: true,
              score: true,
              scoreReason: true,
              scoreVerdict: true,
            },
          },
        },
      });
      if (!result.ok) return result.response;
      const { project } = result;

      if (project.builderSiteId) {
        return jsonError(
          "This project already has a builder site",
          409,
          "ALREADY_EXISTS",
        );
      }

      const raw = await req.json().catch(() => null);
      const parsed = PostSchema.safeParse(raw);
      if (!parsed.success) {
        return jsonError(
          parsed.error.issues.map((i) => i.message).join("; "),
          400,
          "VALIDATION",
        );
      }

      const { industry, scope, brandColors, contentHints } = parsed.data;

      // 1. Create site in builder service
      const site = await createSite({
        clientName: project.clientName ?? project.title,
        industry: industry as BuilderIndustryPreset,
        scope,
        brandColors,
        contentHints,
        deliveryProjectId: id,
      });

      // 2. Store builder references on the delivery project
      await db.$transaction([
        db.deliveryProject.update({
          where: { id },
          data: {
            builderSiteId: site.siteId,
            builderPreviewUrl: site.previewUrl,
            builderPreset: industry,
          },
        }),
        db.deliveryActivity.create({
          data: {
            deliveryProjectId: id,
            type: "note",
            message: `Website builder site created (${industry} preset). Preview: ${site.previewUrl}`,
            metaJson: {
              action: "builder_site_created",
              siteId: site.siteId,
              preset: industry,
              scope,
            },
          },
        }),
        // 3. Create builder-specific milestones
        ...builderMilestones(id),
      ]);

      // Notify client when preview is ready (if contactEmail set; create portal token if needed)
      const contactEmail = (project.pipelineLead as { contactEmail?: string })?.contactEmail;
      if (contactEmail?.trim()) {
        let token = project.clientToken;
        if (!token) {
          token = randomBytes(18).toString("base64url");
          await db.deliveryProject.update({ where: { id }, data: { clientToken: token } });
        }
        notifyClientPreview(contactEmail.trim(), project.title, site.previewUrl, `${getAppUrl()}/portal/${token}`);
      }

      // 4. Pull enrichment + positioning artifacts from the linked lead
      const leadId = project.pipelineLeadId ?? project.intakeLeadId;
      let enrichArtifact: { content: string; meta: unknown } | null = null;
      let positionArtifact: { content: string; meta: unknown } | null = null;
      if (leadId) {
        [enrichArtifact, positionArtifact] = await Promise.all([
          db.artifact.findFirst({
            where: {
              leadId,
              OR: [
                { type: ENRICHMENT_ARTIFACT_TYPE, title: ENRICHMENT_ARTIFACT_TITLE },
                { type: "notes", title: ENRICHMENT_ARTIFACT_TITLE },
              ],
            },
            orderBy: { createdAt: "desc" },
          }),
          db.artifact.findFirst({ where: { leadId, type: "positioning" }, orderBy: { createdAt: "desc" } }),
        ]);
      }

      const posData = (positionArtifact?.meta as Record<string, unknown> | null)?.positioning as Record<string, unknown> | undefined;
      const enrichData = (enrichArtifact?.meta as Record<string, unknown> | null)?.leadIntelligence as Record<string, unknown> | undefined;
      const lead = project.pipelineLead as { title?: string; contactName?: string; description?: string; scoreVerdict?: string; scoreReason?: string } | null;

      const genInput = {
        sections: scope,
        clientInfo: {
          name: project.clientName ?? lead?.contactName ?? project.title,
          niche: contentHints ?? (posData?.feltProblem as string | undefined),
          bio: enrichArtifact?.content?.slice(0, 1500) ?? lead?.description ?? contentHints,
          services: posData?.packaging ? [String(posData.packaging)] : undefined,
          tone: "professional, warm, approachable",
          feltProblem: posData?.feltProblem as string | undefined,
          reframedOffer: posData?.reframedOffer as string | undefined,
          blueOceanAngle: posData?.blueOceanAngle as string | undefined,
          languageMap: posData?.languageMap as string | undefined,
          scoreVerdict: lead?.scoreVerdict ?? undefined,
          scoreReason: lead?.scoreReason ?? undefined,
          enrichmentSummary: enrichArtifact?.content?.slice(0, 800),
          trustSensitivity: enrichData?.trustSensitivity as string | undefined,
          safeStartingPoint: enrichData?.safeStartingPoint as string | undefined,
        },
      };
      generateContent(site.siteId, genInput).then(async () => {
        try {
          const { checkAndReactToQuality } = await import("@/lib/builder/quality-check");
          await checkAndReactToQuality(site.siteId, id, genInput);
        } catch (qErr) {
          console.error("[builder/create] Quality check failed:", qErr);
        }
      }).catch((err) =>
        console.error("[builder/create] Content generation failed:", err),
      );

      return NextResponse.json({
        siteId: site.siteId,
        previewUrl: site.previewUrl,
        status: site.status,
      });
    },
  );
}

function builderMilestones(deliveryProjectId: string) {
  const milestones = [
    { title: "Template Setup", sortOrder: 0 },
    { title: "Content Generation", sortOrder: 1 },
    { title: "Design Review", sortOrder: 2 },
    { title: "Client Feedback", sortOrder: 3 },
    { title: "Deploy to Production", sortOrder: 4 },
  ];

  return milestones.map((m) =>
    db.deliveryMilestone.create({
      data: {
        deliveryProjectId,
        title: m.title,
        sortOrder: m.sortOrder,
        status: "todo",
      },
    }),
  );
}
