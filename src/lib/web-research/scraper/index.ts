import type { ScrapedPage, SearchResult } from "../types";
import { publicFetchScrape } from "./public-fetch";
import { browserScrape, shouldUseBrowser } from "./browser";
import { searchWeb } from "./search";

export { searchWeb } from "./search";

const MAX_BROWSER_SCRAPES = 3;

/** Random delay between scrapes to avoid rate limiting. */
async function scrapeCooldown(): Promise<void> {
  const ms = Math.random() * 500 + 500; // 500-1000ms
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Scrape a single URL with fallback: public fetch → browser.
 */
export async function scrapeUrl(
  url: string,
  opts?: { allowBrowser?: boolean },
): Promise<ScrapedPage | null> {
  // Try public fetch first
  const page = await publicFetchScrape(url);
  if (page) return page;

  // Fall back to browser if allowed and domain matches
  if (opts?.allowBrowser !== false && shouldUseBrowser(url)) {
    return browserScrape(url);
  }

  return null;
}

/**
 * Search for URLs relevant to a query, then scrape each.
 * Returns successfully scraped pages + the raw search results.
 */
export async function searchAndScrape(
  query: string,
  opts?: { maxSources?: number; additionalUrls?: string[] },
): Promise<{ pages: ScrapedPage[]; searchResults: SearchResult[] }> {
  const maxSources = opts?.maxSources ?? 8;
  const searchResults = await searchWeb(query, { limit: maxSources + 2 });

  // Combine search results with any additional URLs (e.g. targetUrl for competitive mode)
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const extra of opts?.additionalUrls ?? []) {
    if (extra && !seen.has(extra)) {
      seen.add(extra);
      urls.push(extra);
    }
  }
  for (const sr of searchResults) {
    if (sr.url && !seen.has(sr.url)) {
      seen.add(sr.url);
      urls.push(sr.url);
    }
  }

  const pages: ScrapedPage[] = [];
  let browserCount = 0;

  for (const url of urls) {
    if (pages.length >= maxSources) break;

    const allowBrowser = browserCount < MAX_BROWSER_SCRAPES;
    const page = await scrapeUrl(url, { allowBrowser });

    if (page) {
      if (page.scrapedVia === "browser") browserCount++;
      pages.push(page);
    }

    await scrapeCooldown();
  }

  // If search gave snippets for URLs we couldn't scrape, include as search-snippet pages
  for (const sr of searchResults) {
    if (pages.length >= maxSources) break;
    if (pages.some((p) => p.url === sr.url)) continue;
    if (!sr.snippet || sr.snippet.length < 20) continue;

    const domain = (() => {
      try {
        return new URL(sr.url).hostname.replace(/^www\./, "");
      } catch {
        return "unknown";
      }
    })();

    pages.push({
      url: sr.url,
      title: sr.title,
      content: sr.snippet,
      domain,
      scrapedVia: "search-snippet",
      scrapedAt: new Date().toISOString(),
    });
  }

  return { pages, searchResults };
}
