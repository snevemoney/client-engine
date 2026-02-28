/**
 * Phase 5.3: Coach Mode citations.
 * Normalized source objects for traceability.
 */
export type CoachSource =
  | { kind: "score_snapshot"; id: string; createdAt: string }
  | { kind: "risk_flag"; id: string; ruleKey: string }
  | { kind: "next_action"; id: string; ruleKey: string; dedupeKey: string }
  | { kind: "api"; route: string; at: string };

export function sourceScoreSnapshot(id: string, createdAt: string): CoachSource {
  return { kind: "score_snapshot", id, createdAt };
}

export function sourceRiskFlag(id: string, ruleKey: string): CoachSource {
  return { kind: "risk_flag", id, ruleKey };
}

export function sourceNextAction(id: string, ruleKey: string, dedupeKey: string): CoachSource {
  return { kind: "next_action", id, ruleKey, dedupeKey };
}

export function sourceApi(route: string, at?: string): CoachSource {
  return { kind: "api", route, at: at ?? new Date().toISOString() };
}

export function formatSourceForDisplay(src: CoachSource): string {
  switch (src.kind) {
    case "score_snapshot":
      return `Score snapshot ${src.id} (${src.createdAt})`;
    case "risk_flag":
      return `Risk ${src.id} (${src.ruleKey})`;
    case "next_action":
      return `NBA ${src.id} (${src.ruleKey})`;
    case "api":
      return `${src.route} @ ${src.at}`;
    default:
      return String(src);
  }
}
