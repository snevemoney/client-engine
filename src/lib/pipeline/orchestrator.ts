import { db } from "@/lib/db";
import { createRun, startStep, finishStep, finishRun } from "@/lib/pipeline-metrics";
import { tryAdvisoryLock, releaseAdvisoryLock } from "@/lib/db-lock";
import { isDryRun } from "@/lib/pipeline/dry-run";
import {
  classifyPipelineError,
  formatStepFailureNotes,
  isRetryableError,
} from "@/lib/pipeline/error-classifier";
import { notifyPipelineFailure } from "@/lib/notify";
import { trackPipelineEvent } from "@/lib/analytics";
import {
  runEnrichStep,
  runScoreStep,
  runPositionStep,
  runProposeStep,
  type LeadWithArtifacts,
} from "@/lib/pipeline/steps";

const PIPELINE_STEPS = [
  { name: "enrich" as const, handler: runEnrichStep },
  { name: "score" as const, handler: runScoreStep },
  { name: "position" as const, handler: runPositionStep },
  { name: "propose" as const, handler: runProposeStep },
] as const;

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

/**
 * Run the pipeline for a lead if eligible: Enrich → Score → Position → Propose (draft only).
 * Uses advisory lock to prevent concurrent runs. Idempotent: skips steps that already have output.
 * Loads lead once per run (no N+1). Never runs Build (money-path gate remains manual).
 */
export async function runPipelineIfEligible(
  leadId: string,
  _reason: string
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

    if (!isDryRun() && !process.env.OPENAI_API_KEY) {
      return { run: false, reason: "openai_not_configured" };
    }

    const runId = await createRun(leadId);
    let stepsRun = 0;
    let stepsSkipped = 0;

    // Load lead once; pass mutable current through steps (A4: no N+1)
    const current: LeadWithArtifacts = {
      id: lead.id,
      title: lead.title,
      status: lead.status,
      scoredAt: lead.scoredAt,
      artifacts: lead.artifacts.map((a) => ({ type: a.type, title: a.title })),
    };

    for (const { name: stepName, handler } of PIPELINE_STEPS) {
      const stepId = await startStep(runId, stepName);

      try {
        const { skipped } = await handler(leadId, runId, stepId, current);
        if (skipped) {
          stepsSkipped++;
        } else {
          stepsRun++;
        }
      } catch (err: unknown) {
        const notes = formatStepFailureNotes(err);
        await finishStep(stepId, { success: false, notes });

        const { code } = classifyPipelineError(err);
        const run = await db.pipelineRun.findUnique({
          where: { id: runId },
          select: { status: true },
        });
        if (run?.status === "running") {
          await db.pipelineRun.update({
            where: { id: runId },
            data: {
              lastErrorCode: code,
              lastErrorAt: new Date(),
              ...(isRetryableError(code) ? { retryCount: { increment: 1 } } : {}),
            },
          });
        }

        const errMsg = err instanceof Error ? err.message : stepName + " failed";
        await finishRun(runId, false, errMsg);
        trackPipelineEvent(leadId, "pipeline_step_failed", { runId, stepName, errorCode: code });
        notifyPipelineFailure(leadId, lead.title, stepName, errMsg, current.status ?? undefined);
        throw err;
      }
    }

    await finishRun(runId, true);
    trackPipelineEvent(leadId, "pipeline_run_completed", { runId, stepsRun, stepsSkipped });
    return { run: true, runId, stepsRun, stepsSkipped };
  } finally {
    await releaseAdvisoryLock(leadId);
  }
}
