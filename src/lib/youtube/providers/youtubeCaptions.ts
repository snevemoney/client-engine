/**
 * Fallback 1: Direct YouTube captions extraction.
 * 1) Watch-page captionTracks JSON → timedtext
 * 2) Innertube player API (ANDROID/WEB) when watch page has no tracks
 * No external API key needed — relies on public captions.
 */

import type { TranscriptProvider, ProviderResult, TranscriptSegment, VideoMeta } from "../types";
import { ytLog } from "../types";

const PROVIDER_NAME = "youtube-captions";

type CaptionTrack = {
  vssId?: string;
  baseUrl?: string;
  languageCode?: string;
  name?: { simpleText?: string };
};

/**
 * Optional YouTube session cookies to bypass "Sign in to confirm you’re not a bot".
 * Set `YOUTUBE_COOKIES` to a raw Cookie header value (e.g. `VISITOR_INFO1_LIVE=...; SID=...; HSID=...`).
 */
function getConfiguredCookies(): string {
  return process.env.YOUTUBE_COOKIES?.trim() || "";
}

const FETCH_HEADERS: Record<string, string> = {
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Origin: "https://www.youtube.com",
  Referer: "https://www.youtube.com/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24"',
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
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
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
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title>(.+?)<\/title>/);
  if (!m?.[1]) return undefined;
  return decodeHtmlEntities(m[1]).replace(/ - YouTube$/, "").trim() || undefined;
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  return (
    tracks.find(
      (t) =>
        t.baseUrl &&
        (t.vssId?.startsWith(".en") ||
          t.vssId === "a.en" ||
          t.languageCode?.startsWith("en") ||
          t.name?.simpleText?.toLowerCase().includes("english")),
    ) ?? tracks.find((t) => t.baseUrl)
  );
}

function parseCaptionBody(body: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  // JSON3 format
  try {
    const json = JSON.parse(body);
    if (json?.events) {
      for (const evt of json.events) {
        if (!evt.segs) continue;
        const text = evt.segs.map((s: { utf8?: string }) => s.utf8 ?? "").join("").trim();
        if (text && text !== "\n") {
          segments.push({
            text: decodeHtmlEntities(text),
            start: (evt.tStartMs ?? 0) / 1000,
            duration: (evt.dDurationMs ?? 0) / 1000,
          });
        }
      }
      if (segments.length > 0) return segments;
    }
  } catch {
    // Not JSON
  }

  // srv1 XML (<text start="..." dur="...">)
  const textTagRegex = /<text\s([^>]+)>([\s\S]*?)<\/text>/gi;
  let m: RegExpExecArray | null;
  while ((m = textTagRegex.exec(body)) !== null) {
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
  if (segments.length > 0) return segments;

  // srv3 XML (<p t="..." d="...">)
  const pTagRegex = /<p\s([^>]+)>([\s\S]*?)<\/p>/gi;
  while ((m = pTagRegex.exec(body)) !== null) {
    const attrs = m[1]!;
    const tMatch = attrs.match(/t="(\d+)"/);
    const dMatch = attrs.match(/d="(\d+)"/);
    const start = tMatch ? Number(tMatch[1]) / 1000 : 0;
    const dur = dMatch ? Number(dMatch[1]) / 1000 : 0;
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

  return segments;
}

function buildCaptionUrls(baseUrl: string): string[] {
  // Strip pot/ tokens that often expire / bot-check; try several formats.
  const cleaned = baseUrl
    .replace(/&pot=[^&]*/g, "")
    .replace(/&potc=[^&]*/g, "")
    .replace(/&fmt=[^&]*/g, "");

  return [
    `${cleaned}&fmt=json3`,
    `${cleaned}&fmt=srv3`,
    `${cleaned}&fmt=srv1`,
    `${cleaned}&fmt=ttml`,
    cleaned,
    baseUrl.includes("fmt=") ? baseUrl : `${baseUrl}&fmt=json3`,
    baseUrl,
  ];
}

async function fetchSegmentsFromTrack(
  track: CaptionTrack,
  cookieHeader: string,
): Promise<TranscriptSegment[]> {
  if (!track.baseUrl) return [];
  const captionHeaders = { ...FETCH_HEADERS };
  if (cookieHeader) captionHeaders.Cookie = cookieHeader;

  for (const captionUrl of buildCaptionUrls(track.baseUrl)) {
    try {
      const captionRes = await globalThis.fetch(captionUrl, { headers: captionHeaders });
      if (!captionRes.ok) continue;
      const body = await captionRes.text();
      if (!body || body.length < 10) continue;
      const segments = parseCaptionBody(body);
      if (segments.length > 0) return segments;
    } catch {
      continue;
    }
  }
  return [];
}

async function fetchInnertubeTracks(
  videoId: string,
  cookieHeader: string,
): Promise<{ tracks: CaptionTrack[]; botCheck: boolean }> {
  const clients: Array<Record<string, unknown>> = [
    {
      clientName: "ANDROID",
      clientVersion: "20.10.38",
      androidSdkVersion: 30,
      hl: "en",
      gl: "US",
    },
    {
      clientName: "WEB",
      clientVersion: "2.20250327.01.00",
      hl: "en",
      gl: "US",
    },
    {
      clientName: "IOS",
      clientVersion: "20.10.4",
      deviceModel: "iPhone16,2",
      hl: "en",
      gl: "US",
    },
    {
      clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
      clientVersion: "2.0",
      hl: "en",
      gl: "US",
    },
  ];

  let botCheck = false;

  for (const client of clients) {
    try {
      const res = await globalThis.fetch(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        {
          method: "POST",
          headers: {
            ...FETCH_HEADERS,
            "Content-Type": "application/json",
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            context: { client },
            videoId,
            contentCheckOk: true,
            racyCheckOk: true,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        playabilityStatus?: { status?: string; reason?: string };
        captions?: {
          playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
        };
      };
      const play = data?.playabilityStatus?.status;
      const reason = data?.playabilityStatus?.reason ?? "";
      if (
        play === "LOGIN_REQUIRED" ||
        /not a bot|sign in/i.test(reason)
      ) {
        botCheck = true;
      }
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length > 0) {
        ytLog("info", "innertube caption tracks found", {
          videoId,
          client: String(client.clientName),
          count: tracks.length,
        });
        return { tracks, botCheck: false };
      }
    } catch (err) {
      ytLog("warn", "innertube player fetch failed", {
        videoId,
        client: String(client.clientName),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { tracks: [], botCheck };
}

export const youtubeCaptionsProvider: TranscriptProvider = {
  name: PROVIDER_NAME,

  available() {
    return true;
  },

  async fetch(videoId: string): Promise<ProviderResult> {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const meta: VideoMeta = { videoId };
    const configuredCookies = getConfiguredCookies();

    let html: string;
    let cookieHeader = configuredCookies;
    try {
      const watchHeaders = { ...FETCH_HEADERS };
      if (configuredCookies) watchHeaders.Cookie = configuredCookies;
      const res = await globalThis.fetch(watchUrl, { headers: watchHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const setCookies = getCookieHeader(res);
      if (setCookies) {
        cookieHeader = cookieHeader
          ? `${cookieHeader}; ${setCookies}`
          : setCookies;
      }
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

    let tracks: CaptionTrack[] = [];
    let botCheck = false;
    const arrayStr = extractCaptionTracksArray(html);
    if (arrayStr) {
      try {
        const parsed = JSON.parse(arrayStr);
        if (Array.isArray(parsed)) tracks = parsed;
      } catch {
        // fall through to innertube
      }
    }

    if (tracks.length === 0) {
      const inner = await fetchInnertubeTracks(videoId, cookieHeader);
      tracks = inner.tracks;
      botCheck = inner.botCheck;
    }

    if (tracks.length === 0) {
      if (botCheck && !configuredCookies) {
        return {
          ok: false,
          provider: PROVIDER_NAME,
          error:
            "YouTube bot check (LOGIN_REQUIRED) — set YOUTUBE_COOKIES in .env and rebuild/restart",
          code: "TRANSCRIPT_UNAVAILABLE",
        };
      }
      return {
        ok: false,
        provider: PROVIDER_NAME,
        error: botCheck
          ? "YouTube bot check still blocking despite YOUTUBE_COOKIES"
          : "No caption tracks found",
        code: "TRANSCRIPT_UNAVAILABLE",
      };
    }

    // Try preferred English track first, then remaining tracks.
    // If watch-page tracks yield no segments (expired pot=/bot gate), fall back to Innertube tracks.
    async function tryTracks(candidateTracks: CaptionTrack[]): Promise<ProviderResult | null> {
      const preferred = pickTrack(candidateTracks);
      const ordered = preferred
        ? [preferred, ...candidateTracks.filter((t) => t !== preferred)]
        : candidateTracks;

      for (const track of ordered) {
        const segments = await fetchSegmentsFromTrack(track, cookieHeader);
        if (segments.length === 0) continue;

        const lang = track.languageCode ?? (track.vssId?.replace(/^[a.]/, "") || undefined);
        meta.language = lang;
        ytLog("info", "youtube-captions success", { videoId, segments: segments.length, lang });
        return { ok: true, provider: PROVIDER_NAME, segments, meta, language: lang };
      }
      return null;
    }

    const fromWatch = await tryTracks(tracks);
    if (fromWatch) return fromWatch;

    // Watch-page tracks present but timedtext empty → Innertube often still works
    const inner = await fetchInnertubeTracks(videoId, cookieHeader);
    botCheck = botCheck || inner.botCheck;
    if (inner.tracks.length > 0) {
      const fromInner = await tryTracks(inner.tracks);
      if (fromInner) return fromInner;
    }

    if (botCheck && !configuredCookies) {
      return {
        ok: false,
        provider: PROVIDER_NAME,
        error:
          "YouTube bot check (LOGIN_REQUIRED) — set YOUTUBE_COOKIES in .env and rebuild/restart",
        code: "TRANSCRIPT_UNAVAILABLE",
      };
    }

    return {
      ok: false,
      provider: PROVIDER_NAME,
      error: "No segments in any caption format",
      code: "TRANSCRIPT_UNAVAILABLE",
    };
  },
};
