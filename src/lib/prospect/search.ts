/**
 * Prospect search engine.
 * Orchestrates searches across all enabled integration connections
 * based on criteria (client type, industry, keywords, etc.).
 * No hard limit — exhausts all available sources.
 */
import { db } from "@/lib/db";
import { getCredentials } from "@/lib/integrations/credentials";
import { resolveConnection } from "@/lib/integrations/resolver";
import { searchGithubUsers, fetchGithubRepos } from "@/lib/integrations/clients/github";
import { fetchRssFeed } from "@/lib/integrations/clients/rss";
import { fetchUpworkJobs } from "@/lib/integrations/clients/upwork";
import { searchLinkedInCompanies, fetchLinkedInProfile } from "@/lib/integrations/clients/linkedin";
import { fetchHubSpotContacts, searchHubSpotCompanies } from "@/lib/integrations/clients/hubspot";
import { fetchStripeCustomers } from "@/lib/integrations/clients/stripe";
import { fetchCalendlyEvents } from "@/lib/integrations/clients/calendly";
import { trackApiUsage } from "@/lib/integrations/usage";
import type { IntegrationMode } from "@/lib/integrations/providerRegistry";
import type { ProspectCriteria, ProspectResult, ProspectRunReport } from "./types";

function buildSearchQuery(criteria: ProspectCriteria): string {
  const parts: string[] = [];
  if (criteria.clientType) parts.push(criteria.clientType);
  if (criteria.industry) parts.push(criteria.industry);
  if (criteria.keywords?.length) parts.push(...criteria.keywords);
  if (criteria.location) parts.push(criteria.location);
  return parts.join(" ");
}

function matchesCriteria(text: string, criteria: ProspectCriteria): boolean {
  const lower = text.toLowerCase();
  const terms = [
    criteria.clientType,
    criteria.industry,
    ...(criteria.keywords ?? []),
  ].filter(Boolean).map((t) => t!.toLowerCase());
  if (terms.length === 0) return true;
  return terms.some((term) => lower.includes(term));
}

function makeId(): string {
  return `pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type ConnectionRow = {
  provider: string;
  mode: IntegrationMode;
  prodOnly: boolean;
  configJson: unknown;
  isEnabled: boolean;
};

function mergeConfig(
  configJson: unknown,
  creds: { accessToken: string | null; accountId: string | null; baseUrl: string | null; bookingUrl: string | null },
): Record<string, unknown> {
  const base = (configJson ?? {}) as Record<string, unknown>;
  return {
    ...base,
    accessToken: base.accessToken || creds.accessToken || undefined,
    accountId: base.accountId || creds.accountId || undefined,
    baseUrl: base.baseUrl || creds.baseUrl || undefined,
    bookingUrl: base.bookingUrl || creds.bookingUrl || undefined,
  };
}

type SourceSearcher = {
  name: string;
  search: (conn: ConnectionRow, mode: IntegrationMode, config: Record<string, unknown>, criteria: ProspectCriteria) => Promise<ProspectResult[]>;
};

const SOURCE_SEARCHERS: Record<string, SourceSearcher> = {
  github: {
    name: "GitHub",
    async search(_conn, mode, config, criteria) {
      const query = buildSearchQuery(criteria);
      const result = await searchGithubUsers(mode, config, query);
      if (!result.ok || !result.data) return [];
      return result.data.map((u): ProspectResult => ({
        id: makeId(),
        source: "github",
        title: u.login,
        description: `GitHub ${u.type}: ${u.login}`,
        url: u.html_url,
        contactPath: u.html_url,
        tags: [`type:${u.type}`],
        confidence: 0.6,
        meta: { avatar_url: u.avatar_url },
      }));
    },
  },
  rss: {
    name: "RSS/News",
    async search(_conn, mode, config, criteria) {
      const result = await fetchRssFeed(mode, config);
      if (!result.ok || !result.data) return [];
      return result.data
        .filter((item) => matchesCriteria(`${item.title} ${item.summary ?? ""}`, criteria))
        .map((item): ProspectResult => ({
          id: makeId(),
          source: "rss",
          title: item.title,
          description: item.summary ?? item.title,
          url: item.url,
          tags: [],
          confidence: 0.5,
          meta: { publishedAt: item.publishedAt },
        }));
    },
  },
  upwork: {
    name: "Upwork",
    async search(_conn, mode, config, criteria) {
      const result = await fetchUpworkJobs(mode, config);
      if (!result.ok || !result.data) return [];
      return result.data
        .filter((job) => matchesCriteria(`${job.title} ${job.description ?? ""}`, criteria))
        .map((job): ProspectResult => ({
          id: makeId(),
          source: "upwork",
          title: job.title,
          description: job.description ?? job.title,
          url: undefined,
          tags: job.budget ? [`budget:${job.budget}`] : [],
          confidence: 0.75,
          meta: { postedAt: job.postedAt, budget: job.budget },
        }));
    },
  },
  linkedin: {
    name: "LinkedIn",
    async search(_conn, mode, config, criteria) {
      const query = buildSearchQuery(criteria);
      const companiesResult = await searchLinkedInCompanies(mode, config, query);
      const results: ProspectResult[] = [];
      if (companiesResult.ok && companiesResult.data) {
        for (const c of companiesResult.data) {
          results.push({
            id: makeId(),
            source: "linkedin",
            title: c.name,
            description: [c.description, c.industry, c.staffCount ? `~${c.staffCount} staff` : null].filter(Boolean).join(" — "),
            url: c.vanityName ? `https://linkedin.com/company/${c.vanityName}` : undefined,
            tags: c.industry ? [`industry:${c.industry}`] : [],
            confidence: 0.7,
            meta: { staffCount: c.staffCount },
          });
        }
      }
      const profileResult = await fetchLinkedInProfile(mode, config);
      if (profileResult.ok && profileResult.data) {
        results.push({
          id: makeId(),
          source: "linkedin",
          title: profileResult.data.name,
          description: profileResult.data.headline ?? "LinkedIn profile",
          tags: [],
          confidence: 0.5,
          meta: { connectionsCount: profileResult.data.connectionsCount },
        });
      }
      return results;
    },
  },
  hubspot: {
    name: "HubSpot",
    async search(_conn, mode, config, criteria) {
      const query = buildSearchQuery(criteria);
      const results: ProspectResult[] = [];
      const companiesResult = await searchHubSpotCompanies(mode, config, query);
      if (companiesResult.ok && companiesResult.data) {
        for (const c of companiesResult.data) {
          results.push({
            id: makeId(),
            source: "hubspot",
            title: c.name,
            description: [c.domain, c.industry, c.city].filter(Boolean).join(" — "),
            url: `https://app.hubspot.com/contacts/companies/${c.id}`,
            tags: c.industry ? [`industry:${c.industry}`] : [],
            confidence: 0.7,
            meta: { domain: c.domain },
          });
        }
      }
      const contactsResult = await fetchHubSpotContacts(mode, config);
      if (contactsResult.ok && contactsResult.data) {
        const filtered = contactsResult.data.filter((c) =>
          matchesCriteria([c.firstName, c.lastName, c.company, c.email].filter(Boolean).join(" "), criteria)
        );
        for (const c of filtered) {
          results.push({
            id: makeId(),
            source: "hubspot",
            title: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Contact",
            description: [c.company, c.email, c.website].filter(Boolean).join(" — "),
            url: `https://app.hubspot.com/contacts/${c.id}`,
            contactPath: c.email,
            tags: c.company ? [`company:${c.company}`] : [],
            confidence: 0.65,
          });
        }
      }
      return results;
    },
  },
  stripe: {
    name: "Stripe",
    async search(_conn, mode, config, criteria) {
      const result = await fetchStripeCustomers(mode, config);
      if (!result.ok || !result.data) return [];
      return result.data
        .filter((c) => matchesCriteria([c.name, c.email, c.description].filter(Boolean).join(" "), criteria))
        .map((c): ProspectResult => ({
          id: makeId(),
          source: "stripe",
          title: c.name ?? c.email ?? c.id,
          description: [c.email, c.description].filter(Boolean).join(" — "),
          url: `https://dashboard.stripe.com/customers/${c.id}`,
          contactPath: c.email,
          tags: c.currency ? [`currency:${c.currency}`] : [],
          confidence: 0.6,
        }));
    },
  },
  calendly: {
    name: "Calendly",
    async search(_conn, mode, config, criteria) {
      const result = await fetchCalendlyEvents(mode, config);
      if (!result.ok || !result.data) return [];
      return result.data
        .filter((e) => matchesCriteria(e.name, criteria))
        .map((e): ProspectResult => ({
          id: makeId(),
          source: "calendly",
          title: e.name,
          description: `Event: ${e.name} (${e.status})`,
          url: e.uri,
          tags: [`status:${e.status}`],
          confidence: 0.5,
          meta: { startTime: e.startTime, endTime: e.endTime },
        }));
    },
  },
  calcom: {
    name: "Cal.com",
    async search(conn, mode, config, criteria) {
      return SOURCE_SEARCHERS.calendly.search(conn, mode, config, criteria);
    },
  },
};

/**
 * Run prospect search across all enabled connections.
 * Returns results from every source that has a client and is not OFF.
 */
export async function runProspectSearch(criteria: ProspectCriteria): Promise<ProspectRunReport> {
  const report: ProspectRunReport = {
    id: makeId(),
    criteria,
    startedAt: new Date().toISOString(),
    status: "running",
    results: [],
    sourcesSearched: [],
    totalApiCalls: 0,
    errors: [],
  };

  const connections = await db.integrationConnection.findMany({
    where: { isEnabled: true },
  });

  const tasks = connections.map(async (conn) => {
    const resolved = resolveConnection({
      provider: conn.provider,
      mode: conn.mode as IntegrationMode,
      prodOnly: conn.prodOnly,
    });
    if (!resolved.shouldRun) return;

    const searcher = SOURCE_SEARCHERS[conn.provider];
    if (!searcher) return;

    report.sourcesSearched.push(searcher.name);
    const creds = await getCredentials(conn.provider);
    const config = mergeConfig(conn.configJson, creds);

    try {
      const results = await searcher.search(
        conn as unknown as ConnectionRow,
        resolved.effectiveMode,
        config,
        criteria,
      );
      report.results.push(...results);
      report.totalApiCalls++;
    } catch (err) {
      const msg = `${searcher.name}: ${err instanceof Error ? err.message : String(err)}`;
      report.errors.push(msg);
    }
  });

  await Promise.allSettled(tasks);

  await trackApiUsage({
    provider: "prospect-engine",
    action: "prospect",
    requestCount: report.totalApiCalls,
    meta: {
      criteria,
      sourcesSearched: report.sourcesSearched,
      resultsCount: report.results.length,
    },
  });

  report.status = report.errors.length > 0 && report.results.length === 0 ? "error" : "completed";
  report.completedAt = new Date().toISOString();

  return report;
}
