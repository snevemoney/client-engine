/**
 * Transcript provider interface and adapters.
 * Stub/mock for dev; plug real YouTube transcript API later.
 */

import type { VideoMetadata, TranscriptSegment } from "./types";

export type FetchTranscriptResult =
  | { ok: true; segments: TranscriptSegment[]; metadata: VideoMetadata }
  | { ok: false; error: string; code: "TRANSCRIPT_UNAVAILABLE" | "INVALID_URL" | "UNSUPPORTED" };

const YOUTUBE_VIDEO_REGEX =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const YOUTUBE_FETCH_HEADERS: Record<string, string> = {
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

export function parseVideoId(url: string): string | null {
  const m = url.trim().match(YOUTUBE_VIDEO_REGEX);
  return m ? m[1]! : null;
}

export function parseVideoUrl(url: string): string | null {
  const id = parseVideoId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/**
 * Validate YouTube video URL and return canonical URL or null.
 */
export function validateVideoUrl(input: string): { ok: true; videoUrl: string; videoId: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "URL is required" };
  const videoId = parseVideoId(trimmed);
  if (!videoId) return { ok: false, error: "Invalid YouTube video URL" };
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return { ok: true, videoUrl, videoId };
}

const YOUTUBE_CHANNEL_REGEX = /youtube\.com\/(?:channel\/|c\/|@)([\w-]+)/;

export function parseChannelUrl(url: string): { channelId?: string; handle?: string } | null {
  const trimmed = url.trim();
  const m = trimmed.match(YOUTUBE_CHANNEL_REGEX);
  if (!m) return null;
  const slug = m[1]!;
  if (trimmed.includes("/channel/")) return { channelId: slug };
  return { handle: slug };
}

export type ChannelDiscoverResult =
  | { ok: true; videos: { videoId: string; videoUrl: string; title?: string }[]; channelName?: string }
  | { ok: false; error: string; code: "INVALID_CHANNEL" | "UNSUPPORTED" };

/**
 * Build channel videos page URL for internal scraping.
 */
function channelVideosUrl(channelUrl: string): string | null {
  const parsed = parseChannelUrl(channelUrl);
  if (!parsed) return null;
  const base = "https://www.youtube.com";
  if (parsed.channelId) return `${base}/channel/${parsed.channelId}/videos`;
  if (parsed.handle) return `${base}/@${parsed.handle}/videos`;
  return null;
}

/**
 * Discover recent videos from a channel by scraping the channel videos page (no API).
 * Uses mock when LEARNING_USE_MOCK_TRANSCRIPT=1; otherwise fetches channel page and extracts video IDs.
 */
export async function discoverChannelVideos(
  channelUrl: string,
  maxVideos: number
): Promise<ChannelDiscoverResult> {
  const parsed = parseChannelUrl(channelUrl);
  if (!parsed) return { ok: false, error: "Invalid YouTube channel URL", code: "INVALID_CHANNEL" };
  const useMock = process.env.LEARNING_USE_MOCK_TRANSCRIPT === "1" || process.env.LEARNING_USE_MOCK_TRANSCRIPT === "true";
  if (useMock) {
    return {
      ok: true,
      channelName: parsed.channelId ? `Channel ${parsed.channelId}` : `@${parsed.handle}`,
      videos: [
        { videoId: "dQw4w9WgXcQ", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Mock video 1" },
      ].slice(0, maxVideos),
    };
  }

  const videosPageUrl = channelVideosUrl(channelUrl);
  if (!videosPageUrl) return { ok: false, error: "Invalid channel URL", code: "INVALID_CHANNEL" };

  let html: string;
  try {
    const res = await fetch(videosPageUrl, { headers: YOUTUBE_FETCH_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to fetch channel page",
      code: "UNSUPPORTED",
    };
  }

  const videoIdRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
  const seen = new Set<string>();
  const videos: { videoId: string; videoUrl: string; title?: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = videoIdRegex.exec(html)) !== null && videos.length < maxVideos) {
    const id = match[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    videos.push({
      videoId: id,
      videoUrl: `https://www.youtube.com/watch?v=${id}`,
    });
  }

  if (videos.length === 0) {
    return {
      ok: false,
      error: "No videos found on channel page",
      code: "UNSUPPORTED",
    };
  }

  const channelName = parsed.channelId ? `Channel ${parsed.channelId}` : `@${parsed.handle}`;
  return { ok: true, videos, channelName };
}

/**
 * Provider interface for fetching transcript and metadata.
 * Implement real adapter (e.g. youtube-transcript or third-party API) when ready.
 */
export interface TranscriptProvider {
  name: string;
  fetchTranscript(videoId: string, videoUrl: string): Promise<FetchTranscriptResult>;
}

/**
 * Stub provider: returns mock transcript for testing when no real provider is wired.
 * Set LEARNING_USE_MOCK_TRANSCRIPT=1 to use mock; otherwise returns TRANSCRIPT_UNAVAILABLE for real URLs.
 */
async function stubFetchTranscript(videoId: string, videoUrl: string): Promise<FetchTranscriptResult> {
  const useMock = process.env.LEARNING_USE_MOCK_TRANSCRIPT === "1" || process.env.LEARNING_USE_MOCK_TRANSCRIPT === "true";
  if (useMock) {
    return {
      ok: true,
      metadata: {
        videoId,
        title: `Mock video ${videoId}`,
        description: "Mock description for dev testing.",
        channelTitle: "Mock Channel",
      },
      segments: [
        { text: "This is a mock transcript segment one.", start: 0, duration: 5 },
        { text: "We discuss systems thinking and bottleneck theory.", start: 5, duration: 6 },
        { text: "Focus on the constraint; improve conversion at the leak.", start: 11, duration: 5 },
      ],
    };
  }
  return {
    ok: false,
    error: "Transcript provider not configured. Set LEARNING_USE_MOCK_TRANSCRIPT=1 for dev mock, or wire a real transcript adapter in src/lib/learning/transcript.ts",
    code: "TRANSCRIPT_UNAVAILABLE",
  };
}

/** Decode common HTML entities in caption text. */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Strip XML/HTML tags from a string. */
function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

/**
 * Extract the JSON array following "captionTracks": in the page HTML.
 * Uses bracket counting so we don't break on ] inside baseUrl strings.
 */
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

/**
 * Internal fallback: fetch watch page, parse captionTracks, fetch timedtext XML, parse segments.
 * Used when youtube-transcript fails (e.g. "Transcript is disabled"). No external API.
 */
/** Build Cookie header from fetch response (set-cookie). */
function getCookieHeader(res: Response): string {
  const setCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (setCookie?.length) {
    return setCookie.map((c) => c.split(";")[0].trim()).join("; ");
  }
  const single = res.headers.get("set-cookie");
  return single ? single.split(",").map((c) => c.split(";")[0].trim()).join("; ") : "";
}

async function fetchTranscriptInternalFallback(videoId: string): Promise<FetchTranscriptResult> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let html: string;
  let cookieHeader = "";
  try {
    const res = await fetch(watchUrl, { headers: YOUTUBE_FETCH_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cookieHeader = getCookieHeader(res);
    html = await res.text();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to fetch watch page",
      code: "TRANSCRIPT_UNAVAILABLE",
    };
  }

  const arrayStr = extractCaptionTracksArray(html);
  if (!arrayStr) {
    return { ok: false, error: "No caption tracks for this video", code: "TRANSCRIPT_UNAVAILABLE" };
  }

  let tracks: { vssId?: string; baseUrl?: string; languageCode?: string }[];
  try {
    tracks = JSON.parse(arrayStr);
  } catch {
    return { ok: false, error: "Invalid caption tracks JSON", code: "TRANSCRIPT_UNAVAILABLE" };
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    return { ok: false, error: "No caption tracks for this video", code: "TRANSCRIPT_UNAVAILABLE" };
  }

  const track =
    tracks.find(
      (t) =>
        t.baseUrl &&
        (t.vssId?.startsWith(".en") ||
          t.vssId === "a.en" ||
          t.languageCode?.startsWith("en") ||
          (t as { name?: { simpleText?: string } }).name?.simpleText?.toLowerCase().includes("english"))
    ) ?? tracks.find((t) => t.baseUrl);
  if (!track?.baseUrl) {
    return { ok: false, error: "No English captions found", code: "TRANSCRIPT_UNAVAILABLE" };
  }

  const captionHeaders = { ...YOUTUBE_FETCH_HEADERS };
  if (cookieHeader) captionHeaders.Cookie = cookieHeader;

  let xml: string;
  try {
    const captionRes = await fetch(track.baseUrl, { headers: captionHeaders });
    if (!captionRes.ok) throw new Error(`HTTP ${captionRes.status}`);
    xml = await captionRes.text();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to fetch caption XML",
      code: "TRANSCRIPT_UNAVAILABLE",
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
    let text = m[2]!.replace(/&amp;/gi, "&").replace(/<\/?[^>]+(>|$)/g, "");
    text = decodeHtmlEntities(text);
    text = stripTags(text).trim();
    if (text) {
      segments.push({
        text,
        start: Number.isFinite(start) ? start : 0,
        duration: Number.isFinite(dur) ? dur : 0,
      });
    }
  }
  if (segments.length === 0) {
    return { ok: false, error: "No segments in caption", code: "TRANSCRIPT_UNAVAILABLE" };
  }

  return {
    ok: true,
    metadata: { videoId, title: `Video ${videoId}`, channelTitle: undefined },
    segments,
  };
}

/**
 * Real provider using youtube-transcript package (YouTube timedtext/captions).
 * Falls back to internal caption fetch (watch page + timedtext XML) when primary fails.
 * Used when LEARNING_USE_MOCK_TRANSCRIPT is not set.
 */
async function realFetchTranscript(videoId: string, videoUrl: string): Promise<FetchTranscriptResult> {
  let primaryError: string | null = null;
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const list = await YoutubeTranscript.fetchTranscript(videoId);
    const segments = list.map((item) => ({
      text: item.text,
      start: item.offset / 1000,
      duration: item.duration / 1000,
    }));
    if (segments.length > 0) {
      return {
        ok: true,
        metadata: {
          videoId,
          title: `Video ${videoId}`,
          channelTitle: undefined,
        },
        segments,
      };
    }
    primaryError = "Transcript returned no segments";
  } catch (err) {
    primaryError = err instanceof Error ? err.message : String(err);
  }

  const fallback = await fetchTranscriptInternalFallback(videoId);
  if (fallback.ok) return fallback;

  try {
    const { YoutubeTranscript: YoutubeTranscriptAlt } = await import("@danielxceron/youtube-transcript");
    const list = await YoutubeTranscriptAlt.fetchTranscript(videoId);
    const segments = list.map((item: { text: string; offset: number; duration: number }) => ({
      text: item.text,
      start: item.offset / 1000,
      duration: item.duration / 1000,
    }));
    if (segments.length > 0) {
      return {
        ok: true,
        metadata: { videoId, title: `Video ${videoId}`, channelTitle: undefined },
        segments,
      };
    }
  } catch {
    // ignore
  }

  return {
    ok: false,
    error: primaryError ?? fallback.error,
    code: "TRANSCRIPT_UNAVAILABLE",
  };
}

const useRealTranscript = process.env.LEARNING_USE_MOCK_TRANSCRIPT !== "1" && process.env.LEARNING_USE_MOCK_TRANSCRIPT !== "true";

export const transcriptProvider: TranscriptProvider = {
  name: useRealTranscript ? "youtube-transcript" : "stub",
  fetchTranscript: useRealTranscript ? realFetchTranscript : stubFetchTranscript,
};

/**
 * Fetch transcript for a video. Uses configured provider (stub or real).
 */
export async function fetchTranscript(videoId: string, videoUrl: string): Promise<FetchTranscriptResult> {
  return transcriptProvider.fetchTranscript(videoId, videoUrl);
}
