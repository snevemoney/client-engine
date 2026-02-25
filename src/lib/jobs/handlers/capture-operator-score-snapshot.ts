/**
 * Phase 2.8.4: Handler for capture_operator_score_snapshot job.
 */

import { captureOperatorScoreSnapshot } from "@/lib/operator-score/snapshot-service";

export async function handleCaptureOperatorScoreSnapshot(): Promise<object> {
  return captureOperatorScoreSnapshot();
}
