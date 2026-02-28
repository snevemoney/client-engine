/**
 * Phase 7.2: Memory policy engine — deterministic suggestions, trend diffs, pattern alerts.
 */
import { db } from "@/lib/db";
import { OperatorMemorySourceType, OperatorMemoryOutcome } from "@prisma/client";

export type WindowStats = {
  byRuleKey: Record<
    string,
    {
      executeSuccess: number;
      executeFailure: number;
      dismiss: number;
      snooze: number;
      total: number;
      dismissRate: number;
      successRate: number;
    }
  >;
};

export type TrendDiff = {
  ruleKey: string;
  currentCount: number;
  priorCount: number;
  delta: number;
  direction: "up" | "down" | "unchanged";
};

export type PolicySuggestion = {
  type: "suppression_30d" | "suppression_rule_permanent" | "raise_risk";
  ruleKey: string;
  confidence: number;
  reasons: string[];
  evidence: Array<{ key: string; value: unknown }>;
  severity?: "medium" | "high" | "critical";
};

export type PatternAlert = {
  ruleKey: string;
  severity: "medium" | "high" | "critical";
  title: string;
  description: string;
  dedupeKey: string;
};

// Tunable constants
const SUPPRESSION_DISMISS_MIN = 3;
const SUPPRESSION_SUCCESS_RATE_MAX = 0.25;
const SUPPRESSION_CONFIDENCE_DIVISOR = 6;
const ALERT_FAILURE_MIN = 2;
const ALERT_DELTA_HIGH = 5;
const ALERT_DELTA_MEDIUM = 3;
const CRITICAL_RULE_KEYS = new Set([
  "score_in_critical_band",
  "failed_notification_deliveries",
  "flywheel_won_no_delivery",
]);

/**
 * Compute window stats for a time range.
 */
export async function computeWindowStats(
  actorUserId: string,
  from: Date,
  to: Date
): Promise<WindowStats> {
  const events = await db.operatorMemoryEvent.findMany({
    where: {
      actorUserId,
      createdAt: { gte: from, lt: to },
    },
    select: { ruleKey: true, sourceType: true, outcome: true },
  });

  const byRuleKey: WindowStats["byRuleKey"] = {};

  for (const e of events) {
    const rk = e.ruleKey ?? "unknown";
    if (!byRuleKey[rk]) {
      byRuleKey[rk] = {
        executeSuccess: 0,
        executeFailure: 0,
        dismiss: 0,
        snooze: 0,
        total: 0,
        dismissRate: 0,
        successRate: 0,
      };
    }
    const s = byRuleKey[rk];
    s.total++;

    if (e.sourceType === OperatorMemorySourceType.nba_execute) {
      if (e.outcome === OperatorMemoryOutcome.success) s.executeSuccess++;
      else if (e.outcome === OperatorMemoryOutcome.failure) s.executeFailure++;
    } else if (e.sourceType === OperatorMemorySourceType.nba_dismiss) {
      s.dismiss++;
    } else if (e.sourceType === OperatorMemorySourceType.nba_snooze) {
      s.snooze++;
    }
  }

  for (const s of Object.values(byRuleKey)) {
    const execTotal = s.executeSuccess + s.executeFailure;
    s.dismissRate = s.total > 0 ? s.dismiss / s.total : 0;
    s.successRate = execTotal > 0 ? s.executeSuccess / execTotal : 0;
  }

  return { byRuleKey };
}

/**
 * Compute trend diffs between current and prior stats.
 */
export function computeTrendDiffs(
  currentStats: WindowStats,
  priorStats: WindowStats
): { recurring: TrendDiff[]; dismissed: TrendDiff[]; successful: TrendDiff[] } {
  const allKeys = new Set([
    ...Object.keys(currentStats.byRuleKey),
    ...Object.keys(priorStats.byRuleKey),
  ]);

  const recurring: TrendDiff[] = [];
  const dismissed: TrendDiff[] = [];
  const successful: TrendDiff[] = [];

  for (const rk of allKeys) {
    const curr = currentStats.byRuleKey[rk];
    const prior = priorStats.byRuleKey[rk];
    const currentCount = curr?.total ?? 0;
    const priorCount = prior?.total ?? 0;
    const delta = currentCount - priorCount;
    const direction: TrendDiff["direction"] = delta > 0 ? "up" : delta < 0 ? "down" : "unchanged";

    const diff: TrendDiff = { ruleKey: rk, currentCount, priorCount, delta, direction };

    if (curr?.dismiss > 0 || prior?.dismiss) {
      dismissed.push(diff);
    }
    if (curr?.executeSuccess > 0 || prior?.executeSuccess) {
      successful.push(diff);
    }
    recurring.push(diff);
  }

  const sortByAbsDelta = (a: TrendDiff, b: TrendDiff) => Math.abs(b.delta) - Math.abs(a.delta);

  return {
    recurring: recurring.sort(sortByAbsDelta).slice(0, 10),
    dismissed: dismissed.sort(sortByAbsDelta).slice(0, 10),
    successful: successful.sort(sortByAbsDelta).slice(0, 10),
  };
}

/**
 * Derive policy suggestions from stats and diffs.
 */
export function derivePolicySuggestions(
  stats: WindowStats,
  diffs: ReturnType<typeof computeTrendDiffs>
): PolicySuggestion[] {
  const suggestions: PolicySuggestion[] = [];

  for (const [rk, s] of Object.entries(stats.byRuleKey)) {
    if (rk === "unknown") continue;

    if (s.dismiss >= SUPPRESSION_DISMISS_MIN && s.successRate <= SUPPRESSION_SUCCESS_RATE_MAX) {
      const confidence = Math.min(1, s.dismiss / SUPPRESSION_CONFIDENCE_DIVISOR);
      suggestions.push({
        type: "suppression_30d",
        ruleKey: rk,
        confidence,
        reasons: [
          `${s.dismiss} dismissals in window`,
          `Success rate ${(s.successRate * 100).toFixed(0)}% ≤ ${SUPPRESSION_SUCCESS_RATE_MAX * 100}%`,
        ],
        evidence: [
          { key: "dismissCount", value: s.dismiss },
          { key: "successRate", value: s.successRate },
          { key: "total", value: s.total },
        ],
      });
    }

    const diff = diffs.recurring.find((d) => d.ruleKey === rk);
    const failureCount = s.executeFailure;
    const delta = diff?.delta ?? 0;

    if (failureCount >= ALERT_FAILURE_MIN || delta >= ALERT_DELTA_MEDIUM) {
      let severity: PatternAlert["severity"] = "medium";
      if (CRITICAL_RULE_KEYS.has(rk) && (failureCount >= 2 || delta >= 3)) {
        severity = "critical";
      } else if (delta >= ALERT_DELTA_HIGH) {
        severity = "high";
      }

      suggestions.push({
        type: "raise_risk",
        ruleKey: rk,
        confidence: Math.min(1, (failureCount + Math.max(0, delta)) / 10),
        reasons: [
          failureCount >= ALERT_FAILURE_MIN ? `${failureCount} failures in window` : null,
          delta >= ALERT_DELTA_MEDIUM ? `Delta +${delta} vs prior period` : null,
        ].filter(Boolean) as string[],
        evidence: [
          { key: "failureCount", value: failureCount },
          { key: "delta", value: delta },
        ],
        severity,
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Build pattern alerts from suggestions.
 */
export function buildPatternAlerts(suggestions: PolicySuggestion[]): PatternAlert[] {
  const alerts: PatternAlert[] = [];
  const seen = new Set<string>();

  for (const s of suggestions) {
    if (s.type !== "raise_risk" || seen.has(s.ruleKey)) continue;
    seen.add(s.ruleKey);

    const severity: PatternAlert["severity"] = s.severity ?? "medium";
    const windowKey = new Date().toISOString().slice(0, 10);
    alerts.push({
      ruleKey: s.ruleKey,
      severity,
      title: `Pattern alert: ${s.ruleKey}`,
      description: s.reasons.join(". "),
      dedupeKey: `pattern:${s.ruleKey}:${windowKey}`,
    });
  }

  return alerts;
}
