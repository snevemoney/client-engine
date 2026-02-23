/**
 * Sales Driver: qualification score helpers.
 * Each dimension 0-2, total max 12.
 */

export const QUALIFICATION_DIMENSIONS = [
  "scorePain",
  "scoreUrgency",
  "scoreBudget",
  "scoreResponsiveness",
  "scoreDecisionMaker",
  "scoreFit",
] as const;

export type QualificationScores = {
  scorePain?: number | null;
  scoreUrgency?: number | null;
  scoreBudget?: number | null;
  scoreResponsiveness?: number | null;
  scoreDecisionMaker?: number | null;
  scoreFit?: number | null;
};

/** Compute total qualification score (0-12) from lead scores */
export function getQualificationTotal(scores: QualificationScores): number {
  let total = 0;
  for (const key of QUALIFICATION_DIMENSIONS) {
    const v = scores[key];
    if (typeof v === "number" && v >= 0 && v <= 2) total += v;
  }
  return total;
}

/** Priority badge from total score */
export function getPriorityBadge(total: number): "Low" | "Medium" | "High" {
  if (total <= 4) return "Low";
  if (total <= 8) return "Medium";
  return "High";
}
