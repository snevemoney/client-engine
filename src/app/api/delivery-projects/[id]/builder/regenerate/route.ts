/**
 * POST /api/delivery-projects/[id]/builder/regenerate — regenerate site content
 *
 * Pulls enrichment + positioning artifacts from the linked lead so generated
 * copy reflects the client's actual business, not generic placeholders.
 * Optional body: { context: string } — client feedback notes to incorporate.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { generateContent, getSiteWithSections } from "@/lib/builder/client";
import { db } from "@/lib/db";
import { ENRICHMENT_ARTIFACT_TYPE, ENRICHMENT_ARTIFACT_TITLE } from "@/lib/pipeline/enrich";

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
      const site = await getSiteWithSections(project.builderSiteId);

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

      const baseBio = enrichArtifact?.content?.slice(0, 1500) ?? lead?.description ?? project.summary ?? undefined;
      const bioWithFeedback = clientFeedback
        ? `${baseBio ?? ""}\n\n[Client feedback to incorporate]\n${clientFeedback}`.trim()
        : baseBio;

      await generateContent(project.builderSiteId, {
        sections: site.sections.map((s) => s.type),
        clientInfo: {
          name: project.clientName ?? lead?.contactName ?? project.title,
          niche: site.contentHints ?? (posData?.feltProblem as string | undefined),
          bio: bioWithFeedback,
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
      });

      // Quality check in background (fire-and-forget)
      import("@/lib/builder/quality-check")
        .then(({ checkAndReactToQuality }) =>
          checkAndReactToQuality(project.builderSiteId!, id, {
            sections: site.sections.map((s) => s.type),
            clientInfo: { name: project.clientName ?? project.title },
          }),
        )
        .catch((err) => console.error("[builder/regenerate] Quality check failed:", err));

      // Re-fetch to get the updated sections
      const refreshed = await getSiteWithSections(project.builderSiteId);
      return NextResponse.json({ sections: refreshed.sections, status: refreshed.status });
    },
  );
}
