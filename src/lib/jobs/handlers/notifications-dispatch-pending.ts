/**
 * Phase 2.8.6: Handler for notifications.dispatch_pending job.
 */

import { dispatchPendingDeliveries } from "@/lib/notifications/service";

export async function handleNotificationsDispatchPending(payload: {
  limit?: number;
}): Promise<object> {
  const result = await dispatchPendingDeliveries(payload?.limit ?? 20);
  return { sent: result.sent, failed: result.failed, skipped: result.skipped };
}
