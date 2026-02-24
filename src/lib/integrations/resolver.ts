/**
 * Provider resolver layer — selects effective mode and behavior for integrations.
 * Used before calling any provider client to decide OFF/MOCK/MANUAL/LIVE.
 */

import {
  resolveIntegrationMode,
  getIntegrationRuntimeBehavior,
  isProductionEnv,
  type IntegrationMode,
  type RuntimeBehavior,
} from "./mode";
import { getProviderDef, resolveProviderKey } from "./providerRegistry";

export type ResolvedIntegration = {
  /** Effective mode after prodOnly/env resolution */
  effectiveMode: IntegrationMode;
  /** Behavior flags for branching client logic */
  behavior: RuntimeBehavior;
  /** Whether any integration logic should run (false for OFF) */
  shouldRun: boolean;
  /** Provider definition if known */
  providerDef: ReturnType<typeof getProviderDef>;
};

/**
 * Resolve integration mode and behavior for a connection.
 * - Resolves LIVE → MOCK when prodOnly and not in production.
 * - Returns behavior flags for use by provider clients.
 */
export function resolveIntegration(
  provider: string,
  mode: IntegrationMode,
  prodOnly: boolean
): ResolvedIntegration {
  const canonical = resolveProviderKey(provider);
  const providerDef = getProviderDef(canonical);
  const effectiveMode = resolveIntegrationMode(mode, prodOnly);
  const behavior = getIntegrationRuntimeBehavior(effectiveMode);
  const shouldRun = effectiveMode !== "off";

  return {
    effectiveMode,
    behavior,
    shouldRun,
    providerDef: providerDef ?? undefined,
  };
}

/**
 * Resolve from a minimal connection-like object.
 * Use when you have { provider, mode, prodOnly } from DB.
 */
export function resolveConnection(conn: {
  provider: string;
  mode: IntegrationMode;
  prodOnly?: boolean;
}): ResolvedIntegration {
  return resolveIntegration(
    conn.provider,
    conn.mode,
    conn.prodOnly ?? false
  );
}

/** Re-export for convenience */
export { isProductionEnv };
