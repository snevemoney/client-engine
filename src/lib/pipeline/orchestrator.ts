import { db } from "@/lib/db";
import { createRun, startStep, finishStep, finishRun } from "@/lib/pipeline-metrics";
import { tryAdvisoryLock, releaseAdvisoryLock } from "@/lib/db-lock";
import { normalizeUsage } from "@/lib/pipeline/usage";
import { runEnrich } from "@/lib/pipeline/enrich";
import { runScore } from "@/lib/pipeline/score";
import { runPositioning } from "@/lib/pipeline/positioning";
import { runPropose } from "@/lib/pipeline/propose";

const PIPELINE_STEPS = ["enrich", "score", "position", "propose"] as const;

export type PipelineRunResult =
  | { run: true; runId: string; stepsRun: number; stepsSkipped: number }
  | { run: false; reason: string };

/**
 * Strict eligibility for auto-run. No Build in auto pipeline; Build remains gated and manual.
 */
export function isEligibleForAutoRun(lead: {
  status: string;
  project?: { id: string } | null;
}): boolean {
  if (lead.status === "REJECTED") return false;
  if (lead.project != null) return false;
  return true;
}

function hasEnrichment(artifacts: { type: string; title: string }[]): boolean {
  return artifacts.some((a) => a.type === "notes" && a.title === "AI Enrichment Report");
}

function hasScore(lead: { scoredAt: Date | null }): boolean {
  return lead.scoredAt != null;
}

function hasPositioning(artifacts: { type: string; title: string }[]): boolean {
  return artifacts.some((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");
}

function hasProposal(artifacts: { type: string }[]): boolean {
  return artifacts.some((a) => a.type === "proposal");
}

/**
 * Run the pipeline for a lead if eligible: Enrich → Score → Position → Propose (draft only).
 * Uses advisory lock to prevent concurrent runs. Idempotent: skips steps that already have output.
 * Never runs Build (money-path gate remains manual).
 */
export async function runPipelineIfEligible(
  leadId: string,
  reason: string
): Promise<PipelineRunResult> {
  const acquired = await tryAdvisoryLock(leadId);
  if (!acquired) {
    return { run: false, reason: "locked" };
  }

  try {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: { artifacts: true, project: true },
    });
    if (!lead) {
      return { run: false, reason: "lead_not_found" };
    }
    if (!isEligibleForAutoRun(lead)) {
      return { run: false, reason: "not_eligible" };
    }

    if (!process.env.OPENAI_API_KEY) {
      return { run: false, reason: "openai_not_configured" };
    }

    const runId = await createRun(leadId);
    let stepsRun = 0;
    let stepsSkipped = 0;

    for (const stepName of PIPELINE_STEPS) {
      const stepId = await startStep(runId, stepName);
      const current = await db.lead.findUnique({
        where: { id: leadId },
        include: { artifacts: true },
      });
      if (!current) break;

      try {
        if (stepName === "enrich") {
          if (hasEnrichment(current.artifacts)) {
            await finishStep(stepId, { success: true, notes: "skipped: artifact exists" });
            stepsSkipped++;
          } else {
            const { artifactId, usage } = await runEnrich(leadId);
            const norm = normalizeUsage(usage, "gpt-4o-mini");
            await finishStep(stepId, {
              success: true,
              outputArtifactIds: [artifactId],
              tokensUsed: norm.tokensUsed,
              costEstimate: norm.costEstimate,
            });
            stepsRun++;
          }
        } else if (stepName === "score") {
          if (hasScore(current)) {
            await finishStep(stepId, { success: true, notes: "skipped: artifact exists" });
            stepsSkipped++;
          } else {
            const { usage } = await runScore(leadId);
            const norm = normalizeUsage(usage, "gpt-4o-mini");
            await finishStep(stepId, {
              success: true,
              tokensUsed: norm.tokensUsed,
              costEstimate: norm.costEstimate,
            });
            stepsRun++;
          }
        } else if (stepName === "position") {
          if (hasPositioning(current.artifacts)) {
            await finishStep(stepId, { success: true, notes: "skipped: artifact exists" });
            stepsSkipped++;
          } else {
            const { artifactId, usage } = await runPositioning(leadId);
            const norm = normalizeUsage(usage, "gpt-4o-mini");
            await finishStep(stepId, {
              success: true,
              outputArtifactIds: [artifactId],
              tokensUsed: norm.tokensUsed,
              costEstimate: norm.costEstimate,
            });
            stepsRun++;
          }
        } else if (stepName === "propose") {
          if (hasProposal(current.artifacts)) {
            await finishStep(stepId, { success: true, notes: "skipped: artifact exists" });
            stepsSkipped++;
          } else {
            const { artifactId, usage } = await runPropose(leadId);
            const norm = normalizeUsage(usage, "gpt-4o-mini");
            await finishStep(stepId, {
              success: true,
              outputArtifactIds: [artifactId],
              tokensUsed: norm.tokensUsed,
              costEstimate: norm.costEstimate,
            });
            stepsRun++;
          }
        }
      } catch (err: any) {
        await finishStep(stepId, {
          success: false,
          notes: `skipped:blocked_by_gate|${err?.message ?? "error"}`,
        });
        await finishRun(runId, false, err?.message ?? stepName + " failed");
        throw err;
      }
    }

    await finishRun(runId, true);
    return { run: true, runId, stepsRun, stepsSkipped };
  } finally {
    await releaseAdvisoryLock(leadId);
  }
}
