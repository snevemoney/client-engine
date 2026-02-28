/**
 * Phase 6.1: Today's Plan — derive top 3 moves from score, risk, NBA.
 */
import type { CoachSource } from "@/lib/copilot/coach-sources";
import {
  sourceScoreSnapshot,
  sourceRiskFlag,
  sourceNextAction,
  sourceApi,
} from "@/lib/copilot/coach-sources";

export type ScoreInput = {
  latest: { id?: string; score: number; band: string; computedAt: string } | null;
};

export type RiskInput = {
  summary: { openBySeverity: Record<string, number> };
  top: Array<{ id: string; title: string; severity: string; ruleKey?: string }>;
};

export type NBAInput = {
  top: Array<{
    id: string;
    title: string;
    priority: string;
    score: number;
    reason: string | null;
    ruleKey?: string;
    dedupeKey?: string;
  }>;
};

export type FounderMove = {
  title: string;
  why: string;
  expectedImpact: string;
  actionKey: "run_risk_rules" | "run_next_actions" | "recompute_score" | "nba_execute";
  nextActionId?: string;
  nbaActionKey?: string;
  sources: CoachSource[];
};

export function pickTopMoves(input: {
  score: ScoreInput;
  risk: RiskInput;
  nba: NBAInput;
}): FounderMove[] {
  const moves: FounderMove[] = [];
  const { score, risk, nba } = input;

  const criticalRisks = (risk.summary.openBySeverity?.critical ?? 0) + (risk.summary.openBySeverity?.high ?? 0);
  const band = score.latest?.band ?? "unknown";

  // Rule 1: If any critical risks exist, 1 move must address top critical risk
  if (criticalRisks > 0 && risk.top.length > 0) {
    const r = risk.top[0];
    moves.push({
      title: `Address risk: ${r.title}`,
      why: `Critical/high risk (${r.severity}).`,
      expectedImpact: "Reduce risk exposure.",
      actionKey: "run_risk_rules",
      sources: [
        sourceRiskFlag(r.id, r.ruleKey ?? "unknown"),
        sourceApi("POST /api/risk/run-rules", new Date().toISOString()),
      ],
    });
  }

  // Rule 2: If score is critical or warning, 1 move must be "recompute + remediate top factor"
  if ((band === "critical" || band === "warning") && score.latest) {
    moves.push({
      title: "Recompute score and remediate top factor",
      why: `Score is in ${band} band (${score.latest.score}).`,
      expectedImpact: "Refresh score and surface top remediation.",
      actionKey: "recompute_score",
      sources: [
        sourceScoreSnapshot(score.latest.id ?? "unknown", score.latest.computedAt),
        sourceApi("POST /api/internal/scores/compute", new Date().toISOString()),
      ],
    });
  }

  // Rule 3: Fill remaining slots from top NBA queued (up to 2)
  const nbaSlots = 3 - moves.length;
  if (nbaSlots > 0 && nba.top.length > 0) {
    for (const a of nba.top.slice(0, nbaSlots)) {
      moves.push({
        title: a.title,
        why: a.reason ?? `Priority ${a.priority}, score ${a.score}`,
        expectedImpact: "Complete next best action.",
        actionKey: "nba_execute",
        nextActionId: a.id,
        nbaActionKey: "mark_done",
        sources: [
          sourceNextAction(a.id, a.ruleKey ?? "unknown", a.dedupeKey ?? a.id),
          sourceApi("POST /api/next-actions/[id]/execute", new Date().toISOString()),
        ],
      });
    }
  }

  return moves.slice(0, 3);
}
