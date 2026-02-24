/**
 * Integration mode utilities.
 * Local vs prod rules: LIVE only in production for prodOnly providers.
 */

export type IntegrationMode = "off" | "mock" | "manual" | "live";

export type RuntimeBehavior = {
  useMock: boolean;
  useManual: boolean;
  useLive: boolean;
};

/** True when NODE_ENV=production (server). For client, use window.location.hostname !== "localhost". */
export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Resolve effective mode: if prodOnly and not production, LIVE → MOCK fallback.
 * Use when executing integration logic (server-side).
 */
export function resolveIntegrationMode(
  requestedMode: IntegrationMode,
  prodOnly: boolean
): IntegrationMode {
  if (requestedMode !== "live") return requestedMode;
  if (prodOnly && !isProductionEnv()) return "mock";
  return "live";
}

/**
 * Returns behavior flags for the given mode.
 * Use to branch logic: mock data vs manual flow vs live API.
 */
export function getIntegrationRuntimeBehavior(mode: IntegrationMode): RuntimeBehavior {
  switch (mode) {
    case "off":
      return { useMock: false, useManual: false, useLive: false };
    case "mock":
      return { useMock: true, useManual: false, useLive: false };
    case "manual":
      return { useMock: false, useManual: true, useLive: false };
    case "live":
      return { useMock: false, useManual: false, useLive: true };
    default:
      return { useMock: false, useManual: false, useLive: false };
  }
}
