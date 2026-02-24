/**
 * Integration provider clients — placeholder implementations.
 * Each client respects OFF/MOCK/MANUAL/LIVE via mode parameter.
 * Use resolveConnection() from resolver first to get effective mode.
 */

import { resolveConnection } from "../resolver";
import { resolveProviderKey } from "../providerRegistry";
import { fetchUpworkJobs } from "./upwork";
import { fetchRssFeed } from "./rss";
import { fetchLinkedInProfile } from "./linkedin";
import { fetchCalendlyEvents } from "./calendly";
import { fetchGithubRepos } from "./github";
import type { ProviderClientResult } from "./types";

export { fetchUpworkJobs } from "./upwork";
export type { UpworkJob } from "./upwork";

export { fetchRssFeed } from "./rss";
export type { RssItem } from "./rss";

export { fetchLinkedInProfile } from "./linkedin";
export type { LinkedInProfile } from "./linkedin";

export { fetchCalendlyEvents } from "./calendly";
export type { CalendlyEvent } from "./calendly";

export { fetchGithubRepos } from "./github";
export type { GithubRepo } from "./github";

export type { ProviderClientResult, ConnectionContext } from "./types";

type ConnectionLike = { provider: string; mode: "off" | "mock" | "manual" | "live"; prodOnly?: boolean; configJson?: Record<string, unknown> };

const CLIENTS: Record<string, (mode: "off" | "mock" | "manual" | "live", config: Record<string, unknown>) => Promise<ProviderClientResult>> = {
  upwork: (m, c) => fetchUpworkJobs(m, c),
  rss: (m, c) => fetchRssFeed(m, c),
  rss_news: (m, c) => fetchRssFeed(m, c),
  linkedin: (m, c) => fetchLinkedInProfile(m, c),
  calendly: (m, c) => fetchCalendlyEvents(m, c),
  calcom: (m, c) => fetchCalendlyEvents(m, c), // same client for Cal.com
  github: (m, c) => fetchGithubRepos(m, c),
};

/**
 * Run a provider via resolver + client. Returns placeholder data for supported providers.
 * Unsupported providers return { ok: true, data: null, message }.
 */
export async function runProvider(
  conn: ConnectionLike,
  action: "fetch" = "fetch"
): Promise<ProviderClientResult> {
  const resolved = resolveConnection(conn);
  if (!resolved.shouldRun) {
    return { ok: true, data: null, message: "OFF: no run" };
  }
  const config = (conn.configJson ?? {}) as Record<string, unknown>;
  const canonical = resolveProviderKey(conn.provider);
  const client = CLIENTS[canonical] ?? CLIENTS[conn.provider];
  if (!client) {
    return { ok: true, data: null, message: `No client for provider: ${conn.provider}` };
  }
  return client(resolved.effectiveMode, config);
}
