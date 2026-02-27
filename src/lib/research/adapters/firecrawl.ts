import { isFirecrawlEnabled, searchWeb } from "@/lib/firecrawl";
import type { RawOpportunity, ResearchSourceAdapter } from "../types";

const SEARCH_QUERY = process.env.FIRECRAWL_RESEARCH_QUERY;

export const firecrawlAdapter: ResearchSourceAdapter = {
  name: "firecrawl",
  async discover(opts?: { limit?: number }) {
    if (!isFirecrawlEnabled() || !SEARCH_QUERY?.trim()) return [];
    const limit = opts?.limit ?? 5;
    const results = await searchWeb(SEARCH_QUERY, { limit });
    return results
      .filter((r) => r.url)
      .map(
        (r): RawOpportunity => ({
          title: (r.title || "Web result").slice(0, 160),
          description: (r.markdown || r.description || r.title || "").slice(0, 5000),
          sourceUrl: r.url,
          contactPath: r.url,
          tags: ["firecrawl"],
          adapter: "firecrawl",
          confidence: 0.6,
        }),
      );
  },
};
