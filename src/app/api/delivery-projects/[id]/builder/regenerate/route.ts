/**
 * POST /api/delivery-projects/[id]/builder/regenerate — regenerate site content
 *
 * Pulls enrichment + positioning artifacts from the linked lead, runs 9-phase
 * enrichSiteBrief, and passes full clientInfo + brandColors so generated copy
 * reflects the client's actual business with design spec from 9 skills.
 * Optional body: { context: string } — client feedback notes to incorporate.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { generateContent, getSiteWithSections } from "@/lib/builder/client";
import { db } from "@/lib/db";
import { getFallbackBrandColors } from "@/lib/builder/fallback-colors";
import { ENRICHMENT_ARTIFACT_TYPE, ENRICHMENT_ARTIFACT_TITLE } from "@/lib/pipeline/enrich";

export const maxDuration = 300;

const PostSchema = z.object({
  context: z.string().max(5000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming(
    "POST /api/delivery-projects/[id]/builder/regenerate",
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
              score: true,
              scoreReason: true,
              scoreVerdict: true,
            },
          },
        },
      });
      if (!result.ok) return result.response;
      const { project } = result;

      if (!project.builderSiteId) {
        return jsonError("No builder site linked to this project", 400, "NO_SITE");
      }

      const raw = await req.json().catch(() => ({}));
      const parsed = PostSchema.safeParse(raw);
      const contextFromBody = parsed.success ? parsed.data.context : undefined;

      // Get current site data to know which sections to regenerate
      let site;
      try {
        site = await getSiteWithSections(project.builderSiteId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Builder unavailable";
        console.error("[builder/regenerate] Failed to fetch site:", msg);
        return jsonError(msg, 502, "BUILDER_ERROR");
      }

      // Pull enrichment + positioning artifacts from the linked lead
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

      // Run 9-phase enrichment for design spec + content
      const { enrichSiteBrief, packContentHintsForBuilder } = await import("@/lib/builder/enrich-site-brief");
      const enrichment = await enrichSiteBrief(id);

      // Use short business summary for bio — NOT full proposal/enrichment artifact (avoids proposal text as section content)
      const shortSummary = (lead?.description ?? project.summary)?.slice(0, 400) ?? "";
      const contentHints = enrichment
        ? packContentHintsForBuilder(shortSummary, enrichment.clientInfo)
        : (shortSummary || (lead?.description ?? project.summary ?? "").slice(0, 800)) ?? "";

      // Client feedback: from body or latest client_note activities
      let clientFeedback = contextFromBody?.trim();
      if (!clientFeedback) {
        const clientNotes = await db.deliveryActivity.findMany({
          where: { deliveryProjectId: id, type: "client_note" },
          orderBy: { createdAt: "desc" },
          take: 5,
        });
        clientFeedback = clientNotes.map((n) => n.message).filter(Boolean).join("\n\n").trim() || undefined;
      }

      const bioWithFeedback = clientFeedback
        ? `${contentHints}\n\n[Client feedback to incorporate]\n${clientFeedback}`.trim()
        : contentHints;

      // Always use varied fallback on regenerate — enrichment.brandColors is often same each run
      const brandColors = getFallbackBrandColors(
        project.clientName ?? project.title,
        id,
        (project.builderPreset ?? "custom") as import("@/lib/builder/client").BuilderIndustryPreset,
        Date.now().toString(), // vary so each regenerate gets a fresh palette
      );

      const clientInfo = {
        name: project.clientName ?? lead?.contactName ?? project.title,
        niche: site.contentHints ?? (posData?.feltProblem as string | undefined),
        bio: bioWithFeedback,
        services: posData?.packaging ? [String(posData.packaging)] : undefined,
        tone: enrichment?.clientInfo?.tone ?? "professional, warm, approachable",
        feltProblem: posData?.feltProblem as string | undefined,
        reframedOffer: posData?.reframedOffer as string | undefined,
        blueOceanAngle: posData?.blueOceanAngle as string | undefined,
        languageMap: posData?.languageMap as string | undefined,
        scoreVerdict: lead?.scoreVerdict ?? undefined,
        scoreReason: lead?.scoreReason ?? undefined,
        enrichmentSummary: enrichArtifact?.content?.slice(0, 800),
        trustSensitivity: enrichData?.trustSensitivity as string | undefined,
        safeStartingPoint: enrichData?.safeStartingPoint as string | undefined,
        // 9-phase fields from enrichment
        heroHeadline: enrichment?.clientInfo?.heroHeadline,
        heroSubhead: enrichment?.clientInfo?.heroSubhead,
        ctaPrimary: enrichment?.clientInfo?.ctaPrimary,
        features: enrichment?.clientInfo?.features,
        testimonials: enrichment?.clientInfo?.testimonials,
        faq: enrichment?.clientInfo?.faq,
        footerTagline: enrichment?.clientInfo?.footerTagline,
        siteMap: enrichment?.siteMap,
        userFlows: enrichment?.userFlows,
        designSystem: enrichment?.designSystem,
        componentLogic: enrichment?.componentLogic,
        figmaMakeDesignIntent: enrichment?.figmaMakePrompts?.[0],
        animationSpecs: enrichment?.animationSpecs,
        responsiveSpecs: enrichment?.responsiveSpecs,
        dataIntegration: enrichment?.dataIntegration,
        qaChecklist: enrichment?.qaChecklist,
      };

      const genInput = {
        sections: site.sections.map((s) => s.type),
        brandColors,
        clientInfo,
      };

      console.log(
        "[builder/regenerate] genInput:",
        "sections=" + genInput.sections.length,
        "brandColors=" + brandColors.slice(0, 2).join(", ") + "...",
        "clientInfo.bio.length=" + (clientInfo.bio?.length ?? 0),
      );

      try {
        await generateContent(project.builderSiteId, genInput);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Content generation failed";
        console.error("[builder/regenerate] Generate failed:", msg);
        return jsonError(msg, 502, "BUILDER_ERROR");
      }

      // Quality check in background (fire-and-forget) — pass full genInput so auto-regenerate uses rich context
      import("@/lib/builder/quality-check")
        .then(({ checkAndReactToQuality }) =>
          checkAndReactToQuality(project.builderSiteId!, id, genInput),
        )
        .catch((err) => console.error("[builder/regenerate] Quality check failed:", err));

      // Re-fetch to get the updated sections
      let refreshed;
      try {
        refreshed = await getSiteWithSections(project.builderSiteId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Builder unavailable";
        console.error("[builder/regenerate] Failed to re-fetch site:", msg);
        return jsonError(msg, 502, "BUILDER_ERROR");
      }
      return NextResponse.json({ sections: refreshed.sections, status: refreshed.status });
    },
  );
}
