/**
 * Single official entrypoint for running the pipeline on a lead.
 * Use this from: lead creation, manual rerun API, (optional) status-change handlers.
 *
 * - Acquires advisory lock per lead (no double-runs).
 * - Creates PipelineRun, runs steps in order with gates, persists artifacts, writes RUN_REPORT.
 * - Order: Enrich → Score → Position → Propose (Build is manual only).
 * - Idempotent: skips steps that already have artifacts.
 */
export {
  runPipelineIfEligible,
  isEligibleForAutoRun,
  type PipelineRunResult,
} from "./orchestrator";
