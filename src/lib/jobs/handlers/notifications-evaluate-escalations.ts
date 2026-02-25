/**
 * Phase 2.8.6: Handler for notifications.evaluate_escalations job.
 */

import { evaluateEscalationRules } from "@/lib/notifications/escalations";

export async function handleNotificationsEvaluateEscalations(payload: {
  limit?: number;
}): Promise<object> {
  const result = await evaluateEscalationRules({ limit: payload?.limit ?? 50 });
  return { created: result.created, queued: result.queued };
}
