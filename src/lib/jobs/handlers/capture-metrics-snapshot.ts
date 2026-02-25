/**
 * Phase 2.8.4: Handler for capture_metrics_snapshot job.
 */

import { captureMetricsSnapshot } from "@/lib/metrics/snapshot-service";
import type { JobPayloadMap } from "../types";

export async function handleCaptureMetricsSnapshot(
  payload: JobPayloadMap["capture_metrics_snapshot"]
): Promise<object> {
  const weekStart = payload?.weekStart ? new Date(payload.weekStart) : undefined;
  return captureMetricsSnapshot(weekStart);
}
