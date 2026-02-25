/**
 * Phase 3.1: Score Engine — public API.
 */

export { computeScore, assignBand, DEFAULT_THRESHOLDS } from "./engine";
export { computeAndStoreScore } from "./compute-and-store";
export type { ScoreEntityType, ComputeAndStoreResult } from "./compute-and-store";
export type {
  ScoreBand,
  ScoreComputationInput,
  ScoreComputationResult,
  ScoreFactorInput,
  ScoreFactorResult,
  ScoreReason,
  ScoreThresholds,
} from "./types";
