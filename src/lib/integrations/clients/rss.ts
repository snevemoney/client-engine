/**
 * RSS placeholder client.
 * OFF/MOCK/MANUAL/LIVE behavior. LIVE delegates to real feed fetch (used by signals).
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type RssItem = {
  id: string;
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
};

const MOCK_ITEMS: RssItem[] = [
  { id: "mock-1", title: "Mock: Hiring trends 2025", url: "https://example.com/m1", summary: "AI and automation", publishedAt: new Date().toISOString() },
  { id: "mock-2", title: "Mock: Budget planning for startups", url: "https://example.com/m2", summary: "Revenue tips", publishedAt: new Date().toISOString() },
  { id: "mock-3", title: "Mock: Marketing automation guide", url: "https://example.com/m3", summary: "Lead conversion", publishedAt: new Date().toISOString() },
];

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return `rss-${Math.abs(h).toString(36)}`;
}

function stripTagContent(s: string): string {
  const t = s.trim();
  if (t.startsWith("<![CDATA[") && t.endsWith("]]>")) {
    return t.slice(9, -3).trim();
  }
  return t;
}

function parseRssItems(xml: string): Omit<RssItem, "id">[] {
  const items: Omit<RssItem, "id">[] = [];
  const itemBlocks = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) ?? [];
  for (const block of itemBlocks) {
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const linkHrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
    const descMatch = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    const pubMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    const title = titleMatch ? stripTagContent(titleMatch[1]) : "";
    const link = linkMatch ? stripTagContent(linkMatch[1]) : linkHrefMatch?.[1] ?? "";
    if (!link) continue;
    const summary = descMatch ? stripTagContent(descMatch[1]) : undefined;
    let publishedAt: string | undefined;
    if (pubMatch) {
      const raw = stripTagContent(pubMatch[1]);
      try {
        const d = new Date(raw);
        publishedAt = isNaN(d.getTime()) ? raw : d.toISOString();
      } catch {
        publishedAt = raw;
      }
    }
    items.push({ title, url: link, summary: summary || undefined, publishedAt });
  }
  return items;
}

export async function fetchRssFeed(
  mode: IntegrationMode,
  config: Record<string, unknown>
): Promise<ProviderClientResult<RssItem[]>> {
  const feedUrl = typeof config.feedUrl === "string" ? config.feedUrl : null;

  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: MOCK_ITEMS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: paste RSS items or use Signal import" };
    case "live": {
      const feedUrls: string[] = Array.isArray(config.feedUrls)
        ? config.feedUrls.filter((u): u is string => typeof u === "string")
        : feedUrl
          ? [feedUrl]
          : typeof config.baseUrl === "string"
            ? [config.baseUrl]
            : [];
      if (feedUrls.length === 0) {
        return { ok: false, data: null, message: "LIVE: feedUrl, baseUrl, or feedUrls required in config" };
      }
      const allItems: RssItem[] = [];
      const errors: string[] = [];
      for (const url of feedUrls) {
        try {
          const res = await trackedFetch("rss", "fetch", url);
          if (!res.ok) {
            errors.push(`${url}: HTTP ${res.status}`);
            continue;
          }
          const xml = await res.text();
          const items = parseRssItems(xml);
          for (const item of items) {
            allItems.push({
              ...item,
              id: hashUrl(item.url),
            });
          }
        } catch (err) {
          errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      const message =
        errors.length > 0
          ? `Fetched ${allItems.length} items; ${errors.length} feed(s) failed: ${errors.join("; ")}`
          : undefined;
      return { ok: true, data: allItems, message };
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
