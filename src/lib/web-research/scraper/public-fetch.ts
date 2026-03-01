import * as cheerio from "cheerio";
import type { ScrapedPage } from "../types";

const TIMEOUT_MS = 10_000;
const MAX_CONTENT_LENGTH = 5_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const REMOVE_SELECTORS = [
  "script",
  "style",
  "nav",
  "footer",
  "header",
  "aside",
  "noscript",
  "iframe",
  "[role='banner']",
  "[role='navigation']",
  "[role='complementary']",
  ".sidebar",
  ".nav",
  ".footer",
  ".header",
  ".ad",
  ".advertisement",
  ".cookie-banner",
  ".popup",
].join(", ");

/**
 * Extract main text from HTML using cheerio.
 * Strips nav, footer, script, style, ads.
 */
export function extractMainContent(html: string): { title: string; content: string } {
  const $ = cheerio.load(html);

  // Extract title
  const title =
    $("title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    "";

  // Remove noise elements
  $(REMOVE_SELECTORS).remove();

  // Try main content areas first, fall back to body
  const mainContent =
    $("article").text().trim() ||
    $("main").text().trim() ||
    $("[role='main']").text().trim() ||
    $("body").text().trim() ||
    "";

  // Collapse whitespace
  const content = mainContent.replace(/\s+/g, " ").trim().slice(0, MAX_CONTENT_LENGTH);

  return { title: title.slice(0, 200), content };
}

/**
 * Scrape a single URL using fetch + cheerio.
 * Returns null on any failure (timeout, non-200, parse error).
 */
export async function publicFetchScrape(url: string): Promise<ScrapedPage | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    const html = await res.text();
    const { title, content } = extractMainContent(html);

    if (!content || content.length < 50) return null;

    const domain = new URL(url).hostname.replace(/^www\./, "");

    return {
      url,
      title: title || domain,
      content,
      domain,
      scrapedVia: "public-fetch",
      scrapedAt: new Date().toISOString(),
      httpStatus: res.status,
    };
  } catch {
    return null;
  }
}
