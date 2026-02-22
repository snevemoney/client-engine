/**
 * Server component: shows pipeline mode (DRY RUN vs LIVE) from env.
 * Use on Command Center and optionally Metrics so operators know what mode they're in.
 */
export function PipelineModeBadge() {
  const isDryRun =
    process.env.PIPELINE_DRY_RUN === "1" || process.env.E2E_MODE === "1";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        isDryRun
          ? "bg-amber-900/50 text-amber-200 border border-amber-700/50"
          : "bg-emerald-900/30 text-emerald-200 border border-emerald-700/30"
      }`}
      title={isDryRun ? "Pipeline creates placeholder artifacts; no LLM calls." : "Pipeline runs with OpenAI; real enrich/position/propose."}
    >
      {isDryRun ? "DRY RUN" : "LIVE"}
    </span>
  );
}
