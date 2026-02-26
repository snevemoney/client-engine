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
import { fetchHubSpotContacts } from "./hubspot";
import { fetchStripeCustomers } from "./stripe";
import { searchGooglePlaces } from "./google-places";
import { searchSerpApi } from "./serpapi";
import { searchApolloPeople } from "./apollo";
import { searchYelpBusinesses } from "./yelp";
import { searchYouTubeChannels } from "./youtube-search";
import type { ProviderClientResult } from "./types";

export { fetchUpworkJobs } from "./upwork";
export type { UpworkJob } from "./upwork";

export { fetchRssFeed } from "./rss";
export type { RssItem } from "./rss";

export { fetchLinkedInProfile, searchLinkedInCompanies } from "./linkedin";
export type { LinkedInProfile, LinkedInCompany } from "./linkedin";

export { fetchCalendlyEvents } from "./calendly";
export type { CalendlyEvent } from "./calendly";

export { fetchGithubRepos, searchGithubUsers } from "./github";
export type { GithubRepo, GithubUser } from "./github";

export { fetchHubSpotContacts, searchHubSpotCompanies } from "./hubspot";
export type { HubSpotContact, HubSpotCompany } from "./hubspot";

export { fetchStripeCustomers } from "./stripe";
export type { StripeCustomer } from "./stripe";

export { searchGooglePlaces } from "./google-places";
export type { PlaceBusiness } from "./google-places";

export { searchSerpApi } from "./serpapi";
export type { SerpResult } from "./serpapi";

export { searchApolloPeople, searchApolloCompanies } from "./apollo";
export type { ApolloPerson, ApolloCompany } from "./apollo";

export { searchHunterDomain, findHunterEmail } from "./hunter";
export type { HunterEmail, HunterDomainResult } from "./hunter";

export { searchYelpBusinesses } from "./yelp";
export type { YelpBusiness } from "./yelp";

export { searchYouTubeChannels } from "./youtube-search";
export type { YouTubeChannel } from "./youtube-search";

export type { ProviderClientResult, ConnectionContext } from "./types";

type ConnectionLike = { provider: string; mode: "off" | "mock" | "manual" | "live"; prodOnly?: boolean; configJson?: Record<string, unknown> };

const CLIENTS: Record<string, (mode: "off" | "mock" | "manual" | "live", config: Record<string, unknown>) => Promise<ProviderClientResult>> = {
  upwork: (m, c) => fetchUpworkJobs(m, c),
  rss: (m, c) => fetchRssFeed(m, c),
  rss_news: (m, c) => fetchRssFeed(m, c),
  linkedin: (m, c) => fetchLinkedInProfile(m, c),
  calendly: (m, c) => fetchCalendlyEvents(m, c),
  calcom: (m, c) => fetchCalendlyEvents(m, c),
  github: (m, c) => fetchGithubRepos(m, c),
  hubspot: (m, c) => fetchHubSpotContacts(m, c),
  stripe: (m, c) => fetchStripeCustomers(m, c),
  google_places: (m, c) => searchGooglePlaces(m, c, ""),
  serpapi: (m, c) => searchSerpApi(m, c, ""),
  apollo: (m, c) => searchApolloPeople(m, c, ""),
  yelp: (m, c) => searchYelpBusinesses(m, c, ""),
  youtube: (m, c) => searchYouTubeChannels(m, c, ""),
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
