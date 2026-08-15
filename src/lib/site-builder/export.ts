/**
 * Site Build Pipeline — export genInput from approved phase artifacts.
 */

import { db } from "@/lib/db";
import { ENRICHMENT_ARTIFACT_TYPE, ENRICHMENT_ARTIFACT_TITLE } from "@/lib/pipeline/enrich";
import { packContentHintsForBuilder } from "@/lib/builder/enrich-site-brief";

const orNull = <T>(v: T | undefined): T | null => (v != null && v !== "" ? v : null);

export type ExportResult =
  | { ok: true; genInput: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Build genInput (GenerateContentInput shape) from approved phase artifacts.
 * Requires all 9 phases approved.
 */
export async function exportSiteBuildPlan(planId: string): Promise<ExportResult> {
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
          proposal: { select: { summary: true, scopeOfWork: true } },
        },
      },
      phases: {
        where: { status: "approved" },
        include: { outputArtifact: true },
        orderBy: { phaseNum: "asc" },
      },
    },
  });

  if (!plan) return { ok: false, error: "Plan not found" };
  if (plan.phases.length !== 9) {
    return { ok: false, error: `All 9 phases must be approved (${plan.phases.length}/9)` };
  }

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
      db.artifact.findFirst({ where: { leadId, type: "positioning" }, orderBy: { createdAt: "desc" } }),
    ]);
  }

  const posData = (positionArtifact?.meta as Record<string, unknown> | null)
    ?.positioning as Record<string, unknown> | undefined;
  const lead = project.pipelineLead as {
    title?: string;
    contactName?: string;
    description?: string;
    scoreVerdict?: string;
    scoreReason?: string;
  } | null;

  const merged: Record<string, unknown> = {};
  for (const phase of plan.phases) {
    if (phase.outputArtifact?.meta) {
      Object.assign(merged, phase.outputArtifact.meta as Record<string, unknown>);
    }
  }

  const scope = Array.isArray(merged.scope) && merged.scope.length
    ? (merged.scope as string[])
    : ["homepage", "about", "services", "contact"];
  const contentHints = packContentHintsForBuilder(
    merged.contentHints as string | undefined,
    merged.clientInfo as Record<string, unknown> | undefined,
  );

  const clientInfo = merged.clientInfo as Record<string, unknown> | undefined;

  const genInput = {
    sections: scope,
    brandColors: merged.brandColors as string[] | undefined,
    clientInfo: {
      name: project.clientName ?? lead?.contactName ?? project.title,
      niche: (posData?.feltProblem as string | undefined) ?? undefined,
      bio: contentHints ?? enrichArtifact?.content?.slice(0, 1500) ?? lead?.description ?? undefined,
      heroHeadline: clientInfo?.heroHeadline,
      heroSubhead: clientInfo?.heroSubhead,
      ctaPrimary: clientInfo?.ctaPrimary,
      features: clientInfo?.features,
      testimonials: clientInfo?.testimonials,
      faq: clientInfo?.faq,
      footerTagline: clientInfo?.footerTagline,
      designSystem: orNull(merged.designSystem as object | undefined),
      componentLogic: orNull(merged.componentLogic as string | undefined),
      figmaMakeDesignIntent: orNull((merged.figmaMakePrompts as string[])?.[0]),
      animationSpecs: orNull(merged.animationSpecs as string | undefined),
      responsiveSpecs: orNull(merged.responsiveSpecs as string | undefined),
      dataIntegration: orNull(merged.dataIntegration as string | undefined),
      qaChecklist: orNull(merged.qaChecklist as string | undefined),
      siteMap: orNull(merged.siteMap as string | undefined),
      userFlows: orNull(merged.userFlows as string | undefined),
      tone: (clientInfo?.tone as string) ?? "professional, warm, approachable",
      feltProblem: posData?.feltProblem as string | undefined,
      reframedOffer: posData?.reframedOffer as string | undefined,
      blueOceanAngle: posData?.blueOceanAngle as string | undefined,
      languageMap: posData?.languageMap as string | undefined,
      scoreVerdict: lead?.scoreVerdict ?? undefined,
      scoreReason: lead?.scoreReason ?? undefined,
      enrichmentSummary: enrichArtifact?.content?.slice(0, 800),
    },
  };

  return { ok: true, genInput };
}
