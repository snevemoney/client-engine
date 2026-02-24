/**
 * Upwork placeholder client.
 * OFF/MOCK/MANUAL/LIVE behavior. LIVE is a stub for future API integration.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";

export type UpworkJob = {
  id: string;
  title: string;
  postedAt: string;
  budget?: string;
  description?: string;
};

const MOCK_JOBS: UpworkJob[] = [
  { id: "mock-1", title: "Mock: Marketing automation setup", postedAt: new Date().toISOString(), budget: "$500–1k" },
  { id: "mock-2", title: "Mock: CRM integration consultant", postedAt: new Date().toISOString(), budget: "$1k–5k" },
  { id: "mock-3", title: "Mock: Sales ops audit", postedAt: new Date().toISOString(), budget: "$2k–10k" },
];

export async function fetchUpworkJobs(
  mode: IntegrationMode,
  _config: Record<string, unknown>
): Promise<ProviderClientResult<UpworkJob[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: MOCK_JOBS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: paste jobs from Upwork dashboard" };
    case "live":
      return { ok: true, data: [], message: "LIVE: Upwork API not yet integrated" };
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
