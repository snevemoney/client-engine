/**
 * Runtime guard utilities for integrations.
 * Used by PATCH and test endpoints to enforce prodOnly and mode capabilities.
 */

import type { IntegrationMode } from "./providerRegistry";

export type ResolveResult =
  | { ok: true; mode: IntegrationMode }
  | { ok: false; mode: IntegrationMode; message: string };

/** True when NODE_ENV=production. */
export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

export type ResolveRequestedModeParams = {
  provider: string;
  requestedMode: IntegrationMode;
  prodOnly: boolean;
  supportsLive: boolean;
  supportsMock: boolean;
  supportsManual: boolean;
};

/**
 * Resolve requested mode against provider capabilities and environment.
 * - LIVE for prodOnly providers: only in production; else auto-downgrade to MOCK with message.
 * - Reject mode if provider doesn't support it (e.g. supportsLive=false).
 */
export function resolveRequestedMode(params: ResolveRequestedModeParams): ResolveResult {
  const { requestedMode, prodOnly, supportsLive, supportsMock, supportsManual } = params;

  const checkSupport = (): ResolveResult | null => {
    if (requestedMode === "live" && !supportsLive)
      return { ok: false, mode: "off", message: "Provider does not support LIVE mode" };
    if (requestedMode === "mock" && !supportsMock)
      return { ok: false, mode: "off", message: "Provider does not support MOCK mode" };
    if (requestedMode === "manual" && !supportsManual)
      return { ok: false, mode: "off", message: "Provider does not support MANUAL mode" };
    return null;
  };

  const unsupported = checkSupport();
  if (unsupported) return unsupported;

  // prodOnly: LIVE only in production
  if (requestedMode === "live" && prodOnly && !isProductionEnv()) {
    return { ok: false, mode: "mock", message: "LIVE not allowed in non-production for this provider. Use MOCK or MANUAL." };
  }

  return { ok: true, mode: requestedMode };
}

export type CanRunLiveParams = {
  provider: string;
  mode: IntegrationMode;
  prodOnly: boolean;
  supportsLive: boolean;
};

/** True if live integration can run: mode=live, supportsLive, and (if prodOnly) production env. */
export function canRunLiveIntegration(params: CanRunLiveParams): boolean {
  const { mode, prodOnly, supportsLive } = params;
  if (mode !== "live" || !supportsLive) return false;
  if (prodOnly && !isProductionEnv()) return false;
  return true;
}
