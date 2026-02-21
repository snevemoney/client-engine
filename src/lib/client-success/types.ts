/**
 * Client Success Layer: result targets, baseline, interventions, outcome scorecard,
 * risk/bottleneck tracker, client feedback. All stored as artifacts on the lead.
 * Optimizes for: deliver measurable results → turn results into proof.
 */

/** Before building: current state, target state, metric, timeline. */
export type ResultTarget = {
  currentState: string;
  targetState: string;
  metric: string;
  timeline: string;
  capturedAt: string;
};

/** "Before" metrics at project/delivery start. */
export type BaselineSnapshot = {
  metrics: { name: string; value: string; unit?: string }[];
  notes?: string;
  capturedAt: string;
};

/** Single entry: what you changed (automation, workflow, tool, process). */
export type InterventionEntry = {
  id: string;
  at: string;
  category: "automation" | "workflow" | "tool_stack" | "process" | "other";
  description: string;
  impact?: string;
};

/** Weekly KPI snapshot. */
export type OutcomeEntry = {
  id: string;
  weekStart: string; // ISO date
  metrics: { name: string; value: string; unit?: string; delta?: string }[];
  notes?: string;
};

/** What's blocking results now. */
export type RiskItem = {
  id: string;
  at: string;
  description: string;
  severity?: "low" | "medium" | "high";
  resolvedAt?: string;
};

/** Single client feedback check-in. */
export type ClientFeedbackEntry = {
  id: string;
  at: string;
  question?: string;
  response: string;
  themes?: string[]; // e.g. "slow", "confusing"
};

export const ARTIFACT_TYPES = {
  RESULT_TARGET: "RESULT_TARGET",
  BASELINE_SNAPSHOT: "BASELINE_SNAPSHOT",
  INTERVENTION_LOG: "INTERVENTION_LOG",
  OUTCOME_SCORECARD: "OUTCOME_SCORECARD",
  RISK_BOTTLENECK_LOG: "RISK_BOTTLENECK_LOG",
  CLIENT_FEEDBACK_LOG: "CLIENT_FEEDBACK_LOG",
} as const;

export type ClientSuccessData = {
  resultTarget: ResultTarget | null;
  baseline: BaselineSnapshot | null;
  interventions: InterventionEntry[];
  outcomeEntries: OutcomeEntry[];
  risks: RiskItem[];
  feedback: ClientFeedbackEntry[];
};
