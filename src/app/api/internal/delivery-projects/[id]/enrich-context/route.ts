/**
 * GET /api/internal/delivery-projects/[id]/enrich-context
 *
 * Returns project, lead, proposal, and artifacts for site-builder enrichment.
 * Site-builder fetches this and runs 9-phase enrichment internally.
 *
 * Auth: Bearer ENRICH_CONTEXT_SECRET, AGENT_CRON_SECRET, or session.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { ENRICHMENT_ARTIFACT_TYPE, ENRICHMENT_ARTIFACT_TITLE } from "@/lib/pipeline/enrich";

export const dynamic = "force-dynamic";

async function isAllowed(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const enrichSecret = process.env.ENRICH_CONTEXT_SECRET;
  const cronSecret = process.env.AGENT_CRON_SECRET;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (enrichSecret && token === enrichSecret) return true;
    if (cronSecret && token === cronSecret) return true;
  }
  const session = await auth();
  return !!session?.user;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming(
    "GET /api/internal/delivery-projects/[id]/enrich-context",
    async () => {
      if (!(await isAllowed(req))) {
        return jsonError("Unauthorized", 401);
      }

      const { id } = await params;

      const project = await db.deliveryProject.findUnique({
        where: { id },
        include: {
          pipelineLead: {
            select: {
              id: true,
              title: true,
              description: true,
              contactName: true,
              scoreVerdict: true,
              scoreReason: true,
            },
          },
          proposal: {
            select: { summary: true, scopeOfWork: true, title: true },
          },
        },
      });

      if (!project) {
        return jsonError("Project not found", 404);
      }

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
          db.artifact.findFirst({
            where: { leadId, type: "positioning" },
            orderBy: { createdAt: "desc" },
          }),
        ]);
      }

      const posData = (positionArtifact?.meta as Record<string, unknown> | null)
        ?.positioning as Record<string, unknown> | undefined;
      const lead = project.pipelineLead as
        | {
            title?: string;
            description?: string;
            contactName?: string;
            scoreVerdict?: string;
            scoreReason?: string;
          }
        | null;

      const proposal = project.proposal as {
        summary?: string | null;
        scopeOfWork?: string | null;
        title?: string;
      } | null;
      const proposalContent = proposal
        ? [proposal.summary, proposal.scopeOfWork].filter(Boolean).join("\n\n")
        : undefined;

      return NextResponse.json({
        project: {
          id: project.id,
          clientName: project.clientName ?? project.title,
          title: project.title,
          builderPreset: project.builderPreset ?? "custom",
          summary: project.summary,
        },
        lead: lead
          ? {
              title: lead.title,
              description: lead.description,
              contactName: lead.contactName,
              scoreVerdict: lead.scoreVerdict,
              scoreReason: lead.scoreReason,
            }
          : null,
        proposal: proposal
          ? {
              summary: proposal.summary,
              scopeOfWork: proposal.scopeOfWork,
              title: proposal.title,
            }
          : null,
        enrichArtifact: enrichArtifact
          ? {
              content: enrichArtifact.content,
              meta: enrichArtifact.meta,
            }
          : null,
        positionArtifact: positionArtifact
          ? {
              content: positionArtifact.content,
              meta: positionArtifact.meta,
            }
          : null,
        /** SiteBriefContext-compatible shape for site-builder runEnrichment */
        siteBriefContext: {
          clientName: project.clientName ?? project.title,
          title: project.title,
          industry: project.builderPreset ?? "custom",
          description: lead?.description ?? project.summary ?? undefined,
          feltProblem: posData?.feltProblem as string | undefined,
          reframedOffer: posData?.reframedOffer as string | undefined,
          blueOceanAngle: posData?.blueOceanAngle as string | undefined,
          languageMap: posData?.languageMap as unknown,
          packaging: posData?.packaging as { solutionName?: string; hookOneLiner?: string } | undefined,
          enrichmentSummary: enrichArtifact?.content?.slice(0, 800) ?? undefined,
          scoreVerdict: lead?.scoreVerdict ?? undefined,
          scoreReason: lead?.scoreReason ?? undefined,
          proposalContent: proposalContent?.slice(0, 2000),
        },
      });
    },
  );
}
