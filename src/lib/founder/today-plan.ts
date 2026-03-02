/**
 * Phase 6.1 → 9.1: Today's Plan — revenue-optimized, time-constrained.
 *
 * pickTopMoves: legacy severity-based (3 moves).
 * pickOptimalMoves: revenue-weighted knapsack within time budget.
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
  top: Array<{ id: string; title: string; severity: string; ruleKey?: string; exposedRevenue?: number }>;
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
    revenueAtStake?: number;
    revenueCurrency?: string;
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
  /** Revenue impact in dollars (when available) */
  revenueImpact?: number;
  /** Estimated minutes to complete */
  estimatedMinutes?: number;
};

/** Time estimates per action type (minutes) */
const ACTION_TIME_ESTIMATES: Record<string, number> = {
  run_risk_rules: 20,
  recompute_score: 5,
  nba_execute: 15,
  // NBA rule-specific overrides
  proposal_followup_overdue: 10,
  proposal_no_followup_date: 10,
  retention_overdue: 15,
  failed_delivery_retry: 20,
  overdue_reminder: 5,
  handoff_no_confirm: 10,
  flywheel_won_no_delivery: 30,
  flywheel_no_referral: 10,
  flywheel_stage_stall: 15,
  flywheel_builder_poor_quality: 45,
  growth_overdue_followup: 10,
  growth_no_outreach: 20,
};

function estimateMinutes(actionKey: string, ruleKey?: string): number {
  if (ruleKey && ACTION_TIME_ESTIMATES[ruleKey]) return ACTION_TIME_ESTIMATES[ruleKey];
  return ACTION_TIME_ESTIMATES[actionKey] ?? 15;
}

/**
 * Legacy: severity-based top 3 moves (preserved for backward compat).
 */
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
      expectedImpact: r.exposedRevenue
        ? `$${r.exposedRevenue.toLocaleString()} exposed revenue at risk.`
        : "Reduce risk exposure.",
      actionKey: "run_risk_rules",
      revenueImpact: r.exposedRevenue,
      estimatedMinutes: estimateMinutes("run_risk_rules"),
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
      estimatedMinutes: estimateMinutes("recompute_score"),
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
        expectedImpact: a.revenueAtStake
          ? `$${a.revenueAtStake.toLocaleString()} at stake.`
          : "Complete next best action.",
        actionKey: "nba_execute",
        nextActionId: a.id,
        nbaActionKey: "mark_done",
        revenueImpact: a.revenueAtStake,
        estimatedMinutes: estimateMinutes("nba_execute", a.ruleKey),
        sources: [
          sourceNextAction(a.id, a.ruleKey ?? "unknown", a.dedupeKey ?? a.id),
          sourceApi("POST /api/next-actions/[id]/execute", new Date().toISOString()),
        ],
      });
    }
  }

  return moves.slice(0, 3);
}

/**
 * Revenue-optimized daily plan: maximize total revenue impact within time budget.
 * Uses greedy knapsack (sort by $/min, pick until budget exhausted).
 * Critical risks are always included first (non-negotiable).
 */
export function pickOptimalMoves(input: {
  score: ScoreInput;
  risk: RiskInput;
  nba: NBAInput;
  availableMinutes?: number;
}): { moves: FounderMove[]; totalRevenueImpact: number; totalMinutes: number; availableMinutes: number } {
  const { score, risk, nba, availableMinutes = 240 } = input;
  let budget = availableMinutes;
  const selected: FounderMove[] = [];
  let totalRevenue = 0;

  const band = score.latest?.band ?? "unknown";
  const criticalRisks = (risk.summary.openBySeverity?.critical ?? 0);

  // Phase 1: Non-negotiable — critical risks (always included)
  if (criticalRisks > 0 && risk.top.length > 0) {
    const r = risk.top[0];
    const mins = estimateMinutes("run_risk_rules");
    selected.push({
      title: `Address risk: ${r.title}`,
      why: `Critical risk — must address.`,
      expectedImpact: r.exposedRevenue
        ? `$${r.exposedRevenue.toLocaleString()} exposed.`
        : "Reduce critical risk exposure.",
      actionKey: "run_risk_rules",
      revenueImpact: r.exposedRevenue,
      estimatedMinutes: mins,
      sources: [
        sourceRiskFlag(r.id, r.ruleKey ?? "unknown"),
        sourceApi("POST /api/risk/run-rules", new Date().toISOString()),
      ],
    });
    budget -= mins;
    totalRevenue += r.exposedRevenue ?? 0;
  }

  // Phase 2: Score remediation if degraded (quick, high leverage)
  if ((band === "critical" || band === "warning") && score.latest) {
    const mins = estimateMinutes("recompute_score");
    if (budget >= mins) {
      selected.push({
        title: "Recompute score and remediate",
        why: `Score in ${band} band.`,
        expectedImpact: "Refresh health score.",
        actionKey: "recompute_score",
        estimatedMinutes: mins,
        sources: [
          sourceScoreSnapshot(score.latest.id ?? "unknown", score.latest.computedAt),
          sourceApi("POST /api/internal/scores/compute", new Date().toISOString()),
        ],
      });
      budget -= mins;
    }
  }

  // Phase 3: Greedy knapsack on NBA actions — maximize $/minute
  type Candidate = {
    action: NBAInput["top"][0];
    revenue: number;
    minutes: number;
    ratio: number;
  };

  const candidates: Candidate[] = nba.top
    .map((a) => {
      const revenue = a.revenueAtStake ?? 0;
      const minutes = estimateMinutes("nba_execute", a.ruleKey);
      return {
        action: a,
        revenue,
        minutes,
        ratio: minutes > 0 ? revenue / minutes : 0,
      };
    })
    .sort((a, b) => {
      // Revenue/minute ratio descending, then NBA score descending
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      return b.action.score - a.action.score;
    });

  for (const c of candidates) {
    if (budget < c.minutes) continue;
    selected.push({
      title: c.action.title,
      why: c.action.reason ?? `Priority ${c.action.priority}`,
      expectedImpact: c.revenue > 0
        ? `$${c.revenue.toLocaleString()} at stake.`
        : "Complete next best action.",
      actionKey: "nba_execute",
      nextActionId: c.action.id,
      nbaActionKey: "mark_done",
      revenueImpact: c.revenue > 0 ? c.revenue : undefined,
      estimatedMinutes: c.minutes,
      sources: [
        sourceNextAction(c.action.id, c.action.ruleKey ?? "unknown", c.action.dedupeKey ?? c.action.id),
        sourceApi("POST /api/next-actions/[id]/execute", new Date().toISOString()),
      ],
    });
    budget -= c.minutes;
    totalRevenue += c.revenue;
  }

  return {
    moves: selected,
    totalRevenueImpact: totalRevenue,
    totalMinutes: availableMinutes - budget,
    availableMinutes,
  };
}
