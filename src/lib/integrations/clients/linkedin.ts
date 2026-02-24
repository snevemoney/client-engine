/**
 * LinkedIn placeholder client.
 * OFF/MOCK/MANUAL/LIVE behavior. LIVE is a stub for future API integration.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";

export type LinkedInProfile = {
  id: string;
  name: string;
  headline?: string;
  connectionsCount?: number;
};

const MOCK_PROFILE: LinkedInProfile = {
  id: "mock-1",
  name: "Mock User",
  headline: "Operations & Sales",
  connectionsCount: 500,
};

export async function fetchLinkedInProfile(
  mode: IntegrationMode,
  _config: Record<string, unknown>
): Promise<ProviderClientResult<LinkedInProfile | null>> {
  switch (mode) {
    case "off":
      return { ok: true, data: null, message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: MOCK_PROFILE, message: "Mock data" };
    case "manual":
      return { ok: true, data: null, message: "MANUAL: paste profile data from LinkedIn" };
    case "live":
      return { ok: true, data: null, message: "LIVE: LinkedIn API not yet integrated" };
    default:
      return { ok: true, data: null, message: "Unknown mode" };
  }
}
