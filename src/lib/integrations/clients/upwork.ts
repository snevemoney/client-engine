/**
 * Upwork placeholder client.
 * OFF/MOCK/MANUAL/LIVE behavior. LIVE uses RSS feeds (Upwork provides RSS for saved searches).
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type UpworkJob = {
  id: string;
  title: string;
  postedAt: string;
  budget?: string;
  description?: string;
};

const MOCK_JOBS: UpworkJob[] = [
  { id: "mock-1", title: "Mock: Marketing automation setup", postedAt: new Date().toISOString(), budget: "$500–1k" },
  { id: "mock-2", title: "Mock: CRM integration consultant", postedAt: new Date().toISOString(), budget: "$1k–5k" },
  { id: "mock-3", title: "Mock: Sales ops audit", postedAt: new Date().toISOString(), budget: "$2k–10k" },
];

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return `upwork-${Math.abs(h).toString(36)}`;
}

function stripTagContent(s: string): string {
  const t = s.trim();
  if (t.startsWith("<![CDATA[") && t.endsWith("]]>")) {
    return t.slice(9, -3).trim();
  }
  return t;
}

function parseUpworkRssItems(xml: string): UpworkJob[] {
  const jobs: UpworkJob[] = [];
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
    const description = descMatch ? stripTagContent(descMatch[1]) : undefined;
    let postedAt = new Date().toISOString();
    if (pubMatch) {
      const raw = stripTagContent(pubMatch[1]);
      try {
        const d = new Date(raw);
        postedAt = isNaN(d.getTime()) ? raw : d.toISOString();
      } catch {
        postedAt = raw;
      }
    }
    jobs.push({
      id: hashUrl(link),
      title,
      postedAt,
      description,
    });
  }
  return jobs;
}

export async function fetchUpworkJobs(
  mode: IntegrationMode,
  config: Record<string, unknown>
): Promise<ProviderClientResult<UpworkJob[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: MOCK_JOBS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: paste jobs from Upwork dashboard" };
    case "live": {
      const feedUrl =
        typeof config.feedUrl === "string"
          ? config.feedUrl
          : typeof config.baseUrl === "string"
            ? config.baseUrl
            : null;
      if (!feedUrl) {
        return {
          ok: false,
          data: null,
          message: "Configure an Upwork RSS feed URL for live job discovery",
        };
      }
      try {
        const res = await trackedFetch("upwork", "fetch", feedUrl);
        if (!res.ok) {
          return {
            ok: false,
            data: null,
            message: `Failed to fetch feed: HTTP ${res.status}`,
          };
        }
        const xml = await res.text();
        const jobs = parseUpworkRssItems(xml);
        return { ok: true, data: jobs };
      } catch (err) {
        return {
          ok: false,
          data: null,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
