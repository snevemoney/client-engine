/**
 * Phase 5.3: Safe refusal rules for Coach Mode.
 * When context is missing, stale, or unsafe → refuse with structured output.
 */
import type { ScoreContext, RiskContext, NBAContext } from "./coach-tools";

const STALE_HOURS = 24;

export type RefusalReason =
  | "score_missing"
  | "score_stale"
  | "risk_missing"
  | "nba_missing"
  | "action_missing_ids"
  | "tool_error";

export type RefusalCheck = {
  shouldRefuse: boolean;
  reason?: RefusalReason;
  message: string;
  suggestedAction?: string;
};

/** Check if score context is missing when user asks for score-based advice. */
export function checkScoreMissing(
  score: ScoreContext,
  messageLower: string
): RefusalCheck {
  const scoreKeywords = ["score", "band", "health", "critical", "recover", "operator"];
  const asksScore = scoreKeywords.some((k) => messageLower.includes(k));
  if (!asksScore) return { shouldRefuse: false, message: "" };

  if (score.error || !score.latest) {
    return {
      shouldRefuse: true,
      reason: "score_missing",
      message: "Score context is unavailable. I can't give score-based advice without current data.",
      suggestedAction: "Run recompute score to refresh.",
    };
  }
  return { shouldRefuse: false, message: "" };
}

/** Check if score is stale (>24h) when user asks "what should I do today?". */
export function checkScoreStale(
  score: ScoreContext,
  messageLower: string
): RefusalCheck {
  const asksToday = /what should i do|today|prioritize|do today/i.test(messageLower);
  if (!asksToday) return { shouldRefuse: false, message: "" };
  if (score.error || !score.latest) return { shouldRefuse: false, message: "" };

  const computedAt = new Date(score.latest.computedAt).getTime();
  const ageHours = (Date.now() - computedAt) / (1000 * 60 * 60);
  if (ageHours > STALE_HOURS) {
    return {
      shouldRefuse: true,
      reason: "score_stale",
      message: `Score was computed ${Math.round(ageHours)}h ago. Recommendations may be outdated.`,
      suggestedAction: "Recompute score first for accurate guidance.",
    };
  }
  return { shouldRefuse: false, message: "" };
}

/** Check if action execution is attempted with missing identifiers. */
export function checkActionMissingIds(
  actionKey: string,
  nextActionId?: string,
  nbaActionKey?: string
): RefusalCheck {
  if (actionKey !== "nba_execute") return { shouldRefuse: false, message: "" };
  if (!nextActionId || !nbaActionKey) {
    return {
      shouldRefuse: true,
      reason: "action_missing_ids",
      message: "NBA action requires nextActionId and nbaActionKey.",
      suggestedAction: "Use a CTA from a coach recommendation.",
    };
  }
  return { shouldRefuse: false, message: "" };
}

/** Check if any tool returned 401/500 — coach must not claim success. */
export function checkToolError(
  score: ScoreContext,
  risk: RiskContext,
  nba: NBAContext
): RefusalCheck {
  const hasError = score.error || risk.error || nba.error;
  if (!hasError) return { shouldRefuse: false, message: "" };
  return {
    shouldRefuse: true,
    reason: "tool_error",
    message: "One or more context APIs failed. I can't confirm the current state.",
    suggestedAction: "Refresh context (recompute score, run risk rules, run next actions).",
  };
}
