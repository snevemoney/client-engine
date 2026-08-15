/**
 * Site Build Pipeline — build phase context from project, lead, proposal, and prior phases.
 */

import { db } from "@/lib/db";
import { ENRICHMENT_ARTIFACT_TYPE, ENRICHMENT_ARTIFACT_TITLE } from "@/lib/pipeline/enrich";
import type { SiteBriefContext } from "@/lib/builder/site-brief-prompt";

export type PhaseContext = SiteBriefContext & {
  priorPhases: Record<string, unknown>;
};

/**
 * Build full context for a phase run: DeliveryProject, Proposal, Lead, and all
 * previous approved phase artifact outputs.
 */
export async function buildPhaseContext(
  planId: string,
  phaseNum: number,
): Promise<PhaseContext | null> {
  const plan = await db.siteBuildPlan.findUnique({
    where: { id: planId },
    include: {
      deliveryProject: {
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
      },
      phases: {
        where: { phaseNum: { lt: phaseNum }, status: "approved" },
        include: { outputArtifact: true },
        orderBy: { phaseNum: "asc" },
      },
    },
  });

  if (!plan?.deliveryProject) return null;

  const project = plan.deliveryProject;
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

  const proposal = project.proposal as { summary?: string | null; scopeOfWork?: string | null; title?: string } | null;
  const proposalContent = proposal
    ? [proposal.summary, proposal.scopeOfWork].filter(Boolean).join("\n\n")
    : undefined;

  const priorPhases: Record<string, unknown> = {};
  for (const phase of plan.phases) {
    if (phase.outputArtifact?.meta) {
      const meta = phase.outputArtifact.meta as Record<string, unknown>;
      Object.assign(priorPhases, meta);
    }
  }

  const ctx: PhaseContext = {
    clientName: project.clientName ?? project.title,
    title: project.title,
    industry: project.builderPreset ?? "custom",
    description: lead?.description ?? project.summary ?? undefined,
    feltProblem: posData?.feltProblem as string | undefined,
    reframedOffer: posData?.reframedOffer as string | undefined,
    blueOceanAngle: posData?.blueOceanAngle as string | undefined,
    languageMap: posData?.languageMap as unknown,
    packaging: posData?.packaging as SiteBriefContext["packaging"],
    enrichmentSummary: enrichArtifact?.content?.slice(0, 800) ?? undefined,
    scoreVerdict: lead?.scoreVerdict ?? undefined,
    scoreReason: lead?.scoreReason ?? undefined,
    proposalContent: proposalContent?.slice(0, 2000),
    priorPhases,
  };

  return ctx;
}
