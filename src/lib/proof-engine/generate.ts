/**
 * Quiet Proof Engine: generate 6–10 line proof posts from real pipeline artifacts.
 * No hype, no invented numbers. Format: what I saw → cost → what I changed → result → quiet CTA.
 */

import { db } from "@/lib/db";
import { buildProofLines } from "./proof-lines";

export type ProofPostResult = {
  lines: string[];
  artifactIds: string[];
  totalCostApprox: number | null;
  leadTitle: string;
};

export type { ProofInput } from "./proof-lines";
export { buildProofLines } from "./proof-lines";

/**
 * Build a proof post from a lead's artifacts and pipeline runs.
 * Uses only real data; omits or says "approx" when unknown.
 */
export async function buildProofPost(leadId: string): Promise<ProofPostResult | null> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      artifacts: true,
      pipelineRuns: {
        include: { steps: true },
        orderBy: { startedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!lead) return null;

  const artifactIds: string[] = [];

  const enrichment = lead.artifacts.find(
    (a) => a.type === "notes" && a.title === "AI Enrichment Report"
  );
  const researchSnapshot = lead.artifacts.find(
    (a) => a.type === "research" && a.title === "RESEARCH_SNAPSHOT"
  );
  const sawRaw = lead.description?.trim() || enrichment?.content?.slice(0, 300) || researchSnapshot?.content?.slice(0, 300);
  const saw = sawRaw || lead.title?.slice(0, 80) || "Inbound request";
  if (enrichment) artifactIds.push(enrichment.id);
  if (researchSnapshot) artifactIds.push(researchSnapshot.id);

  let totalCost = 0;
  const seenSteps = new Set<string>();
  for (const run of lead.pipelineRuns) {
    for (const step of run.steps) {
      const key = `${run.id}-${step.stepName}`;
      if (step.costEstimate != null && !seenSteps.has(key)) {
        seenSteps.add(key);
        totalCost += step.costEstimate;
      }
    }
  }

  const positioning = lead.artifacts.find(
    (a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF"
  );
  const proposal = lead.artifacts.find((a) => a.type === "proposal");
  if (positioning) artifactIds.push(positioning.id);
  if (proposal) artifactIds.push(proposal.id);

  const reframedSnippet = positioning ? extractReframedOffer(positioning.content) : null;

  const lines = buildProofLines({
    saw: saw.length > 120 ? saw.slice(0, 120) : saw,
    totalCost,
    hasPositioning: !!positioning,
    hasProposal: !!proposal,
    reframedSnippet,
    dealOutcome: lead.dealOutcome,
    buildCompletedAt: lead.buildCompletedAt,
    buildStartedAt: lead.buildStartedAt,
    approvedAt: lead.approvedAt,
    leadTitle: lead.title,
  });

  return {
    lines,
    artifactIds: [...new Set(artifactIds)],
    totalCostApprox: totalCost > 0 ? totalCost : null,
    leadTitle: lead.title,
  };
}

function extractReframedOffer(content: string): string | null {
  const match = content.match(/reframedOffer|Reframed offer|outcome-first[:\s]*([^\n]+)/i);
  if (match) return match[1].trim();
  const jsonMatch = content.match(/"reframedOffer"\s*:\s*"([^"]+)"/);
  if (jsonMatch) return jsonMatch[1].trim();
  return null;
}
