/**
 * Phase 3.1: Command Center score adapter — maps ops signals to scoring factors.
 * Uses followupQueue, intakeActions, proofGaps, jobsSummary, observability, reminders.
 */

import type { ScoreFactorInput } from "../types";

export type CommandCenterContext = {
  followupQueue: {
    followupsOverdue: number;
    followupsDueToday: number;
    followupsUpcoming: number;
  };
  intakeActions: {
    unscoredCount: number;
    readyToPromoteCount: number;
    promotedMissingNextActionCount: number;
    sentFollowupOverdueCount: number;
    wonMissingProofCount: number;
  };
  proofGaps: {
    wonLeadsWithoutProofCandidate: number;
    readyCandidatesPendingPromotion: number;
    proofRecordsMissingFields: number;
    promotedThisWeek: number;
  };
  jobsSummary: {
    queued: number;
    running: number;
    failed: number;
    deadLetter: number;
    staleRunning: number;
    dueSchedules: number;
  };
  observability: {
    eventsToday: number;
    errorsToday: number;
    slowEventsToday: number;
  };
  remindersAutomation: {
    remindersOverdue: number;
    remindersDueToday: number;
    remindersHighPriority: number;
    suggestionsPending: number;
  };
  integrationHealth: {
    errorCount: number;
    total: number;
  };
};

/** Normalize count to 0-100 (higher = better). Penalty per unit, cap at 100 penalty. */
function countToNormalized(count: number, penaltyPerUnit = 10, maxCount = 10): number {
  const penalty = Math.min(maxCount * penaltyPerUnit, count * penaltyPerUnit);
  return Math.max(0, 100 - penalty);
}

/** Build factors from command center context. */
export function buildCommandCenterFactors(ctx: CommandCenterContext): ScoreFactorInput[] {
  const factors: ScoreFactorInput[] = [];

  // Followups overdue (negative)
  const overdue = ctx.followupQueue.followupsOverdue ?? 0;
  factors.push({
    key: "followups_overdue",
    label: "Followups overdue",
    rawValue: overdue,
    normalizedValue: countToNormalized(overdue, 15, 7),
    weight: 2,
    direction: "negative",
    reason: overdue > 0 ? `${overdue} followup(s) overdue` : "No overdue followups",
  });

  // Intake action gaps (unscored, won missing proof)
  const actionGaps =
    (ctx.intakeActions.unscoredCount ?? 0) +
    (ctx.intakeActions.wonMissingProofCount ?? 0) +
    (ctx.intakeActions.sentFollowupOverdueCount ?? 0);
  factors.push({
    key: "intake_gaps",
    label: "Intake action gaps",
    rawValue: actionGaps,
    normalizedValue: countToNormalized(actionGaps, 12, 8),
    weight: 1.5,
    direction: "negative",
    reason: actionGaps > 0 ? `${actionGaps} intake gap(s)` : "No intake gaps",
  });

  // Proof gaps
  const proofGapCount =
    (ctx.proofGaps.wonLeadsWithoutProofCandidate ?? 0) +
    (ctx.proofGaps.readyCandidatesPendingPromotion ?? 0);
  factors.push({
    key: "proof_gaps",
    label: "Proof gaps",
    rawValue: proofGapCount,
    normalizedValue: countToNormalized(proofGapCount, 15, 7),
    weight: 1.5,
    direction: "negative",
    reason: proofGapCount > 0 ? `${proofGapCount} proof gap(s)` : "No proof gaps",
  });

  // Jobs: failed + dead letter (negative)
  const jobProblems =
    (ctx.jobsSummary.failed ?? 0) +
    (ctx.jobsSummary.deadLetter ?? 0) +
    (ctx.jobsSummary.staleRunning ?? 0);
  factors.push({
    key: "job_health",
    label: "Job health",
    rawValue: jobProblems,
    normalizedValue: countToNormalized(jobProblems, 20, 5),
    weight: 2,
    direction: "negative",
    reason: jobProblems > 0 ? `${jobProblems} job issue(s)` : "Jobs healthy",
  });

  // Observability errors (negative)
  const errors = ctx.observability.errorsToday ?? 0;
  factors.push({
    key: "observability_errors",
    label: "Ops errors today",
    rawValue: errors,
    normalizedValue: countToNormalized(errors, 25, 4),
    weight: 1.5,
    direction: "negative",
    reason: errors > 0 ? `${errors} error(s) today` : "No errors today",
  });

  // Reminders overdue (negative)
  const remindersOverdue = ctx.remindersAutomation.remindersOverdue ?? 0;
  factors.push({
    key: "reminders_overdue",
    label: "Reminders overdue",
    rawValue: remindersOverdue,
    normalizedValue: countToNormalized(remindersOverdue, 15, 7),
    weight: 1,
    direction: "negative",
    reason: remindersOverdue > 0 ? `${remindersOverdue} reminder(s) overdue` : "No overdue reminders",
  });

  // Integration health (negative when errors)
  const integrationErrors = ctx.integrationHealth.errorCount ?? 0;
  const integrationTotal = ctx.integrationHealth.total ?? 1;
  const integrationOkPct = integrationTotal > 0 ? ((integrationTotal - integrationErrors) / integrationTotal) * 100 : 100;
  factors.push({
    key: "integration_health",
    label: "Integration health",
    rawValue: integrationOkPct,
    normalizedValue: integrationOkPct,
    weight: 1,
    direction: "positive",
    reason: integrationErrors > 0 ? `${integrationErrors} integration(s) in error` : "All integrations OK",
  });

  return factors;
}
