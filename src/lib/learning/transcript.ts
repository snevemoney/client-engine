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
 * Stub: discover recent videos from a channel. Replace with real YouTube Data API or scraper.
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
  return {
    ok: false,
    error: "Channel discovery not configured. Set LEARNING_USE_MOCK_TRANSCRIPT=1 for dev mock, or wire YouTube Data API in transcript.ts discoverChannelVideos.",
    code: "UNSUPPORTED",
  };
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

export const transcriptProvider: TranscriptProvider = {
  name: "stub",
  fetchTranscript: stubFetchTranscript,
};

/**
 * Fetch transcript for a video. Uses configured provider (stub or real).
 */
export async function fetchTranscript(videoId: string, videoUrl: string): Promise<FetchTranscriptResult> {
  return transcriptProvider.fetchTranscript(videoId, videoUrl);
}
