/**
 * Prospect search engine with smart source routing.
 *
 * Instead of blindly querying every enabled connection, the engine:
 * 1. Filters to only providers tagged with purpose "prospecting"
 * 2. Scores each source's relevance to the search criteria
 * 3. Queries only the relevant ones, passing tailored params
 * 4. Returns results ranked by confidence
 */
import { db } from "@/lib/db";
import { getCredentials } from "@/lib/integrations/credentials";
import { resolveConnection } from "@/lib/integrations/resolver";
import { getProspectingProviders } from "@/lib/integrations/providerRegistry";
import type { IntegrationMode, ProspectingCapability } from "@/lib/integrations/providerRegistry";
import { trackApiUsage } from "@/lib/integrations/usage";

import { searchGooglePlaces } from "@/lib/integrations/clients/google-places";
import { searchSerpApi } from "@/lib/integrations/clients/serpapi";
import { searchApolloPeople, searchApolloCompanies } from "@/lib/integrations/clients/apollo";
import { searchHunterDomain } from "@/lib/integrations/clients/hunter";
import { searchYelpBusinesses } from "@/lib/integrations/clients/yelp";
import { searchYouTubeChannels } from "@/lib/integrations/clients/youtube-search";
import { fetchUpworkJobs } from "@/lib/integrations/clients/upwork";
import { searchLinkedInCompanies } from "@/lib/integrations/clients/linkedin";

import type { ProspectCriteria, ProspectResult, ProspectRunReport } from "./types";

// ── Helpers ──

function makeId(): string {
  return `pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSearchQuery(criteria: ProspectCriteria): string {
  const parts: string[] = [];
  if (criteria.clientType) parts.push(criteria.clientType);
  if (criteria.industry) parts.push(criteria.industry);
  if (criteria.keywords?.length) parts.push(...criteria.keywords);
  return parts.join(" ");
}

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

// ── Source relevance scoring ──

function scoreSourceRelevance(
  capability: ProspectingCapability,
  criteria: ProspectCriteria,
): number {
  let score = 0;
  const criteriaTerms = [
    criteria.clientType,
    criteria.industry,
    ...(criteria.keywords ?? []),
  ]
    .filter(Boolean)
    .map((t) => t!.toLowerCase());

  // "any" in bestFor means this source is universally useful
  if (capability.bestFor.includes("any")) {
    score += 0.5;
  }

  // Check how many criteria terms match bestFor keywords
  for (const term of criteriaTerms) {
    for (const bestFor of capability.bestFor) {
      if (
        bestFor.toLowerCase().includes(term) ||
        term.includes(bestFor.toLowerCase())
      ) {
        score += 1;
        break;
      }
    }
  }

  // Boost location-aware sources when location is provided
  if (criteria.location && capability.locationAware) {
    score += 0.5;
  }

  return score;
}

// ── Source searchers (only prospecting-capable providers) ──

type SourceSearcher = {
  name: string;
  search: (
    mode: IntegrationMode,
    config: Record<string, unknown>,
    criteria: ProspectCriteria,
  ) => Promise<ProspectResult[]>;
};

const SOURCE_SEARCHERS: Record<string, SourceSearcher> = {
  google_places: {
    name: "Google Places",
    async search(mode, config, criteria) {
      const query = criteria.clientType;
      const result = await searchGooglePlaces(mode, config, query, criteria.location);
      if (!result.ok || !result.data) return [];
      return result.data.map((p): ProspectResult => ({
        id: makeId(),
        source: "google_places",
        title: p.name,
        description: [p.address, p.rating ? `${p.rating}★ (${p.totalRatings ?? 0} reviews)` : null].filter(Boolean).join(" — "),
        url: p.website || p.mapsUrl,
        contactPath: p.phone,
        tags: [
          ...p.types.slice(0, 3),
          ...(p.website ? [] : ["no-website"]),
        ],
        confidence: p.website ? 0.7 : 0.85,
        meta: { rating: p.rating, totalRatings: p.totalRatings, website: p.website, phone: p.phone },
      }));
    },
  },

  serpapi: {
    name: "Web Search",
    async search(mode, config, criteria) {
      const query = `${criteria.clientType}${criteria.industry ? ` ${criteria.industry}` : ""}${criteria.location ? ` ${criteria.location}` : ""}`;
      const result = await searchSerpApi(mode, config, query, criteria.location);
      if (!result.ok || !result.data) return [];
      return result.data.map((r): ProspectResult => ({
        id: makeId(),
        source: "serpapi",
        title: r.title,
        description: r.snippet,
        url: r.link,
        tags: [`domain:${r.domain}`],
        confidence: r.position <= 3 ? 0.75 : r.position <= 10 ? 0.6 : 0.45,
        meta: { position: r.position, domain: r.domain },
      }));
    },
  },

  apollo: {
    name: "Apollo.io",
    async search(mode, config, criteria) {
      const query = buildSearchQuery(criteria);
      const results: ProspectResult[] = [];

      const [peopleRes, companiesRes] = await Promise.allSettled([
        searchApolloPeople(mode, config, query, criteria.location),
        searchApolloCompanies(mode, config, query, criteria.location),
      ]);

      if (peopleRes.status === "fulfilled" && peopleRes.value.ok && peopleRes.value.data) {
        for (const p of peopleRes.value.data) {
          results.push({
            id: makeId(),
            source: "apollo",
            title: p.name,
            description: [p.title, p.company, [p.city, p.state, p.country].filter(Boolean).join(", ")].filter(Boolean).join(" — "),
            url: p.linkedinUrl,
            contactPath: p.email,
            tags: [
              ...(p.title ? [`title:${p.title}`] : []),
              ...(p.company ? [`company:${p.company}`] : []),
            ],
            confidence: p.email ? 0.85 : 0.65,
            meta: { email: p.email, company: p.company, companyDomain: p.companyDomain },
          });
        }
      }

      if (companiesRes.status === "fulfilled" && companiesRes.value.ok && companiesRes.value.data) {
        for (const c of companiesRes.value.data) {
          results.push({
            id: makeId(),
            source: "apollo",
            title: c.name,
            description: [c.industry, c.domain, c.employeeCount ? `~${c.employeeCount} employees` : null, [c.city, c.country].filter(Boolean).join(", ")].filter(Boolean).join(" — "),
            url: c.website || c.linkedinUrl,
            tags: [
              ...(c.industry ? [`industry:${c.industry}`] : []),
              ...(c.employeeCount ? [`size:${c.employeeCount}`] : []),
            ],
            confidence: 0.7,
            meta: { domain: c.domain, employeeCount: c.employeeCount },
          });
        }
      }

      return results;
    },
  },

  hunter: {
    name: "Hunter.io",
    async search(mode, config, criteria) {
      // Hunter works best as enrichment — needs a domain to search.
      // We use baseUrl from config if set, or skip entirely.
      const domain = typeof config.baseUrl === "string" ? config.baseUrl : null;
      if (!domain) return [];

      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const result = await searchHunterDomain(mode, config, cleanDomain);
      if (!result.ok || !result.data) return [];

      return result.data.emails.map((e): ProspectResult => ({
        id: makeId(),
        source: "hunter",
        title: [e.firstName, e.lastName].filter(Boolean).join(" ") || e.email,
        description: [e.position, e.department, result.data!.organization].filter(Boolean).join(" — "),
        contactPath: e.email,
        url: e.linkedinUrl,
        tags: [`confidence:${e.confidence}%`],
        confidence: e.confidence / 100,
        meta: { email: e.email, organization: result.data!.organization },
      }));
    },
  },

  yelp: {
    name: "Yelp",
    async search(mode, config, criteria) {
      const query = criteria.clientType;
      const result = await searchYelpBusinesses(mode, config, query, criteria.location);
      if (!result.ok || !result.data) return [];
      return result.data
        .filter((b) => !b.isClosed)
        .map((b): ProspectResult => ({
          id: makeId(),
          source: "yelp",
          title: b.name,
          description: [
            b.categories.join(", "),
            `${b.rating}★ (${b.reviewCount} reviews)`,
            [b.address, b.city, b.state].filter(Boolean).join(", "),
          ].filter(Boolean).join(" — "),
          url: b.url,
          contactPath: b.phone,
          tags: b.categories.map((c) => `category:${c}`),
          confidence: b.reviewCount > 10 ? 0.75 : 0.6,
          meta: { rating: b.rating, reviewCount: b.reviewCount, phone: b.phone, city: b.city },
        }));
    },
  },

  youtube: {
    name: "YouTube",
    async search(mode, config, criteria) {
      const query = `${criteria.clientType}${criteria.industry ? ` ${criteria.industry}` : ""}`;
      const result = await searchYouTubeChannels(mode, config, query);
      if (!result.ok || !result.data) return [];
      return result.data.map((ch): ProspectResult => ({
        id: makeId(),
        source: "youtube",
        title: ch.title,
        description: [
          ch.description.slice(0, 120),
          ch.subscriberCount ? `${(ch.subscriberCount / 1000).toFixed(1)}k subs` : null,
          ch.videoCount ? `${ch.videoCount} videos` : null,
        ].filter(Boolean).join(" — "),
        url: ch.channelUrl,
        tags: [
          ...(ch.subscriberCount ? [`subs:${ch.subscriberCount}`] : []),
        ],
        confidence: ch.subscriberCount && ch.subscriberCount > 1000 ? 0.7 : 0.5,
        meta: { subscriberCount: ch.subscriberCount, videoCount: ch.videoCount },
      }));
    },
  },

  upwork: {
    name: "Upwork",
    async search(mode, config, criteria) {
      const result = await fetchUpworkJobs(mode, config);
      if (!result.ok || !result.data) return [];
      const query = buildSearchQuery(criteria).toLowerCase();
      const terms = query.split(/\s+/).filter(Boolean);
      return result.data
        .filter((job) => {
          const text = `${job.title} ${job.description ?? ""}`.toLowerCase();
          return terms.some((t) => text.includes(t));
        })
        .map((job): ProspectResult => ({
          id: makeId(),
          source: "upwork",
          title: job.title,
          description: job.description ?? job.title,
          tags: job.budget ? [`budget:${job.budget}`] : [],
          confidence: 0.75,
          meta: { postedAt: job.postedAt, budget: job.budget },
        }));
    },
  },

  linkedin: {
    name: "LinkedIn",
    async search(mode, config, criteria) {
      const query = buildSearchQuery(criteria);
      const result = await searchLinkedInCompanies(mode, config, query);
      if (!result.ok || !result.data) return [];
      return result.data.map((c): ProspectResult => ({
        id: makeId(),
        source: "linkedin",
        title: c.name,
        description: [c.description, c.industry, c.staffCount ? `~${c.staffCount} staff` : null].filter(Boolean).join(" — "),
        url: c.vanityName ? `https://linkedin.com/company/${c.vanityName}` : undefined,
        tags: c.industry ? [`industry:${c.industry}`] : [],
        confidence: 0.7,
        meta: { staffCount: c.staffCount },
      }));
    },
  },
};

// ── Types for the routing report ──

export type SourceSelection = {
  provider: string;
  displayName: string;
  relevanceScore: number;
  reason: string;
  selected: boolean;
};

// ── Main search function ──

export async function runProspectSearch(criteria: ProspectCriteria): Promise<ProspectRunReport> {
  const report: ProspectRunReport = {
    id: makeId(),
    criteria,
    startedAt: new Date().toISOString(),
    status: "running",
    results: [],
    sourcesSearched: [],
    sourceSelections: [],
    totalApiCalls: 0,
    errors: [],
  };

  // 1. Get all prospecting-capable provider definitions
  const prospectingProviders = getProspectingProviders();

  // 2. Get all enabled connections from DB
  const connections = await db.integrationConnection.findMany({
    where: { isEnabled: true },
  });
  const connectionMap = new Map(connections.map((c) => [c.provider, c]));

  // 3. Score and select sources
  const selections: SourceSelection[] = [];
  for (const providerDef of prospectingProviders) {
    const capability = providerDef.prospecting!;
    const score = scoreSourceRelevance(capability, criteria);
    const conn = connectionMap.get(providerDef.provider);

    let reason: string;
    let selected = false;

    if (!conn) {
      reason = "Not configured — set up in Settings > Connections";
    } else if (score === 0) {
      reason = `Low relevance — best for: ${capability.bestFor.slice(0, 4).join(", ")}`;
    } else {
      const resolved = resolveConnection({
        provider: conn.provider,
        mode: conn.mode as IntegrationMode,
        prodOnly: conn.prodOnly,
      });
      if (!resolved.shouldRun) {
        reason = `Mode is ${conn.mode} — won't run`;
      } else if (!SOURCE_SEARCHERS[providerDef.provider]) {
        reason = "No search client available";
      } else {
        reason = `Matched: ${capability.finds}`;
        selected = true;
      }
    }

    selections.push({
      provider: providerDef.provider,
      displayName: providerDef.displayName,
      relevanceScore: score,
      reason,
      selected,
    });
  }

  // Sort by relevance, selected first
  selections.sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    return b.relevanceScore - a.relevanceScore;
  });

  report.sourceSelections = selections;

  // 4. Execute searches on selected sources
  const selectedSources = selections.filter((s) => s.selected);

  const tasks = selectedSources.map(async (sel) => {
    const conn = connectionMap.get(sel.provider)!;
    const resolved = resolveConnection({
      provider: conn.provider,
      mode: conn.mode as IntegrationMode,
      prodOnly: conn.prodOnly,
    });
    const creds = await getCredentials(conn.provider);
    const config = mergeConfig(conn.configJson, creds);
    const searcher = SOURCE_SEARCHERS[sel.provider]!;

    report.sourcesSearched.push(sel.displayName);

    try {
      const results = await searcher.search(resolved.effectiveMode, config, criteria);
      report.results.push(...results);
      report.totalApiCalls++;
    } catch (err) {
      const msg = `${sel.displayName}: ${err instanceof Error ? err.message : String(err)}`;
      report.errors.push(msg);
    }
  });

  await Promise.allSettled(tasks);

  // 5. Sort results by confidence (highest first)
  report.results.sort((a, b) => b.confidence - a.confidence);

  // 6. Log usage
  await trackApiUsage({
    provider: "prospect-engine",
    action: "prospect",
    requestCount: report.totalApiCalls,
    meta: {
      criteria,
      sourcesSearched: report.sourcesSearched,
      sourceSelections: selections.map((s) => ({ provider: s.provider, score: s.relevanceScore, selected: s.selected })),
      resultsCount: report.results.length,
    },
  });

  report.status = report.errors.length > 0 && report.results.length === 0 ? "error" : "completed";
  report.completedAt = new Date().toISOString();

  return report;
}
