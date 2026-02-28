/**
 * Phase 6.2: Deterministic week suggestions from founder summary + execution data.
 * No LLM — all suggestions derived from existing signals.
 */
import type { CoachSource } from "@/lib/copilot/coach-sources";
import {
  sourceRiskFlag,
  sourceNextAction,
  sourceApi,
} from "@/lib/copilot/coach-sources";

export type FounderSummaryInput = {
  score?: {
    latest?: { id?: string; score: number; band: string; computedAt: string } | null;
  };
  risk?: {
    summary?: { openBySeverity: Record<string, number> };
    topOpen5?: Array<{ id: string; title: string; severity: string; createdByRule?: string }>;
  };
  nba?: {
    topQueued5?: Array<{
      id: string;
      title: string;
      reason: string | null;
      priority: string;
      score: number;
      createdByRule?: string;
      dedupeKey?: string;
    }>;
  };
  pipeline?: {
    byStage?: Record<string, number>;
    stuckOver7d?: number;
    noNextStep?: number;
  } | null;
  execution?: {
    recentCopilotActions?: Array<{ actionKey: string; status: string }>;
    recentNextActionExecutions?: Array<{ actionKey: string; status: string }>;
  };
};

export type SuggestedOutcome = {
  title: string;
  why: string;
  sources: CoachSource[];
  id?: string;
  dedupeKey?: string;
};

export type SuggestedMilestone = {
  title: string;
  measurable: string;
  sources: CoachSource[];
};

export type WeekSuggestions = {
  topOutcomes: SuggestedOutcome[];
  milestones: SuggestedMilestone[];
  focusConstraint: string | null;
};

/**
 * Build deterministic week suggestions from founder summary.
 * - top 3 outcomes: from risks (critical/high), NBA, pipeline stalls
 * - milestones: specific, measurable from NBA + risks
 * - focus constraint: most common rule/theme from risks + NBA
 */
export function buildWeekSuggestions(input: FounderSummaryInput): WeekSuggestions {
  const outcomes: SuggestedOutcome[] = [];
  const seenDedupe = new Set<string>();
  const ruleCounts: Record<string, number> = {};

  const risk = input.risk ?? {};
  const nba = input.nba ?? {};
  const pipeline = input.pipeline ?? {};

  const riskTop = risk.topOpen5 ?? [];
  const nbaTop = nba.topQueued5 ?? [];
  const stuckOver7d = pipeline.stuckOver7d ?? 0;
  const noNextStep = pipeline.noNextStep ?? 0;

  // Outcome 1: Top critical/high risk
  if (riskTop.length > 0) {
    const r = riskTop[0];
    const dk = `risk:${r.id}`;
    if (!seenDedupe.has(dk)) {
      seenDedupe.add(dk);
      outcomes.push({
        title: `Address risk: ${r.title}`,
        why: `${r.severity} risk from ${r.createdByRule ?? "system"}.`,
        sources: [
          sourceRiskFlag(r.id, r.createdByRule ?? "unknown"),
          sourceApi("GET /api/internal/founder/summary", new Date().toISOString()),
        ],
        id: r.id,
        dedupeKey: dk,
      });
      incRule(ruleCounts, r.createdByRule);
    }
  }

  // Outcome 2: Top NBA
  if (nbaTop.length > 0 && outcomes.length < 3) {
    const a = nbaTop[0];
    const dk = `nba:${a.dedupeKey ?? a.id}`;
    if (!seenDedupe.has(dk)) {
      seenDedupe.add(dk);
      outcomes.push({
        title: a.title,
        why: a.reason ?? `Priority ${a.priority}, score ${a.score}`,
        sources: [
          sourceNextAction(a.id, a.createdByRule ?? "unknown", a.dedupeKey ?? a.id),
          sourceApi("GET /api/internal/founder/summary", new Date().toISOString()),
        ],
        id: a.id,
        dedupeKey: dk,
      });
      incRule(ruleCounts, a.createdByRule);
    }
  }

  // Outcome 3: Pipeline stalls or second NBA
  if (stuckOver7d > 0 && outcomes.length < 3) {
    const dk = "pipeline:stuck_over_7d";
    if (!seenDedupe.has(dk)) {
      seenDedupe.add(dk);
      outcomes.push({
        title: `Unstick ${stuckOver7d} lead(s) stuck >7 days`,
        why: `${stuckOver7d} leads with no recent contact.`,
        sources: [sourceApi("GET /api/internal/founder/summary", new Date().toISOString())],
        dedupeKey: dk,
      });
    }
  }
  if (noNextStep > 0 && outcomes.length < 3) {
    const dk = "pipeline:no_next_step";
    if (!seenDedupe.has(dk)) {
      seenDedupe.add(dk);
      outcomes.push({
        title: `Set next step for ${noNextStep} lead(s)`,
        why: `${noNextStep} leads without next action.`,
        sources: [sourceApi("GET /api/internal/founder/summary", new Date().toISOString())],
        dedupeKey: dk,
      });
    }
  }
  if (nbaTop.length > 1 && outcomes.length < 3) {
    const a = nbaTop[1];
    const dk = `nba:${a.dedupeKey ?? a.id}`;
    if (!seenDedupe.has(dk)) {
      seenDedupe.add(dk);
      outcomes.push({
        title: a.title,
        why: a.reason ?? `Priority ${a.priority}`,
        sources: [
          sourceNextAction(a.id, a.createdByRule ?? "unknown", a.dedupeKey ?? a.id),
          sourceApi("GET /api/internal/founder/summary", new Date().toISOString()),
        ],
        id: a.id,
        dedupeKey: dk,
      });
      incRule(ruleCounts, a.createdByRule);
    }
  }

  // Milestones: from NBA + risks (specific, measurable)
  const milestones: SuggestedMilestone[] = [];
  for (const a of nbaTop.slice(0, 3)) {
    milestones.push({
      title: a.title,
      measurable: `Complete by end of week`,
      sources: [
        sourceNextAction(a.id, a.createdByRule ?? "unknown", a.dedupeKey ?? a.id),
      ],
    });
  }
  if (riskTop.length > 0 && milestones.length < 5) {
    const r = riskTop[0];
    milestones.push({
      title: `Resolve: ${r.title}`,
      measurable: `Risk closed or mitigated`,
      sources: [sourceRiskFlag(r.id, r.createdByRule ?? "unknown")],
    });
  }

  // Focus constraint: most common ruleKey from risks + NBA
  const topRule = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])[0];
  const focusConstraint = topRule ? topRule[0] : null;

  return {
    topOutcomes: outcomes.slice(0, 3),
    milestones: milestones.slice(0, 5),
    focusConstraint,
  };
}

function incRule(m: Record<string, number>, key?: string): void {
  if (!key) return;
  m[key] = (m[key] ?? 0) + 1;
}
