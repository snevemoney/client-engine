/**
 * Firecrawl web scraping client.
 * All functions return null/[] when FIRECRAWL_API_KEY is unset or FIRECRAWL_ENABLED !== "1".
 */

import { trackedFetch } from "@/lib/integrations/usage";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

export function isFirecrawlEnabled(): boolean {
  return !!(FIRECRAWL_API_KEY && process.env.FIRECRAWL_ENABLED === "1");
}

export type ScrapeResult = {
  markdown: string;
  metadata?: {
    title?: string;
    description?: string;
    sourceUrl?: string;
  };
};

/**
 * Scrape a single URL and return markdown content.
 * Returns null on failure (graceful degradation).
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult | null> {
  if (!isFirecrawlEnabled()) return null;
  try {
    const res = await trackedFetch("firecrawl", "scrape", `${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 15000,
      }),
    });
    if (!res.ok) {
      console.warn(`[firecrawl] Scrape failed for ${url}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data.success) return null;
    return {
      markdown: ((data.data?.markdown as string) ?? "").slice(0, 15000),
      metadata: {
        title: data.data?.metadata?.title as string | undefined,
        description: data.data?.metadata?.description as string | undefined,
        sourceUrl: url,
      },
    };
  } catch (err) {
    console.error("[firecrawl] scrape error:", err);
    return null;
  }
}

/**
 * Search the web for a query and return results.
 * Returns empty array on failure.
 */
export async function searchWeb(
  query: string,
  opts?: { limit?: number },
): Promise<Array<{ url: string; title: string; description: string; markdown?: string }>> {
  if (!isFirecrawlEnabled()) return [];
  const limit = opts?.limit ?? 5;
  try {
    const res = await trackedFetch("firecrawl", "search", `${FIRECRAWL_BASE}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.data as Array<Record<string, unknown>>) ?? []).map((r) => ({
      url: (r.url as string) ?? "",
      title: (r.title as string) ?? "",
      description: (r.description as string) ?? "",
      markdown: typeof r.markdown === "string" ? r.markdown.slice(0, 10000) : undefined,
    }));
  } catch {
    return [];
  }
}
