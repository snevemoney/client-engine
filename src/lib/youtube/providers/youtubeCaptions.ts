/**
 * Fallback 1: Direct YouTube captions extraction.
 * Fetches the watch page, parses captionTracks JSON, fetches timedtext XML.
 * No external API key needed — relies on public captions.
 */

import type { TranscriptProvider, ProviderResult, TranscriptSegment, VideoMeta } from "../types";
import { ytLog } from "../types";

const PROVIDER_NAME = "youtube-captions";

const FETCH_HEADERS: Record<string, string> = {
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://www.youtube.com",
  Referer: "https://www.youtube.com/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
};

function getCookieHeader(res: Response): string {
  const raw = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (raw?.length) return raw.map((c) => c.split(";")[0].trim()).join("; ");
  const single = res.headers.get("set-cookie");
  return single ? single.split(",").map((c) => c.split(";")[0].trim()).join("; ") : "";
}

function extractCaptionTracksArray(html: string): string | null {
  const key = '"captionTracks":';
  const idx = html.indexOf(key);
  if (idx === -1) return null;
  const arrayStart = html.indexOf("[", idx + key.length);
  if (arrayStart === -1) return null;
  let depth = 1;
  let inString = false;
  let escape = false;
  let quote: string | null = null;
  for (let i = arrayStart + 1; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (!inString) {
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") {
        depth--;
        if (depth === 0) return html.slice(arrayStart, i + 1);
      } else if (c === '"' || c === "'") {
        inString = true;
        quote = c;
      }
      continue;
    }
    if (c === quote) inString = false;
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title>(.+?)<\/title>/);
  if (!m?.[1]) return undefined;
  return decodeHtmlEntities(m[1]).replace(/ - YouTube$/, "").trim() || undefined;
}

export const youtubeCaptionsProvider: TranscriptProvider = {
  name: PROVIDER_NAME,

  available() {
    return true;
  },

  async fetch(videoId: string): Promise<ProviderResult> {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const meta: VideoMeta = { videoId };

    let html: string;
    let cookieHeader = "";
    try {
      const res = await fetch(watchUrl, { headers: FETCH_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cookieHeader = getCookieHeader(res);
      html = await res.text();
    } catch (e) {
      return {
        ok: false,
        provider: PROVIDER_NAME,
        error: e instanceof Error ? e.message : "Failed to fetch watch page",
        code: "NETWORK_ERROR",
      };
    }

    meta.title = extractTitle(html);

    const arrayStr = extractCaptionTracksArray(html);
    if (!arrayStr) {
      return { ok: false, provider: PROVIDER_NAME, error: "No caption tracks found", code: "TRANSCRIPT_UNAVAILABLE" };
    }

    let tracks: { vssId?: string; baseUrl?: string; languageCode?: string }[];
    try {
      tracks = JSON.parse(arrayStr);
    } catch {
      return { ok: false, provider: PROVIDER_NAME, error: "Invalid caption tracks JSON", code: "PARSING_FAILED" };
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return { ok: false, provider: PROVIDER_NAME, error: "Empty caption tracks", code: "TRANSCRIPT_UNAVAILABLE" };
    }

    const track =
      tracks.find(
        (t) =>
          t.baseUrl &&
          (t.vssId?.startsWith(".en") ||
            t.vssId === "a.en" ||
            t.languageCode?.startsWith("en") ||
            (t as { name?: { simpleText?: string } }).name?.simpleText?.toLowerCase().includes("english")),
      ) ?? tracks.find((t) => t.baseUrl);

    if (!track?.baseUrl) {
      return { ok: false, provider: PROVIDER_NAME, error: "No usable caption track", code: "TRANSCRIPT_UNAVAILABLE" };
    }

    const captionHeaders = { ...FETCH_HEADERS };
    if (cookieHeader) captionHeaders.Cookie = cookieHeader;

    let xml: string;
    try {
      const captionRes = await fetch(track.baseUrl, { headers: captionHeaders });
      if (!captionRes.ok) throw new Error(`HTTP ${captionRes.status}`);
      xml = await captionRes.text();
    } catch (e) {
      return {
        ok: false,
        provider: PROVIDER_NAME,
        error: e instanceof Error ? e.message : "Failed to fetch caption XML",
        code: "NETWORK_ERROR",
      };
    }

    const textTagRegex = /<text\s([^>]+)>([\s\S]*?)<\/text>/gi;
    const segments: TranscriptSegment[] = [];
    let m: RegExpExecArray | null;
    while ((m = textTagRegex.exec(xml)) !== null) {
      const attrs = m[1]!;
      const startMatch = attrs.match(/start="([\d.]+)"/);
      const durMatch = attrs.match(/dur="([\d.]+)"/);
      const start = startMatch ? Number(startMatch[1]) : 0;
      const dur = durMatch ? Number(durMatch[1]) : 0;
      let text = m[2]!.replace(/<\/?[^>]+(>|$)/g, "");
      text = decodeHtmlEntities(text).trim();
      if (text) {
        segments.push({
          text,
          start: Number.isFinite(start) ? start : 0,
          duration: Number.isFinite(dur) ? dur : 0,
        });
      }
    }

    if (segments.length === 0) {
      return { ok: false, provider: PROVIDER_NAME, error: "No segments in caption XML", code: "TRANSCRIPT_UNAVAILABLE" };
    }

    const lang = track.languageCode ?? (track.vssId?.replace(/^[a.]/, "") || undefined);
    meta.language = lang;

    ytLog("info", "youtube-captions success", { videoId, segments: segments.length, lang });
    return { ok: true, provider: PROVIDER_NAME, segments, meta, language: lang };
  },
};
