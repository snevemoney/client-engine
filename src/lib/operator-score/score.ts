/**
 * Phase 2.4: Deterministic operator score (0–100).
 * Categories: Pipeline Hygiene, Conversion, Delivery, Proof & Retention, Cadence Discipline.
 * Null-safe, no NaN.
 */

export type OperatorScoreInput = {
  // Pipeline Hygiene (20)
  readyNotSent?: number;
  sentNoFollowup?: number;
  followupOverdue?: number;
  staleProposals?: number;
  // Conversion Health (20)
  proposalSentToAcceptedRate?: number;
  acceptedToDeliveryStartedRate?: number;
  deliveryCompletedToProofRate?: number;
  // Delivery Execution (20)
  deliveryOverdue?: number;
  completedNoHandoff?: number;
  handoffNoClientConfirm?: number;
  totalCompleted?: number;
  // Proof & Retention (20)
  proofCandidatesReadyPending?: number;
  wonMissingProof?: number;
  completedNoTestimonialRequest?: number;
  completedNoProof?: number;
  totalCompletedForProof?: number;
  // Cadence Discipline (20)
  reviewCompletedThisWeek?: boolean;
  prioritiesUpdated?: boolean;
  metricsSnapshotCaptured?: boolean;
  operatorScoreSnapshotCaptured?: boolean;
};

export type ScoreBreakdown = {
  pipelineHygiene: { score: number; max: number; label: string };
  conversionHealth: { score: number; max: number; label: string };
  deliveryExecution: { score: number; max: number; label: string };
  proofRetention: { score: number; max: number; label: string };
  cadenceDiscipline: { score: number; max: number; label: string };
};

export type OperatorScoreResult = {
  score: number;
  grade: string;
  breakdown: ScoreBreakdown;
  summary: string;
  topWins: string[];
  topRisks: string[];
};

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeRate(num: number, denom: number): number {
  if (denom <= 0 || !Number.isFinite(denom)) return 0;
  const r = num / denom;
  return Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0;
}

function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Pipeline Hygiene (20): low stale, low missing followups, low overdue.
 * Penalize: readyNotSent, sentNoFollowup, followupOverdue, staleProposals.
 * Max 5 pts each if zero; deduct per issue.
 */
function pipelineHygieneScore(input: OperatorScoreInput): number {
  const readyNotSent = input.readyNotSent ?? 0;
  const sentNoFollowup = input.sentNoFollowup ?? 0;
  const followupOverdue = input.followupOverdue ?? 0;
  const stale = input.staleProposals ?? 0;
  const issues = readyNotSent + sentNoFollowup + followupOverdue + stale;
  if (issues === 0) return 20;
  const deduct = Math.min(20, issues * 5);
  return Math.max(0, 20 - deduct);
}

/**
 * Conversion Health (20): rates as percentage of 20.
 */
function conversionHealthScore(input: OperatorScoreInput): number {
  const r1 = (input.proposalSentToAcceptedRate ?? 0) * 7; // 0–7 pts
  const r2 = (input.acceptedToDeliveryStartedRate ?? 0) * 7; // 0–7 pts
  const r3 = (input.deliveryCompletedToProofRate ?? 0) * 6; // 0–6 pts
  return clamp(r1 + r2 + r3);
}

/**
 * Delivery Execution (20): low overdue, handoff done, client confirm.
 */
function deliveryExecutionScore(input: OperatorScoreInput): number {
  const overdue = input.deliveryOverdue ?? 0;
  const noHandoff = input.completedNoHandoff ?? 0;
  const noClientConfirm = input.handoffNoClientConfirm ?? 0;
  const total = input.totalCompleted ?? 1;
  const pctHandoff = safeRate((total - noHandoff), total);
  const pctConfirm = total > 0 ? safeRate(total - noHandoff - noClientConfirm, total) : 0;
  let score = 20;
  if (overdue > 0) score -= Math.min(8, overdue * 2);
  score -= Math.round((1 - pctHandoff) * 6);
  score -= Math.round((1 - pctConfirm) * 6);
  return Math.max(0, score);
}

/**
 * Proof & Retention (20): low proof gaps, testimonials requested.
 */
function proofRetentionScore(input: OperatorScoreInput): number {
  const readyPending = input.proofCandidatesReadyPending ?? 0;
  const wonNoProof = input.wonMissingProof ?? 0;
  const noTestimonial = input.completedNoTestimonialRequest ?? 0;
  const noProof = input.completedNoProof ?? 0;
  const total = input.totalCompletedForProof ?? 1;
  const pctTestimonial = safeRate(total - noTestimonial, total);
  const pctProof = safeRate(total - noProof, total);
  let score = 20;
  if (readyPending > 0) score -= Math.min(4, readyPending);
  if (wonNoProof > 0) score -= Math.min(4, wonNoProof);
  score -= Math.round((1 - pctTestimonial) * 6);
  score -= Math.round((1 - pctProof) * 6);
  return Math.max(0, score);
}

/**
 * Cadence Discipline (20): review, priorities, snapshots.
 * 5 pts each if true.
 */
function cadenceDisciplineScore(input: OperatorScoreInput): number {
  let score = 0;
  if (input.reviewCompletedThisWeek) score += 5;
  if (input.prioritiesUpdated) score += 5;
  if (input.metricsSnapshotCaptured) score += 5;
  if (input.operatorScoreSnapshotCaptured) score += 5;
  return Math.min(20, score);
}

export function computeOperatorScore(input: OperatorScoreInput = {}): OperatorScoreResult {
  const ph = pipelineHygieneScore(input);
  const ch = conversionHealthScore(input);
  const de = deliveryExecutionScore(input);
  const pr = proofRetentionScore(input);
  const cd = cadenceDisciplineScore(input);

  const total = ph + ch + de + pr + cd;
  const score = clamp(total);
  const grade = gradeFromScore(score);

  const breakdown: ScoreBreakdown = {
    pipelineHygiene: { score: ph, max: 20, label: "Pipeline Hygiene" },
    conversionHealth: { score: ch, max: 20, label: "Conversion Health" },
    deliveryExecution: { score: de, max: 20, label: "Delivery Execution" },
    proofRetention: { score: pr, max: 20, label: "Proof & Retention" },
    cadenceDiscipline: { score: cd, max: 20, label: "Cadence Discipline" },
  };

  const topWins: string[] = [];
  const topRisks: string[] = [];

  if (ph >= 18) topWins.push("Pipeline hygiene strong");
  else if ((input.readyNotSent ?? 0) > 0) topRisks.push(`${input.readyNotSent} proposals ready not sent`);
  else if ((input.staleProposals ?? 0) > 0) topRisks.push(`${input.staleProposals} stale proposals`);
  else if ((input.sentNoFollowup ?? 0) > 0) topRisks.push("Sent proposals missing follow-up dates");

  if (ch >= 15) topWins.push("Conversion rates healthy");
  else if ((input.proposalSentToAcceptedRate ?? 0) < 0.3) topRisks.push("Low proposal→accepted rate");

  if (de >= 15) topWins.push("Delivery execution on track");
  else if ((input.deliveryOverdue ?? 0) > 0) topRisks.push(`${input.deliveryOverdue} delivery projects overdue`);
  else if ((input.completedNoHandoff ?? 0) > 0) topRisks.push("Completed projects awaiting handoff");

  if (pr >= 15) topWins.push("Proof & retention in good shape");
  else if ((input.wonMissingProof ?? 0) > 0) topRisks.push("Won deals missing proof");
  else if ((input.proofCandidatesReadyPending ?? 0) > 0) topRisks.push("Proof candidates ready, pending promotion");

  if (cd >= 15) topWins.push("Cadence discipline maintained");
  else if (!input.reviewCompletedThisWeek) topRisks.push("Weekly review not completed");

  const summary =
    topWins.length > 0
      ? `Score ${score} (${grade}). ${topWins[0] ?? ""}${topRisks.length > 0 ? ` Watch: ${topRisks[0] ?? ""}` : ""}`
      : `Score ${score} (${grade}). Focus on top risks.`;

  return {
    score,
    grade,
    breakdown,
    summary,
    topWins: topWins.slice(0, 5),
    topRisks: topRisks.slice(0, 5),
  };
}
