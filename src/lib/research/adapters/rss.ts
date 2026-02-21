/**
 * RSS/Atom feed adapter. Fetches a single feed URL from env (RESEARCH_FEED_URL).
 * Safe for ToS: many job boards and sites offer official RSS/Atom feeds.
 * Uses regex extraction so it runs in Node (no DOMParser).
 */
import type { RawOpportunity, ResearchSourceAdapter } from "../types";

const FEED_URL = process.env.RESEARCH_FEED_URL;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  return stripHtml(m[1]).trim();
}

function extractLinkFromEntry(entryXml: string): string {
  const hrefRe = /<link[^>]+href=["']([^"']+)["']/i;
  const m = entryXml.match(hrefRe);
  if (m) return m[1].trim();
  const linkRe = /<link[^>]*>([^<]+)<\/link>/i;
  const m2 = entryXml.match(linkRe);
  return m2 ? m2[1].trim() : "";
}

function parseRssItems(xml: string, limit: number): RawOpportunity[] {
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const out: RawOpportunity[] = [];
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null && out.length < limit) {
    const block = match[1];
    const title = extractTag(block, "title").slice(0, 160) || "Untitled";
    const link = extractTag(block, "link") || "";
    const description =
      extractTag(block, "description") || extractTag(block, "content") || title;
    if (!link) continue;
    out.push({
      title,
      description: description.slice(0, 5000),
      sourceUrl: link,
      contactPath: link,
      tags: [],
      adapter: "rss",
      confidence: 0.8,
    });
  }
  return out;
}

function parseAtomEntries(xml: string, limit: number): RawOpportunity[] {
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  const out: RawOpportunity[] = [];
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(xml)) !== null && out.length < limit) {
    const block = match[1];
    const title = extractTag(block, "title").slice(0, 160) || "Untitled";
    const link = extractLinkFromEntry(block);
    const description =
      extractTag(block, "content") || extractTag(block, "summary") || title;
    if (!link) continue;
    out.push({
      title,
      description: description.slice(0, 5000),
      sourceUrl: link,
      contactPath: link,
      tags: [],
      adapter: "rss",
      confidence: 0.8,
    });
  }
  return out;
}

export const rssAdapter: ResearchSourceAdapter = {
  name: "rss",
  async discover(opts?: { limit?: number }) {
    if (!FEED_URL?.trim()) return [];
    const limit = opts?.limit ?? 20;
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "ClientEngine-Research/1.0 (RSS reader)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
    const xml = await res.text();
    const isAtom = /<feed[\s>]/.test(xml);
    const items = isAtom ? parseAtomEntries(xml, limit) : parseRssItems(xml, limit);
    return items;
  },
};
