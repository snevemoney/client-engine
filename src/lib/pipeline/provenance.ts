import { isDryRun } from "@/lib/pipeline/dry-run";

export type Provenance = {
  pipelineRunId?: string;
  stepName: string;
  model: string;
  temperature?: number;
  top_p?: number;
  isDryRun: boolean;
  createdBy: "pipeline";
};

export function buildProvenance(
  runId: string | null,
  stepName: string,
  opts: { model?: string; temperature?: number; top_p?: number }
): Provenance {
  return {
    ...(runId ? { pipelineRunId: runId } : {}),
    stepName,
    model: opts.model ?? "gpt-4o-mini",
    temperature: opts.temperature,
    top_p: opts.top_p,
    isDryRun: isDryRun(),
    createdBy: "pipeline",
  };
}
