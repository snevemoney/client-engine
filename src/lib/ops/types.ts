/**
 * Ops types: workday run, operator brief, constraint, scorecard.
 */

export type WorkdayRunSummary = {
  ok: boolean;
  at: string;
  research: { discovered: number; created: number; errors: string[] };
  pipeline: { runs: number; retries: number; errors: string[] };
  knowledge?: { processed: number; ingested: number; errors: string[] };
  reportArtifactId?: string;
};

export type OperatorBrief = {
  at: string;
  summary: string;
  whatHappened: string[];
  whatWasCreated: string[];
  whatFailed: string[];
  needsApproval: string[];
  bottleneck: { label: string; reason: string; actions: string[] } | null;
  topOpportunities: string[];
  actionPlan: string[];
  counts: {
    newLeads: number;
    proposalsReady: number;
    approvalsNeeded: number;
    buildReady: number;
    failedRuns: number;
  };
};

export type ConstraintSnapshot = {
  constraintKey: string;
  label: string;
  reason: string;
  evidence: Record<string, number | string>;
  recommendedActions: string[];
};

export type ScorecardSnapshot = {
  at: string;
  inputs: { discovered: number; created: number; bySource: Record<string, number>; enrichmentCoveragePct?: number };
  process: {
    byStep: Record<string, { total: number; ok: number; pct: number }>;
    avgTimeInStageMs: Record<string, number | null>;
    retryCounts: number;
  };
  outputs: {
    proposalsGenerated: number;
    approvals: number;
    buildsCreated: number;
    projectsCreated: number;
    won: number;
    lost: number;
  };
};

/** Money-focused scorecard for executive/PBD-style Q&A. */
export type MoneyScorecard = {
  at: string;
  leadsDiscovered: number;
  leadsQualified: number; // score >= 6 or similar
  proposalsDrafted: number;
  proposalsSent: number;
  dealsWon: number;
  dealsLost: number;
  pipelineValueEstimate: number;
  avgDealSizeEstimate: number | null;
  timeToProposalMedianDays: number | null;
  timeToCloseMedianDays: number | null;
  cashCollected: number | null;
  /** Daily/command center extensions */
  newLeadsToday?: number;
  newLeads7d?: number;
  qualifiedLeads7d?: number;
  proposalsSent7d?: number;
  followUpsDueToday?: number;
  callsBooked?: number | null; // placeholder
  revenueWon30d?: number | null;
  /** Deals won in last 90 days (for graduation trigger). */
  dealsWon90d?: number;
  staleOpportunitiesCount?: number;
  primaryBottleneck?: string | null;
  constraintImpactNote?: string | null;
};

/** Conversion rates between pipeline stages (for advisor-style answers). */
export type StageConversion = {
  at: string;
  leadToQualifiedPct: number;
  qualifiedToProposalPct: number;
  proposalToSentPct: number;
  sentToReplyPct: number | null; // we may not track
  sentToWonPct: number;
  sentToLostPct: number;
  approvalToBuildPct: number;
};

/** Where the pipeline is leaking (drop-off between stages). */
export type PipelineLeakReport = {
  at: string;
  worstDropOffStage: string;
  worstDropOffPct: number;
  leaks: { fromStage: string; toStage: string; countIn: number; countOut: number; pct: number }[];
};

/** PBD sales leak: stage counts this week + worst leak stage. */
export type SalesLeakReport = {
  at: string;
  weekStart: string;
  weekEnd: string;
  stageCounts: Record<string, { in: number; due?: number; done?: number }>;
  worstLeakStage: string;
  worstLeakReason: string;
  prospectingCount: number;
  newContactsMade: number;
  firstContactsSent: number;
  presentationsCount: number;
  followUpsDue: number;
  followUpsDone: number;
  referralAsksMade: number;
  referralLeadsReceived: number;
  relationshipTouches: number;
};

/** Follow-up discipline metrics. */
export type FollowUpDisciplineScore = {
  at: string;
  pctOnTime: number | null;
  pctWithNextDate: number;
  pctWithNotes: number;
  compositeScore: number;
  dueCount: number;
  completedOnTimeCount: number;
  activeLeadsWithoutNextDate: number;
};

/** Follow-up discipline metrics for Command Center card. */
export type FollowUpDisciplineMetrics = {
  at: string;
  followUpsDueToday: number;
  overdueCount: number;
  noTouchIn7DaysCount: number;
  avgTouchesBeforeClose: number | null;
  avgTouchesOnActive: number | null;
  touched7PlusNotWonCount: number;
  status: "ok" | "leak";
  overdueLeads: { id: string; title: string; company: string | null; daysOverdue: number }[];
};

/** Referral engine metrics for Command Center card. */
export type ReferralEngineMetrics = {
  at: string;
  referralAsksThisWeek: number;
  referralsReceivedThisMonth: number;
  referralToQualifiedPct: number | null;
  referralToWonPct: number | null;
  topReferralSourceCount: number;
  eligibleForReferralAskCount: number;
};

/** Prospecting source metrics (per channel). */
export type ProspectingSourceRow = {
  channel: string;
  newLeads: number;
  qualified: number;
  proposals: number;
  won: number;
  cashCollected: number;
  conversionPct: number | null;
};

export type ProspectingSourceMetrics = {
  at: string;
  bestSourceThisMonth: string | null;
  weakSourceWarning: string | null;
  channelRoiSummary: string | null; // one-line ROI summary for card
  rows: ProspectingSourceRow[];
};

/** Deal + product intelligence per lead (from enrichment + positioning + research). */
export type OpportunityBrief = {
  buyer: string | null;
  pain: string | null;
  currentStackSignals: string | null;
  likelyBottleneck: string | null;
  offerFit: string | null;
  roiCostOfInaction: string | null;
  pilotSuggestion: string | null;
  objectionsRisks: string | null;
  confidenceScore: number | null;
  whyNow: string | null;
  sourceEvidence: string | null;
};
