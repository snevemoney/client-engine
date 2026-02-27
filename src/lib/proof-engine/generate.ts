/**
 * Quiet Proof Engine: generate 6–10 line proof posts from real pipeline artifacts or intake proof candidates.
 * No hype, no invented numbers. Format: what I saw → cost → what I changed → result → quiet CTA.
 * When Client Success data exists (baseline + outcome scorecard), result lines use measurable outcomes.
 */

import { db } from "@/lib/db";
import { getClientSuccessData, buildProofSummaryFromSuccessData } from "@/lib/client-success";
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
 * Build proof post from an intake lead's proof candidates. No Artifact created (Artifact requires leadId).
 */
export async function buildProofPostFromIntakeLead(intakeLeadId: string): Promise<ProofPostResult | null> {
  const intake = await db.intakeLead.findUnique({
    where: { id: intakeLeadId },
    include: {
      proofCandidates: {
        where: { status: { in: ["ready", "promoted"] } },
        orderBy: { updatedAt: "desc" },
        take: 3,
      },
    },
  });

  if (!intake || intake.proofCandidates.length === 0) return null;

  const best = intake.proofCandidates[0];
  const saw = best.deliverySummary?.slice(0, 300) || best.proofSnippet?.slice(0, 300) || intake.title || "Won deal";
  const lines: string[] = [];
  lines.push(`Saw: ${saw.replace(/\s+/g, " ").slice(0, 120)}${saw.length > 120 ? "…" : ""}`);
  lines.push(`Cost: not measured for intake flow.`);
  if (best.beforeState || best.afterState) {
    const changed = [best.beforeState, best.afterState].filter(Boolean).join(" → ");
    lines.push(`Changed: ${changed.slice(0, 100)}${changed.length > 100 ? "…" : ""}`);
  } else if (best.proofSnippet) {
    lines.push(`Proof: ${best.proofSnippet.slice(0, 100)}${best.proofSnippet.length > 100 ? "…" : ""}`);
  } else {
    lines.push(`Changed: (from proof candidate).`);
  }
  if (best.metricValue && best.metricLabel) {
    lines.push(`Result: ${best.metricLabel} = ${best.metricValue}.`);
  } else {
    lines.push(`Result: deal won (intake).`);
  }
  lines.push(`If you want a small checklist for your own ops: comment CHECKLIST.`);

  return {
    lines,
    artifactIds: [],
    totalCostApprox: null,
    leadTitle: intake.title ?? "",
  };
}

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

  let lines = buildProofLines({
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

  // When Client Success data exists, inject result-focused lines (baseline → interventions → outcomes).
  const successData = await getClientSuccessData(leadId);
  const summary = buildProofSummaryFromSuccessData(successData);
  if (summary.resultTarget || summary.baselineBullets.length > 0 || summary.outcomeBullets.length > 0) {
    const resultLines: string[] = [];
    if (summary.resultTarget) {
      resultLines.push(`Target: ${summary.resultTarget}`);
    }
    if (summary.baselineBullets.length > 0) {
      resultLines.push(`Baseline: ${summary.baselineBullets.slice(0, 3).join("; ")}`);
    }
    if (summary.interventionBullets.length > 0) {
      resultLines.push(`Interventions: ${summary.interventionBullets.slice(0, 2).join("; ")}`);
    }
    if (summary.outcomeBullets.length > 0) {
      resultLines.push(`Outcome: ${summary.outcomeBullets.slice(0, 3).join("; ")}`);
    }
    // Insert after "Saw" and "Cost"
    const insertAt = Math.min(2, lines.length);
    lines = [...lines.slice(0, insertAt), ...resultLines, ...lines.slice(insertAt)];
  }

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
