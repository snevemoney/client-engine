/**
 * Phase 3.1: Handler for score.compute job.
 */

import { computeAndStoreScore } from "@/lib/scoring/compute-and-store";
import type { JobPayloadMap } from "../types";

export async function handleScoreCompute(
  payload: JobPayloadMap["score.compute"]
): Promise<object> {
  const entityType = payload?.entityType as "review_stream" | "command_center";
  const entityId = payload?.entityId ?? "";

  if (!entityType || !entityId) {
    throw new Error("score.compute requires entityType and entityId");
  }

  if (entityType !== "review_stream" && entityType !== "command_center") {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const result = await computeAndStoreScore(entityType, entityId);
  return {
    snapshotId: result.snapshotId,
    score: result.score,
    band: result.band,
    delta: result.delta,
    eventsCreated: result.eventsCreated.length,
  };
}
