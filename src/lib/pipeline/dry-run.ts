/**
 * When PIPELINE_DRY_RUN=1, steps create placeholder artifacts and skip LLM calls.
 * Use for E2E tests or when OpenAI key is not configured.
 */
export function isDryRun(): boolean {
  return process.env.PIPELINE_DRY_RUN === "1" || process.env.E2E_MODE === "1";
}
