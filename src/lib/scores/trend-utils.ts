/**
 * Phase 3.3: Score trend utilities — pure functions for trend summary and factor changes.
 */

export type TimelinePoint = { score: number; computedAt: string };
export type ScoreEvent = {
  id: string;
  eventType: string;
  fromScore: number;
  toScore: number;
  delta: number;
  fromBand: string;
  toBand: string;
  createdAt: string;
};

export type TrendSummary = {
  currentScore: number;
  netChange: number;
  highest: number;
  lowest: number;
  eventCounts: { threshold_breach: number; sharp_drop: number; recovery: number };
};

export function computeTrendSummary(
  timeline: TimelinePoint[],
  events: ScoreEvent[],
  currentScore: number
): TrendSummary {
  const scores = timeline.map((t) => t.score);
  const startScore = scores[0];
  const endScore = scores[scores.length - 1];
  const netChange = startScore != null && endScore != null ? endScore - startScore : 0;

  const eventCounts = events.reduce(
    (acc, e) => {
      if (e.eventType === "threshold_breach") acc.threshold_breach += 1;
      else if (e.eventType === "sharp_drop") acc.sharp_drop += 1;
      else if (e.eventType === "recovery") acc.recovery += 1;
      return acc;
    },
    { threshold_breach: 0, sharp_drop: 0, recovery: 0 }
  );

  return {
    currentScore,
    netChange,
    highest: scores.length > 0 ? Math.max(...scores) : currentScore,
    lowest: scores.length > 0 ? Math.min(...scores) : currentScore,
    eventCounts,
  };
}

export type FactorItem = {
  key: string;
  label: string;
  weight: number;
  normalizedValue: number;
  impact: number;
  reason?: string;
};

export type FactorChange = {
  key: string;
  label: string;
  prevValue: number;
  currValue: number;
  delta: number;
  impact: number;
  direction: "up" | "down" | "flat";
};

export function computeFactorChanges(
  latest: FactorItem[],
  previous: FactorItem[] | null
): FactorChange[] {
  if (!previous || previous.length === 0) return [];

  const prevByKey = new Map(previous.map((f) => [f.key, f]));
  const changes: FactorChange[] = [];

  for (const curr of latest) {
    const prev = prevByKey.get(curr.key);
    if (!prev) continue;
    const delta = curr.normalizedValue - prev.normalizedValue;
    const direction: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const impact = curr.impact - prev.impact;

    changes.push({
      key: curr.key,
      label: curr.label,
      prevValue: prev.normalizedValue,
      currValue: curr.normalizedValue,
      delta,
      impact,
      direction,
    });
  }

  return changes.sort((a, b) => a.impact - b.impact);
}
