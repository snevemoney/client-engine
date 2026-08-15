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
      const res = await globalThis.fetch(watchUrl, { headers: FETCH_HEADERS });
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

    function parseBody(b: string): TranscriptSegment[] {
      const out: TranscriptSegment[] = [];
      // 1. JSON3
      try {
        const json = JSON.parse(b);
        if (json?.events) {
          for (const evt of json.events) {
            if (!evt.segs) continue;
            const text = evt.segs.map((s: { utf8?: string }) => s.utf8 ?? "").join("").trim();
            if (text && text !== "\n") {
              out.push({
                text: decodeHtmlEntities(text),
                start: (evt.tStartMs ?? 0) / 1000,
                duration: (evt.dDurationMs ?? 0) / 1000,
              });
            }
          }
        }
      } catch {
        /* not JSON */
      }
      if (out.length > 0) return out;

      // 2. srv1: <text start="..." dur="...">
      const textTagRegex = /<text\s([^>]+)>([\s\S]*?)<\/text>/gi;
      let m: RegExpExecArray | null;
      while ((m = textTagRegex.exec(b)) !== null) {
        const attrs = m[1]!;
        const startMatch = attrs.match(/start="([\d.]+)"/);
        const durMatch = attrs.match(/dur="([\d.]+)"/);
        const start = startMatch ? Number(startMatch[1]) : 0;
        const dur = durMatch ? Number(durMatch[1]) : 0;
        let text = m[2]!.replace(/<\/?[^>]+(>|$)/g, "");
        text = decodeHtmlEntities(text).trim();
        if (text) out.push({ text, start: Number.isFinite(start) ? start : 0, duration: Number.isFinite(dur) ? dur : 0 });
      }
      if (out.length > 0) return out;

      // 3. srv3: <p t="..." d="..."> (t,d in ms)
      const pTagRegex = /<p\s([^>]+)>([\s\S]*?)<\/p>/gi;
      while ((m = pTagRegex.exec(b)) !== null) {
        const attrs = m[1]!;
        const tMatch = attrs.match(/t="(\d+)"/);
        const dMatch = attrs.match(/d="(\d+)"/);
        const start = tMatch ? Number(tMatch[1]) / 1000 : 0;
        const dur = dMatch ? Number(dMatch[1]) / 1000 : 0;
        let text = m[2]!.replace(/<\/?[^>]+(>|$)/g, "");
        text = decodeHtmlEntities(text).trim();
        if (text) out.push({ text, start: Number.isFinite(start) ? start : 0, duration: Number.isFinite(dur) ? dur : 0 });
      }
      if (out.length > 0) return out;

      // 4. WebVTT: 00:00:01.000 --> 00:00:03.000\nText
      const vttBlockRegex = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})[^\n]*\n([\s\S]*?)(?=\n\n|\n\d{2}:|\z)/gi;
      while ((m = vttBlockRegex.exec(b)) !== null) {
        const h1 = Number(m[1]), m1 = Number(m[2]), s1 = Number(m[3]), ms1 = Number(m[4]);
        const h2 = Number(m[5]), m2 = Number(m[6]), s2 = Number(m[7]), ms2 = Number(m[8]);
        const start = h1 * 3600 + m1 * 60 + s1 + ms1 / 1000;
        const end = h2 * 3600 + m2 * 60 + s2 + ms2 / 1000;
        const text = m[9]!.replace(/\n/g, " ").trim();
        if (text && !text.startsWith("WEBVTT")) {
          out.push({ text: decodeHtmlEntities(text), start, duration: Math.max(0, end - start) });
        }
      }
      if (out.length > 0) return out;

      // 5. Loose fallback: any tag with start= or t= and content (attrs in any order)
      const looseRegex = /<(?:text|p|span|div)([\s\S]*?)>([\s\S]*?)<\/(?:text|p|span|div)>/gi;
      while ((m = looseRegex.exec(b)) !== null) {
        const attrs = m[1]!;
        const startM = attrs.match(/start="([\d.]+)"/);
        const tM = attrs.match(/t="(\d+)"/);
        const durM = attrs.match(/dur="([\d.]+)"/);
        const dM = attrs.match(/d="(\d+)"/);
        const startSec = startM ? Number(startM[1]) : (tM ? Number(tM[1]) / 1000 : 0);
        const durSec = durM ? Number(durM[1]) : (dM ? Number(dM[1]) / 1000 : 1);
        let text = m[2]!.replace(/<\/?[^>]+(>|$)/g, "").trim();
        text = decodeHtmlEntities(text);
        if (text && (startM || tM)) {
          out.push({ text, start: Number.isFinite(startSec) ? startSec : 0, duration: Number.isFinite(durSec) ? durSec : 1 });
        }
      }
      return out;
    }

    const sep = track.baseUrl.includes("?") ? "&" : "?";
    const urlsToTry: string[] = [
      track.baseUrl,
      ...(track.baseUrl.includes("fmt=") ? [] : [
        `${track.baseUrl}${sep}fmt=json3`,
        `${track.baseUrl}${sep}fmt=srv1`,
        `${track.baseUrl}${sep}fmt=srv3`,
        `${track.baseUrl}${sep}fmt=vtt`,
      ]),
    ];

    let segments: TranscriptSegment[] = [];
    let usedTrack = track;

    for (const url of urlsToTry) {
      try {
        const captionRes = await globalThis.fetch(url, { headers: captionHeaders });
        if (!captionRes.ok) continue;
        const body = await captionRes.text();
        segments = parseBody(body);
        if (segments.length > 0) break;
      } catch {
        continue;
      }
    }

    // Hack: if primary track failed, try other tracks (different lang may have different format)
    if (segments.length === 0 && tracks.length > 1) {
      for (const alt of tracks) {
        if (!alt.baseUrl || alt.baseUrl === track.baseUrl) continue;
        const altUrls = [alt.baseUrl];
        if (!alt.baseUrl.includes("fmt=")) {
          const altSep = alt.baseUrl.includes("?") ? "&" : "?";
          altUrls.push(`${alt.baseUrl}${altSep}fmt=json3`, `${alt.baseUrl}${altSep}fmt=srv1`);
        }
        for (const url of altUrls) {
          try {
            const captionRes = await globalThis.fetch(url, { headers: captionHeaders });
            if (!captionRes.ok) continue;
            segments = parseBody(await captionRes.text());
            if (segments.length > 0) {
              usedTrack = alt;
              break;
            }
          } catch {
            continue;
          }
        }
        if (segments.length > 0) break;
      }
    }

    if (segments.length === 0) {
      return {
        ok: false,
        provider: PROVIDER_NAME,
        error: "No segments in caption data",
        code: "TRANSCRIPT_UNAVAILABLE",
      };
    }

    const lang = usedTrack.languageCode ?? (usedTrack.vssId?.replace(/^[a.]/, "") || undefined);
    meta.language = lang;

    ytLog("info", "youtube-captions success", { videoId, segments: segments.length, lang });
    return { ok: true, provider: PROVIDER_NAME, segments, meta, language: lang };
  },
};
