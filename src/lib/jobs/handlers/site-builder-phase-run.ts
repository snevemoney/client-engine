/**
 * Sprint 6: Handler for site_builder.phase_run job.
 * Runs a single SBP phase asynchronously.
 */

import { runSitePhase } from "@/lib/site-builder/orchestrator";

export type SiteBuilderPhaseRunPayload = {
  planId: string;
  phaseNum: number;
  operatorNotes?: string;
};

export async function handleSiteBuilderPhaseRun(
  payload: SiteBuilderPhaseRunPayload
): Promise<object> {
  const { planId, phaseNum, operatorNotes } = payload;
  const result = await runSitePhase(planId, phaseNum, operatorNotes);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return { ok: true, artifactId: result.artifactId };
}
