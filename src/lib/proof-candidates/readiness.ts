/**
 * Phase 1.4: Proof candidate readiness rules.
 * Candidate is "ready" if it has evidence + outcome-oriented fields.
 */

export type CandidateLike = {
  title?: string | null;
  githubUrl?: string | null;
  loomUrl?: string | null;
  deliverySummary?: string | null;
  proofSnippet?: string | null;
  beforeState?: string | null;
  afterState?: string | null;
  metricLabel?: string | null;
  metricValue?: string | null;
};

export type ReadinessResult = {
  isReady: boolean;
  reasons: string[];
};

const TRIM = (s: unknown) => (typeof s === "string" ? s.trim() : "");

/**
 * Compute whether a candidate is ready for promotion.
 * Ready = title + at least one evidence signal + at least one outcome field.
 */
export function computeProofCandidateReadiness(candidate: CandidateLike): ReadinessResult {
  const reasons: string[] = [];
  const title = TRIM(candidate.title);
  const githubUrl = TRIM(candidate.githubUrl);
  const loomUrl = TRIM(candidate.loomUrl);
  const deliverySummary = TRIM(candidate.deliverySummary);
  const proofSnippet = TRIM(candidate.proofSnippet);
  const beforeState = TRIM(candidate.beforeState);
  const afterState = TRIM(candidate.afterState);
  const metricLabel = TRIM(candidate.metricLabel);
  const metricValue = TRIM(candidate.metricValue);

  if (!title) reasons.push("Missing title");

  const hasEvidence = !!(githubUrl || loomUrl || deliverySummary || proofSnippet);
  if (!hasEvidence) reasons.push("No evidence (add GitHub link, Loom link, delivery summary, or proof snippet)");

  const hasOutcome =
    !!(proofSnippet || afterState || (metricLabel && metricValue));
  if (!hasOutcome)
    reasons.push("No outcome (add proof snippet, after state, or metric label + value)");

  const isReady = !!title && hasEvidence && hasOutcome;
  return { isReady, reasons };
}
