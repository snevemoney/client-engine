/**
 * Pipeline step handlers — extracted from orchestrator for clarity.
 * Each step receives the current lead state; updates in-memory state when it runs.
 */
import { db } from "@/lib/db";
import { finishStep } from "@/lib/pipeline-metrics";
import { normalizeUsage } from "@/lib/pipeline/usage";
import { runEnrich } from "@/lib/pipeline/enrich";
import { runScore } from "@/lib/pipeline/score";
import { runPositioning } from "@/lib/pipeline/positioning";
import { runPropose } from "@/lib/pipeline/propose";
import { buildProvenance } from "@/lib/pipeline/provenance";
import { trackPipelineEvent } from "@/lib/analytics";
import { upsertArtifact } from "@/lib/pinecone";

export type LeadWithArtifacts = {
  id: string;
  title: string;
  status: string | null;
  scoredAt: Date | null;
  artifacts: { type: string; title?: string }[];
};

function hasEnrichment(artifacts: { type: string; title?: string }[]): boolean {
  return artifacts.some((a) => a.type === "notes" && a.title === "AI Enrichment Report");
}

function hasScore(lead: { scoredAt: Date | null }): boolean {
  return lead.scoredAt != null;
}

function hasPositioning(artifacts: { type: string; title?: string }[]): boolean {
  return artifacts.some((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");
}

function hasProposal(artifacts: { type: string }[]): boolean {
  return artifacts.some((a) => a.type === "proposal");
}

/** Apply in-memory update after step runs. Mutates current. */
function applyEnrichDelta(current: LeadWithArtifacts): void {
  current.artifacts.push({ type: "notes", title: "AI Enrichment Report" });
}

function applyScoreDelta(current: LeadWithArtifacts): void {
  (current as LeadWithArtifacts & { scoredAt: Date | null }).scoredAt = new Date();
}

function applyPositionDelta(current: LeadWithArtifacts): void {
  current.artifacts.push({ type: "positioning", title: "POSITIONING_BRIEF" });
}

function applyProposeDelta(current: LeadWithArtifacts): void {
  current.artifacts.push({ type: "proposal" });
}

export async function runEnrichStep(
  leadId: string,
  runId: string,
  stepId: string,
  current: LeadWithArtifacts
): Promise<{ skipped: boolean }> {
  if (hasEnrichment(current.artifacts)) {
    await finishStep(stepId, { success: true, notes: "skipped: artifact exists" });
    return { skipped: true };
  }
  const provenance = buildProvenance(runId, "enrich", { temperature: 0.3 });
  const { artifactId, usage } = await runEnrich(leadId, provenance);
  const norm = normalizeUsage(usage ?? {}, "gpt-4o-mini");
  await finishStep(stepId, {
    success: true,
    outputArtifactIds: [artifactId],
    tokensUsed: norm.tokensUsed,
    costEstimate: norm.costEstimate,
  });
  trackPipelineEvent(leadId, "lead_enriched", { runId });
  db.artifact.findUnique({ where: { id: artifactId } }).then((a) => a && upsertArtifact(a).catch(() => {}));
  applyEnrichDelta(current);
  return { skipped: false };
}

export async function runScoreStep(
  leadId: string,
  runId: string,
  stepId: string,
  current: LeadWithArtifacts
): Promise<{ skipped: boolean }> {
  if (hasScore(current)) {
    await finishStep(stepId, { success: true, notes: "skipped: artifact exists" });
    return { skipped: true };
  }
  const { usage } = await runScore(leadId);
  const norm = normalizeUsage(usage ?? {}, "gpt-4o-mini");
  await finishStep(stepId, {
    success: true,
    tokensUsed: norm.tokensUsed,
    costEstimate: norm.costEstimate,
  });
  trackPipelineEvent(leadId, "lead_scored", { runId });
  applyScoreDelta(current);
  return { skipped: false };
}

export async function runPositionStep(
  leadId: string,
  runId: string,
  stepId: string,
  current: LeadWithArtifacts
): Promise<{ skipped: boolean }> {
  if (hasPositioning(current.artifacts)) {
    await finishStep(stepId, { success: true, notes: "skipped: artifact exists" });
    return { skipped: true };
  }
  const provenance = buildProvenance(runId, "position", { temperature: 0.4 });
  const { artifactId, usage } = await runPositioning(leadId, provenance);
  const norm = normalizeUsage(usage ?? {}, "gpt-4o-mini");
  await finishStep(stepId, {
    success: true,
    outputArtifactIds: [artifactId],
    tokensUsed: norm.tokensUsed,
    costEstimate: norm.costEstimate,
  });
  trackPipelineEvent(leadId, "lead_positioned", { runId });
  db.artifact.findUnique({ where: { id: artifactId } }).then((a) => a && upsertArtifact(a).catch(() => {}));
  applyPositionDelta(current);
  return { skipped: false };
}

export async function runProposeStep(
  leadId: string,
  runId: string,
  stepId: string,
  current: LeadWithArtifacts
): Promise<{ skipped: boolean }> {
  if (hasProposal(current.artifacts)) {
    await finishStep(stepId, { success: true, notes: "skipped: artifact exists" });
    return { skipped: true };
  }
  const provenance = buildProvenance(runId, "propose", { temperature: 0.6 });
  const { artifactId, usage } = await runPropose(leadId, provenance);
  const norm = normalizeUsage(usage ?? {}, "gpt-4o-mini");
  await finishStep(stepId, {
    success: true,
    outputArtifactIds: [artifactId],
    tokensUsed: norm.tokensUsed,
    costEstimate: norm.costEstimate,
  });
  trackPipelineEvent(leadId, "lead_proposed", { runId });
  db.artifact.findUnique({ where: { id: artifactId } }).then((a) => a && upsertArtifact(a).catch(() => {}));
  applyProposeDelta(current);
  return { skipped: false };
}
