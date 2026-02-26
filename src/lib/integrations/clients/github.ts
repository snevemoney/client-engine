/**
 * GitHub placeholder client.
 * OFF/MOCK/MANUAL/LIVE behavior. LIVE is a stub for future API integration.
 */

import type { IntegrationMode } from "../providerRegistry";
import { trackedFetch } from "../usage";
import type { ProviderClientResult } from "./types";

export type GithubRepo = {
  id: string;
  name: string;
  fullName: string;
  url: string;
  updatedAt?: string;
};

export type GithubUser = {
  login: string;
  id: string;
  avatar_url: string;
  html_url: string;
  type: string;
};

const MOCK_REPOS: GithubRepo[] = [
  { id: "mock-1", name: "client-engine", fullName: "org/client-engine", url: "https://github.com/org/client-engine", updatedAt: new Date().toISOString() },
  { id: "mock-2", name: "ops-dashboard", fullName: "org/ops-dashboard", url: "https://github.com/org/ops-dashboard", updatedAt: new Date().toISOString() },
];

const MOCK_USERS: GithubUser[] = [
  { login: "octocat", id: "1", avatar_url: "https://github.com/octocat.png", html_url: "https://github.com/octocat", type: "User" },
  { login: "hubot", id: "2", avatar_url: "https://github.com/hubot.png", html_url: "https://github.com/hubot", type: "User" },
];

export async function fetchGithubRepos(
  mode: IntegrationMode,
  config: Record<string, unknown>
): Promise<ProviderClientResult<GithubRepo[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: MOCK_REPOS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: paste repo data from GitHub" };
    case "live": {
      const accessToken = config.accessToken as string | undefined;
      if (!accessToken || typeof accessToken !== "string") {
        return { ok: false, data: null, message: "Missing GitHub access token" };
      }
      const url = "https://api.github.com/user/repos?sort=updated&per_page=100";
      try {
        const res = await trackedFetch("github", "fetch", url, {
          headers: { Authorization: `token ${accessToken}` },
        });
        if (!res.ok) {
          const text = await res.text();
          return {
            ok: false,
            data: null,
            message: res.status === 401 ? "Invalid GitHub token" : `GitHub API error: ${res.status} - ${text.slice(0, 200)}`,
          };
        }
        const raw = (await res.json()) as Array<{ id: number; name: string; full_name: string; html_url: string; updated_at?: string }>;
        const data: GithubRepo[] = raw.map((r) => ({
          id: String(r.id),
          name: r.name,
          fullName: r.full_name,
          url: r.html_url,
          updatedAt: r.updated_at,
        }));
        return { ok: true, data, message: undefined };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, data: null, message: `GitHub API request failed: ${msg}` };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}

export async function searchGithubUsers(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  query: string
): Promise<ProviderClientResult<GithubUser[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no search" };
    case "mock":
      return { ok: true, data: MOCK_USERS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: paste user data from GitHub" };
    case "live": {
      const accessToken = config.accessToken as string | undefined;
      if (!accessToken || typeof accessToken !== "string") {
        return { ok: false, data: null, message: "Missing GitHub access token" };
      }
      const encoded = encodeURIComponent(query);
      const url = `https://api.github.com/search/users?q=${encoded}&per_page=30`;
      try {
        const res = await trackedFetch("github", "search_users", url, {
          headers: { Authorization: `token ${accessToken}` },
        });
        if (!res.ok) {
          const text = await res.text();
          return {
            ok: false,
            data: null,
            message: res.status === 401 ? "Invalid GitHub token" : `GitHub API error: ${res.status} - ${text.slice(0, 200)}`,
          };
        }
        const json = (await res.json()) as { items: Array<{ login: string; id: number; avatar_url: string; html_url: string; type: string }> };
        const data: GithubUser[] = (json.items ?? []).map((u) => ({
          login: u.login,
          id: String(u.id),
          avatar_url: u.avatar_url,
          html_url: u.html_url,
          type: u.type,
        }));
        return { ok: true, data, message: undefined };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, data: null, message: `GitHub API request failed: ${msg}` };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
