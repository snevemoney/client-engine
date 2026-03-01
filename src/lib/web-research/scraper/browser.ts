import { chromium } from "playwright";
import type { ScrapedPage } from "../types";
import { extractMainContent } from "./public-fetch";
import { resolve } from "path";
import { existsSync } from "fs";

const BROWSER_DOMAINS = new Set([
  "linkedin.com",
  "www.linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "www.facebook.com",
  "instagram.com",
  "www.instagram.com",
  "upwork.com",
  "www.upwork.com",
  "medium.com",
  "glassdoor.com",
  "www.glassdoor.com",
]);

/** Check whether a URL should attempt browser scraping. */
export function shouldUseBrowser(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return BROWSER_DOMAINS.has(hostname);
  } catch {
    return false;
  }
}

function getProfilePath(): string | null {
  if (process.env.CHROME_PROFILE_PATH) {
    const p = process.env.CHROME_PROFILE_PATH;
    return existsSync(p) ? p : null;
  }

  // Auto-detect by platform
  const home = process.env.HOME ?? "";
  const candidates =
    process.platform === "darwin"
      ? [resolve(home, "Library/Application Support/Google/Chrome/Default")]
      : [
          resolve(home, ".config/google-chrome/Default"),
          resolve(home, ".config/chromium/Default"),
        ];

  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Random delay between actions to appear human-like. */
async function humanDelay(minMs = 2000, maxMs = 5000): Promise<void> {
  const ms = Math.random() * (maxMs - minMs) + minMs;
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Scrape a URL using Playwright with the user's Chrome profile.
 * Returns null if Chrome profile unavailable or scraping fails.
 */
export async function browserScrape(url: string): Promise<ScrapedPage | null> {
  const profilePath = getProfilePath();
  if (!profilePath) {
    console.warn("[web-research/browser] No Chrome profile found, skipping browser scrape");
    return null;
  }

  let context;
  try {
    await humanDelay(1000, 2500);

    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
    ];
    const viewport = viewports[Math.floor(Math.random() * viewports.length)];

    context = await chromium.launchPersistentContext(profilePath, {
      headless: true,
      viewport,
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });

    await humanDelay();

    const html = await page.content();
    const { title, content } = extractMainContent(html);

    if (!content || content.length < 50) return null;

    const domain = new URL(url).hostname.replace(/^www\./, "");

    return {
      url,
      title: title || domain,
      content,
      domain,
      scrapedVia: "browser",
      scrapedAt: new Date().toISOString(),
      httpStatus: null,
    };
  } catch (err) {
    console.warn("[web-research/browser] Scrape failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    try {
      await context?.close();
    } catch {
      // Ignore cleanup errors
    }
  }
}
