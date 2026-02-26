/**
 * Bridge between the research engine adapter pattern and IntegrationConnection.
 * Creates ResearchSourceAdapter instances from active DB connections.
 *
 * Only includes connections whose provider serves monitoring, crm, or research.
 */
import { db } from "@/lib/db";
import { resolveConnection } from "@/lib/integrations/resolver";
import { getCredentials } from "@/lib/integrations/credentials";
import { filterProvidersByPurpose } from "@/lib/integrations/purpose-context";
import { fetchRssFeed } from "@/lib/integrations/clients/rss";
import { fetchUpworkJobs } from "@/lib/integrations/clients/upwork";
import { fetchHubSpotContacts } from "@/lib/integrations/clients/hubspot";
import { searchGithubUsers } from "@/lib/integrations/clients/github";
import type { RawOpportunity, ResearchSourceAdapter } from "../types";
import type { IntegrationMode, IntegrationPurpose } from "@/lib/integrations/providerRegistry";

const RESEARCH_PURPOSES: IntegrationPurpose[] = ["monitoring", "crm", "research"];

type DBConnection = {
  provider: string;
  mode: IntegrationMode;
  prodOnly: boolean;
  configJson: unknown;
};

function mergeCredentials(
  config: Record<string, unknown>,
  creds: { accessToken: string | null; accountId: string | null; baseUrl: string | null },
): Record<string, unknown> {
  return {
    ...config,
    accessToken: config.accessToken || creds.accessToken || undefined,
    accountId: config.accountId || creds.accountId || undefined,
    baseUrl: config.baseUrl || creds.baseUrl || undefined,
  };
}

function rssConnectionAdapter(conn: DBConnection): ResearchSourceAdapter {
  return {
    name: `rss-connection`,
    async discover(opts) {
      const limit = opts?.limit ?? 20;
      const resolved = resolveConnection(conn);
      if (!resolved.shouldRun) return [];
      const creds = await getCredentials(conn.provider);
      const config = mergeCredentials(
        (conn.configJson ?? {}) as Record<string, unknown>,
        creds,
      );
      const result = await fetchRssFeed(resolved.effectiveMode, config);
      if (!result.ok || !result.data) return [];
      return result.data.slice(0, limit).map((item): RawOpportunity => ({
        title: item.title.slice(0, 160),
        description: (item.summary || item.title).slice(0, 5000),
        sourceUrl: item.url,
        contactPath: item.url,
        tags: [],
        adapter: "rss-connection",
        confidence: 0.75,
      }));
    },
  };
}

function upworkConnectionAdapter(conn: DBConnection): ResearchSourceAdapter {
  return {
    name: `upwork-connection`,
    async discover(opts) {
      const limit = opts?.limit ?? 20;
      const resolved = resolveConnection(conn);
      if (!resolved.shouldRun) return [];
      const creds = await getCredentials(conn.provider);
      const config = mergeCredentials(
        (conn.configJson ?? {}) as Record<string, unknown>,
        creds,
      );
      const result = await fetchUpworkJobs(resolved.effectiveMode, config);
      if (!result.ok || !result.data) return [];
      return result.data.slice(0, limit).map((job): RawOpportunity => ({
        title: job.title.slice(0, 160),
        description: (job.description || job.title).slice(0, 5000),
        sourceUrl: job.id.startsWith("http") ? job.id : `https://upwork.com/jobs/${job.id}`,
        contactPath: null,
        tags: job.budget ? [`budget:${job.budget}`] : [],
        adapter: "upwork-connection",
        confidence: 0.8,
      }));
    },
  };
}

function hubspotConnectionAdapter(conn: DBConnection): ResearchSourceAdapter {
  return {
    name: `hubspot-connection`,
    async discover(opts) {
      const limit = opts?.limit ?? 20;
      const resolved = resolveConnection(conn);
      if (!resolved.shouldRun) return [];
      const creds = await getCredentials(conn.provider);
      const config = mergeCredentials(
        (conn.configJson ?? {}) as Record<string, unknown>,
        creds,
      );
      const result = await fetchHubSpotContacts(resolved.effectiveMode, config);
      if (!result.ok || !result.data) return [];
      return result.data.slice(0, limit).map((c): RawOpportunity => ({
        title: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "HubSpot contact",
        description: [c.company, c.email, c.website].filter(Boolean).join(" — "),
        sourceUrl: `https://app.hubspot.com/contacts/${c.id}`,
        contactPath: c.email || null,
        tags: c.company ? [`company:${c.company}`] : [],
        adapter: "hubspot-connection",
        confidence: 0.7,
      }));
    },
  };
}

function githubConnectionAdapter(conn: DBConnection): ResearchSourceAdapter {
  return {
    name: `github-connection`,
    async discover(opts) {
      const limit = opts?.limit ?? 20;
      const resolved = resolveConnection(conn);
      if (!resolved.shouldRun) return [];
      const creds = await getCredentials(conn.provider);
      const config = mergeCredentials(
        (conn.configJson ?? {}) as Record<string, unknown>,
        creds,
      );
      const searchQuery = typeof config.searchQuery === "string" ? config.searchQuery : null;
      if (!searchQuery) return [];
      const result = await searchGithubUsers(resolved.effectiveMode, config, searchQuery);
      if (!result.ok || !result.data) return [];
      return result.data.slice(0, limit).map((u): RawOpportunity => ({
        title: `${u.login} (${u.type})`,
        description: `GitHub ${u.type}: ${u.login}`,
        sourceUrl: u.html_url,
        contactPath: u.html_url,
        tags: [`type:${u.type}`],
        adapter: "github-connection",
        confidence: 0.6,
      }));
    },
  };
}

const ADAPTER_FACTORY: Record<string, (conn: DBConnection) => ResearchSourceAdapter> = {
  rss: rssConnectionAdapter,
  upwork: upworkConnectionAdapter,
  hubspot: hubspotConnectionAdapter,
  github: githubConnectionAdapter,
};

/**
 * Load active integration connections from the DB and return
 * ResearchSourceAdapter instances for those that:
 * - Have adapter support
 * - Serve monitoring, crm, or research purpose
 */
export async function getConnectionAdapters(): Promise<ResearchSourceAdapter[]> {
  const connections = await db.integrationConnection.findMany({
    where: { isEnabled: true, mode: { not: "off" } },
  });

  const allowed = filterProvidersByPurpose(
    connections.map((c) => c.provider),
    RESEARCH_PURPOSES,
  );

  const adapters: ResearchSourceAdapter[] = [];
  for (const conn of connections) {
    if (!allowed.includes(conn.provider)) continue;
    const factory = ADAPTER_FACTORY[conn.provider];
    if (factory) {
      adapters.push(
        factory({
          provider: conn.provider,
          mode: conn.mode as IntegrationMode,
          prodOnly: conn.prodOnly,
          configJson: conn.configJson,
        }),
      );
    }
  }
  return adapters;
}
