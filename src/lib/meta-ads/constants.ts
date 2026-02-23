/**
 * Central config for Meta Ads Monitor insights rules.
 * Tune thresholds here — deterministic, no ML.
 */

export const META_ADS_INSIGHTS = {
  HIGH_SPEND_NO_LEADS: 20,
  FREQUENCY_FATIGUE_THRESHOLD: 3,
  CPL_ABOVE_AVG_MULTIPLIER: 1.5,
  LOW_CTR_BASELINE: 0.5,
  MIN_SPEND_FOR_CTR: 5,
  /** CPL spike vs prior period: alert if current CPL > prior * this */
  CPL_SPIKE_VS_PRIOR_MULTIPLIER: 1.3,
  /** CTR drop vs prior period: alert if current < prior * this */
  CTR_DROP_VS_PRIOR_RATIO: 0.7,
  /** Min spend to consider for CPL spike rule */
  MIN_SPEND_FOR_CPL_SPIKE: 10,
} as const;

/** Cache TTL in seconds */
export const META_ADS_CACHE_TTL_SEC = 600; // 10 min
