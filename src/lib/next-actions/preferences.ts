/**
 * Phase 4.3: NBA preference matching — filter candidates by active suppressions.
 */

import { db } from "@/lib/db";
import type { NextActionCandidate } from "./types";

export type ActivePreference = {
  ruleKey: string | null;
  dedupeKey: string | null;
};

/**
 * Load active suppressions for scope. status=active and (suppressedUntil null or > now).
 */
export async function loadActiveSuppressions(
  entityType: string,
  entityId: string
): Promise<ActivePreference[]> {
  const now = new Date();
  const rows = await db.nextActionPreference.findMany({
    where: {
      entityType,
      entityId,
      status: "active",
      OR: [{ suppressedUntil: null }, { suppressedUntil: { gt: now } }],
    },
    select: { ruleKey: true, dedupeKey: true },
  });
  return rows;
}

/**
 * Check if a candidate is suppressed by any active preference.
 */
export function isCandidateSuppressed(
  candidate: NextActionCandidate,
  suppressions: ActivePreference[]
): boolean {
  for (const s of suppressions) {
    if (s.ruleKey && candidate.createdByRule === s.ruleKey) return true;
    if (s.dedupeKey && candidate.dedupeKey === s.dedupeKey) return true;
  }
  return false;
}

/**
 * Filter candidates to exclude those suppressed by preferences.
 */
export async function filterByPreferences(
  candidates: NextActionCandidate[],
  entityType: string,
  entityId: string
): Promise<NextActionCandidate[]> {
  const suppressions = await loadActiveSuppressions(entityType, entityId);
  return candidates.filter((c) => !isCandidateSuppressed(c, suppressions));
}
