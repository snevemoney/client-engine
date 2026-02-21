/**
 * Upwork GraphQL adapter. Uses publicMarketplaceJobPostingsSearch (OAuth2).
 * Set UPWORK_ACCESS_TOKEN (and optionally UPWORK_TENANT_ID) for "Read marketplace Job Postings - Public".
 * Without credentials, returns [].
 */

import type { RawOpportunity, ResearchSourceAdapter } from "../types";

const UPWORK_GRAPHQL = "https://api.upwork.com/graphql";
const TOKEN = process.env.UPWORK_ACCESS_TOKEN;
const TENANT_ID = process.env.UPWORK_TENANT_ID;

interface PublicJobFilter {
  searchExpression_eq?: string;
  daysPosted_eq?: number;
}

async function upworkGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!TOKEN?.trim()) throw new Error("UPWORK_ACCESS_TOKEN is not set");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };
  if (TENANT_ID?.trim()) headers["X-Upwork-API-TenantId"] = TENANT_ID;

  const res = await fetch(UPWORK_GRAPHQL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Upwork API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new Error("Upwork API returned no data");
  return json.data as T;
}

const PUBLIC_JOBS_QUERY = `
query publicMarketplaceJobPostingsSearch($marketPlaceJobFilter: PublicMarketplaceJobPostingsSearchFilter!) {
  publicMarketplaceJobPostingsSearch(marketPlaceJobFilter: $marketPlaceJobFilter) {
    jobs {
      id
      ciphertext
      title
      description
      createdDateTime
    }
    paging {
      total
    }
  }
}
`;

function jobToRaw(job: { id: string; ciphertext?: string | null; title?: string | null; description?: string | null; createdDateTime?: string | null }): RawOpportunity {
  const slug = job.ciphertext || job.id;
  const sourceUrl = `https://www.upwork.com/jobs/~${slug}`;
  return {
    title: (job.title || "Upwork job").slice(0, 160),
    description: (job.description || "").slice(0, 5000),
    sourceUrl,
    contactPath: sourceUrl,
    tags: [],
    adapter: "upwork",
    confidence: 0.85,
  };
}

export const upworkAdapter: ResearchSourceAdapter = {
  name: "upwork",
  async discover(opts?: { limit?: number }) {
    if (!TOKEN?.trim()) return [];
    const limit = Math.min(opts?.limit ?? 20, 50);
    const filter: PublicJobFilter = { daysPosted_eq: 7 };
    if (process.env.UPWORK_SEARCH_QUERY?.trim()) {
      filter.searchExpression_eq = process.env.UPWORK_SEARCH_QUERY.trim();
    }
    const data = await upworkGraphQL<{
      publicMarketplaceJobPostingsSearch?: {
        jobs?: Array<{ id: string; ciphertext?: string | null; title?: string | null; description?: string | null; createdDateTime?: string | null }>;
      };
    }>(PUBLIC_JOBS_QUERY, { marketPlaceJobFilter: filter });
    const jobs = data.publicMarketplaceJobPostingsSearch?.jobs ?? [];
    return jobs.slice(0, limit).map(jobToRaw);
  },
};
