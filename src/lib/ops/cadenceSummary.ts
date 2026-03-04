/**
 * Cadence summary for Command Center: count of cadences due today.
 */

import { db } from "@/lib/db";

export type CadenceDueSummary = {
  dueToday: number;
};

/**
 * Count cadences due today (dueAt <= end of today, not completed, not snoozed).
 */
export async function getCadenceDueSummary(): Promise<CadenceDueSummary> {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const dueToday = await db.cadence.count({
    where: {
      dueAt: { lte: endOfToday },
      completedAt: null,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
    },
  });

  return { dueToday };
}
