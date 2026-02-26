/**
 * SerpAPI client — programmatic Google search.
 * Finds businesses, people, and websites via Google search results.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type SerpResult = {
  position: number;
  title: string;
  link: string;
  snippet: string;
  domain: string;
};

const MOCK_RESULTS: SerpResult[] = [
  { position: 1, title: "Mock: Top Life Coaches in NYC", link: "https://example.com/coaches", snippet: "Find the best life coaches near you...", domain: "example.com" },
  { position: 2, title: "Mock: Business Coaching Services", link: "https://example.com/business", snippet: "Transform your business with expert coaching...", domain: "example.com" },
  { position: 3, title: "Mock: Wellness Coach Directory", link: "https://example.com/wellness", snippet: "Browse certified wellness coaches in your area...", domain: "example.com" },
];

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function searchSerpApi(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  query: string,
  location?: string,
): Promise<ProviderClientResult<SerpResult[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF" };
    case "mock":
      return { ok: true, data: MOCK_RESULTS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: not supported for SerpAPI" };
    case "live": {
      const apiKey = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!apiKey) {
        return { ok: false, data: null, message: "SerpAPI key required. Get one at serpapi.com" };
      }

      const params = new URLSearchParams({
        q: query,
        api_key: apiKey,
        engine: "google",
        num: "20",
      });
      if (location) params.set("location", location);

      const url = `https://serpapi.com/search.json?${params}`;

      try {
        const res = await trackedFetch("serpapi", "search", url);
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, data: null, message: `SerpAPI error: HTTP ${res.status} — ${text.slice(0, 200)}` };
        }
        const json = await res.json() as {
          organic_results?: Array<{
            position: number;
            title: string;
            link: string;
            snippet: string;
          }>;
          error?: string;
        };

        if (json.error) {
          return { ok: false, data: null, message: `SerpAPI: ${json.error}` };
        }

        const results: SerpResult[] = (json.organic_results ?? []).map((r) => ({
          position: r.position,
          title: r.title,
          link: r.link,
          snippet: r.snippet,
          domain: extractDomain(r.link),
        }));

        return { ok: true, data: results };
      } catch (err) {
        return { ok: false, data: null, message: err instanceof Error ? err.message : String(err) };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
