/**
 * Phase 1.5: Intake promotion readiness.
 * Computes whether an IntakeLead is ready to promote to pipeline.
 */

export type IntakeLeadLike = {
  title?: string | null;
  summary?: string | null;
  status?: string | null;
  score?: number | null;
  nextAction?: string | null;
  nextActionDueAt?: Date | string | null;
};

export type ReadinessResult = {
  isReadyToPromote: boolean;
  reasons: string[];
  warnings: string[];
};

const TRIM = (s: unknown) => (typeof s === "string" ? s.trim() : "");

/**
 * Compute whether an intake lead is ready to promote to pipeline.
 * Rules: title required, summary required, status not lost/won.
 * Score and nextAction are recommended but not blocking (warnings).
 */
export function computeIntakePromotionReadiness(lead: IntakeLeadLike): ReadinessResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const title = TRIM(lead.title);
  const summary = TRIM(lead.summary);
  const status = (lead.status ?? "").toLowerCase();

  if (!title) reasons.push("Missing title");
  if (!summary) reasons.push("Missing summary");

  if (status === "lost" || status === "won") {
    reasons.push("Cannot promote: lead is already won or lost");
  }

  if (lead.score == null || lead.score === undefined) {
    warnings.push("No score set — consider scoring before promote");
  }

  if (!TRIM(lead.nextAction) && !lead.nextActionDueAt) {
    warnings.push("No next action — consider setting before promote");
  }

  const isReadyToPromote =
    !!title &&
    !!summary &&
    status !== "lost" &&
    status !== "won";

  return { isReadyToPromote, reasons, warnings };
}
