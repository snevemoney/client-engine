import { db } from "@/lib/db";

export type StepResult = {
  success: boolean;
  tokensUsed?: number;
  costEstimate?: number;
  outputArtifactIds?: string[];
  notes?: string;
};

/**
 * Create a new pipeline run for a lead (one run per manual step or full auto-run).
 */
export async function createRun(leadId: string): Promise<string> {
  const run = await db.pipelineRun.create({
    data: { leadId, status: "running" },
  });
  return run.id;
}

/**
 * Start a step within a run. Returns the step id.
 */
export async function startStep(runId: string, stepName: string): Promise<string> {
  const step = await db.pipelineStepRun.create({
    data: { runId, stepName },
  });
  return step.id;
}

/**
 * Finish a step with result. Optionally finishes the run if this is the only/last step.
 */
export async function finishStep(
  stepId: string,
  result: StepResult
): Promise<void> {
  await db.pipelineStepRun.update({
    where: { id: stepId },
    data: {
      finishedAt: new Date(),
      success: result.success,
      tokensUsed: result.tokensUsed ?? undefined,
      costEstimate: result.costEstimate ?? undefined,
      outputArtifactIds: result.outputArtifactIds ?? [],
      notes: result.notes ?? undefined,
    },
  });
}

/**
 * Mark run as finished and create RUN_REPORT.md artifact.
 */
export async function finishRun(
  runId: string,
  success: boolean,
  error?: string | null
): Promise<void> {
  const run = await db.pipelineRun.update({
    where: { id: runId },
    data: {
      status: success ? "ok" : "error",
      finishedAt: new Date(),
      success,
      error: error ?? undefined,
    },
    include: {
      steps: true,
      lead: { select: { id: true, title: true } },
    },
  });

  const report = buildRunReport(run);
  await db.artifact.create({
    data: {
      leadId: run.leadId,
      type: "report",
      title: "RUN_REPORT.md",
      content: report,
    },
  });
}

function buildRunReport(run: {
  id: string;
  leadId: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  success: boolean | null;
  error: string | null;
  lead: { id: string; title: string };
  steps: Array<{
    stepName: string;
    startedAt: Date;
    finishedAt: Date | null;
    success: boolean | null;
    tokensUsed: number | null;
    costEstimate: number | null;
    notes: string | null;
  }>;
}): string {
  const durationMs = run.finishedAt
    ? run.finishedAt.getTime() - run.startedAt.getTime()
    : null;
  const lines = [
    `# Pipeline Run Report`,
    ``,
    `- **Run ID:** ${run.id}`,
    `- **Lead:** ${run.lead.title} (\`${run.leadId}\`)`,
    `- **Status:** ${run.status}`,
    `- **Success:** ${run.success ?? "—"}`,
    `- **Started:** ${run.startedAt.toISOString()}`,
    `- **Finished:** ${run.finishedAt?.toISOString() ?? "—"}`,
    durationMs != null ? `- **Duration:** ${durationMs}ms` : "",
    run.error ? `- **Error:** ${run.error}` : "",
    ``,
    `## Steps`,
    ``,
  ];
  for (const s of run.steps) {
    const stepDuration = s.finishedAt
      ? s.finishedAt.getTime() - s.startedAt.getTime()
      : null;
    lines.push(`### ${s.stepName}`);
    lines.push(`- Success: ${s.success ?? "—"}`);
    if (s.tokensUsed != null) lines.push(`- Tokens: ${s.tokensUsed}`);
    if (s.costEstimate != null) lines.push(`- Cost est.: $${s.costEstimate.toFixed(4)}`);
    if (stepDuration != null) lines.push(`- Duration: ${stepDuration}ms`);
    if (s.notes) lines.push(`- Notes: ${s.notes}`);
    lines.push("");
  }
  return lines.filter(Boolean).join("\n");
}
