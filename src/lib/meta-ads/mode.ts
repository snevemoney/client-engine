/**
 * Meta Ads mode selection: mock (local simulation) vs live (Meta Graph API).
 * Default: local/dev => mock, prod => live if META_ACCESS_TOKEN + META_AD_ACCOUNT_ID set.
 */

export type MetaMode = "mock" | "live";

export const META_MOCK_SCENARIOS = [
  "no_campaigns",
  "healthy_campaigns",
  "high_cpl",
  "no_leads_after_spend",
  "fatigue_detected",
  "mixed_account",
] as const;

export type MetaMockScenario = (typeof META_MOCK_SCENARIOS)[number];

const DEFAULT_SCENARIO: MetaMockScenario = "healthy_campaigns";

/** Resolve META_MODE: explicit env > inferred from NODE_ENV + credentials */
export function getMetaMode(): MetaMode {
  const env = process.env.META_MODE?.toLowerCase().trim();
  if (env === "mock") return "mock";
  if (env === "live") return "live";

  // Env check is intentionally synchronous for fast mode detection.
  // Actual credentials are resolved via @/lib/integrations/credentials at call time (DB-first, env fallback).
  const isProd = process.env.NODE_ENV === "production";
  const hasToken = !!process.env.META_ACCESS_TOKEN?.trim();
  const hasAccount = !!process.env.META_AD_ACCOUNT_ID?.trim();

  if (isProd && hasToken && hasAccount) return "live";
  return "mock";
}

/** Current mock scenario (only meaningful when mode is mock) */
export function getMetaMockScenario(): MetaMockScenario {
  const raw = process.env.META_MOCK_SCENARIO?.toLowerCase().trim();
  if (raw && META_MOCK_SCENARIOS.includes(raw as MetaMockScenario)) {
    return raw as MetaMockScenario;
  }
  return DEFAULT_SCENARIO;
}
