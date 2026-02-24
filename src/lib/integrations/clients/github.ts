/**
 * GitHub placeholder client.
 * OFF/MOCK/MANUAL/LIVE behavior. LIVE is a stub for future API integration.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";

export type GithubRepo = {
  id: string;
  name: string;
  fullName: string;
  url: string;
  updatedAt?: string;
};

const MOCK_REPOS: GithubRepo[] = [
  { id: "mock-1", name: "client-engine", fullName: "org/client-engine", url: "https://github.com/org/client-engine", updatedAt: new Date().toISOString() },
  { id: "mock-2", name: "ops-dashboard", fullName: "org/ops-dashboard", url: "https://github.com/org/ops-dashboard", updatedAt: new Date().toISOString() },
];

export async function fetchGithubRepos(
  mode: IntegrationMode,
  _config: Record<string, unknown>
): Promise<ProviderClientResult<GithubRepo[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: MOCK_REPOS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: paste repo data from GitHub" };
    case "live":
      return { ok: true, data: [], message: "LIVE: GitHub API not yet integrated" };
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
