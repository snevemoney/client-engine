/**
 * Phase 3.5: Score notification cooldown — suppress repeat alerts within configurable window.
 */

import { db } from "@/lib/db";

export type CooldownCheckResult = {
  inCooldown: boolean;
  lastNotificationAt?: Date;
};

/**
 * Check if a score notification for this scope was already emitted within cooldown window.
 * Scope: entityType + entityId + eventType.
 * Returns inCooldown=true if we should suppress (prior notification exists within window).
 */
export async function isScoreNotificationInCooldown(
  entityType: string,
  entityId: string,
  eventType: "threshold_breach" | "sharp_drop" | "recovery",
  cooldownMinutes: number
): Promise<CooldownCheckResult> {
  if (cooldownMinutes <= 0) {
    return { inCooldown: false };
  }

  const dedupeKey = `notif:score:${entityType}:${entityId}:${eventType}`;
  const since = new Date();
  since.setMinutes(since.getMinutes() - Math.min(1440, cooldownMinutes));

  const recent = await db.notificationEvent.findFirst({
    where: {
      dedupeKey,
      sourceType: "score",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (recent) {
    return { inCooldown: true, lastNotificationAt: recent.createdAt };
  }
  return { inCooldown: false };
}
