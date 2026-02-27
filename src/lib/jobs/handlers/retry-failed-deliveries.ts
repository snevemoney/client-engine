/**
 * Phase 4.2: Stub handler for retry_failed_deliveries job.
 * Logs ops event; full implementation TBD.
 */
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta } from "@/lib/ops-events/sanitize";

export async function handleRetryFailedDeliveries(payload: {
  nextActionId: string;
}): Promise<object> {
  logOpsEventSafe({
    category: "system",
    eventKey: "nba.delivery.retry_job.stub",
    meta: sanitizeMeta({
      nextActionId: payload.nextActionId,
      note: "retry_failed_deliveries handler stub — logs only",
    }),
  });
  return { stubbed: true, nextActionId: payload.nextActionId };
}
