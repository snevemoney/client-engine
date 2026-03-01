import * as cheerio from "cheerio";
import type { SearchResult } from "../types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * Search the web for a query and return ranked URLs.
 * Strategy:
 *   1. Google Custom Search API (if GOOGLE_CSE_KEY + GOOGLE_CSE_CX set)
 *   2. Brave Search HTML scrape
 *   3. DuckDuckGo HTML scrape fallback
 */
export async function searchWeb(
  query: string,
  opts?: { limit?: number },
): Promise<SearchResult[]> {
  const limit = Math.min(opts?.limit ?? 8, 15);

  const cseKey = process.env.GOOGLE_CSE_KEY;
  const cseCx = process.env.GOOGLE_CSE_CX;

  if (cseKey && cseCx) {
    try {
      const results = await googleCustomSearch(query, limit, cseKey, cseCx);
      if (results.length > 0) return results;
    } catch {
      // Fall through
    }
  }

  // Brave Search (primary free search)
  try {
    const results = await braveSearch(query, limit);
    if (results.length > 0) return results;
  } catch {
    // Fall through to DDG
  }

  return duckDuckGoSearch(query, limit);
}

async function googleCustomSearch(
  query: string,
  limit: number,
  key: string,
  cx: string,
): Promise<SearchResult[]> {
  const num = Math.min(limit, 10); // Google CSE max per request
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=${num}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];

  const data = await res.json();
  const items = (data.items as Array<Record<string, string>>) ?? [];

  return items.map((item, i) => ({
    url: item.link ?? "",
    title: item.title ?? "",
    snippet: item.snippet ?? "",
    rank: i,
  }));
}

async function braveSearch(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return [];

  const html = await res.text();
  if (html.includes("captcha") || html.includes("challenge")) return [];

  const $ = cheerio.load(html);
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  $("[data-type=web]").each((i, el) => {
    if (results.length >= limit) return false;

    const urlEl = $(el).find('a[href^="http"]').first();
    const href = urlEl.attr("href") ?? "";
    if (!href || !href.startsWith("http") || seen.has(href)) return;
    seen.add(href);

    const titleEl = $(el).find(".title").first();
    const title = titleEl.text().trim() || urlEl.text().trim();

    const snippetEl = $(el).find(".generic-snippet .content").first();
    const snippet = snippetEl.text().trim();

    results.push({ url: href, title, snippet, rank: results.length });
  });

  return results;
}

async function duckDuckGoSearch(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `q=${encodeURIComponent(query)}`,
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    const seen = new Set<string>();

    $(".result:not(.result--ad)").each((i, el) => {
      if (results.length >= limit) return false;

      const linkEl = $(el).find(".result__a");
      const snippetEl = $(el).find(".result__snippet");

      let href = linkEl.attr("href") ?? "";
      // DuckDuckGo wraps URLs — extract the real one
      const uddgMatch = href.match(/[?&]uddg=([^&]+)/);
      if (uddgMatch) {
        href = decodeURIComponent(uddgMatch[1]);
      }

      if (!href || !href.startsWith("http") || seen.has(href)) return;
      seen.add(href);

      results.push({
        url: href,
        title: linkEl.text().trim(),
        snippet: snippetEl.text().trim(),
        rank: i,
      });
    });

    return results;
  } catch {
    return [];
  }
}
