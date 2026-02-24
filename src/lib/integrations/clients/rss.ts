/**
 * RSS placeholder client.
 * OFF/MOCK/MANUAL/LIVE behavior. LIVE delegates to real feed fetch (used by signals).
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";

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
    case "live":
      if (!feedUrl) {
        return { ok: false, data: null, message: "LIVE: feedUrl required in config" };
      }
      // Real fetch is handled by src/lib/signals/rss-sync.ts
      // This client is a thin facade for standalone use
      return { ok: true, data: [], message: "LIVE: use SignalSource + rss-sync for feed sync" };
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
