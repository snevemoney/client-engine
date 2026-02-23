/**
 * YouTube URL normalization — parse, validate, extract IDs, identify source type.
 */

import type { NormalizedSource } from "./types";

const VIDEO_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
];

const CHANNEL_PATTERNS = [
  { re: /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/, field: "channelId" as const },
  { re: /youtube\.com\/@([a-zA-Z0-9_.-]+)/, field: "handle" as const },
  { re: /youtube\.com\/c\/([a-zA-Z0-9_.-]+)/, field: "handle" as const },
  { re: /youtube\.com\/user\/([a-zA-Z0-9_.-]+)/, field: "handle" as const },
];

export function extractVideoId(url: string): string | null {
  const trimmed = url.trim();
  for (const pattern of VIDEO_PATTERNS) {
    const m = trimmed.match(pattern);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function normalizeVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function extractChannelInfo(url: string): { channelId?: string; handle?: string } | null {
  const trimmed = url.trim();
  for (const { re, field } of CHANNEL_PATTERNS) {
    const m = trimmed.match(re);
    if (m?.[1]) return { [field]: m[1] };
  }
  return null;
}

export function normalizeChannelUrl(info: { channelId?: string; handle?: string }): string {
  if (info.channelId) return `https://www.youtube.com/channel/${info.channelId}`;
  if (info.handle) return `https://www.youtube.com/@${info.handle}`;
  return "";
}

/**
 * Identify and normalize any YouTube URL (video or channel).
 * Returns null if the URL cannot be recognized.
 */
export function identifySource(url: string): NormalizedSource | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const videoId = extractVideoId(trimmed);
  if (videoId) {
    return { type: "video", videoId, normalizedUrl: normalizeVideoUrl(videoId) };
  }

  const channelInfo = extractChannelInfo(trimmed);
  if (channelInfo) {
    return {
      type: "channel",
      channelId: channelInfo.channelId,
      handle: channelInfo.handle,
      normalizedUrl: normalizeChannelUrl(channelInfo),
    };
  }

  return null;
}

/**
 * Validate that a string is a valid YouTube video URL and return parsed info.
 */
export function validateVideoUrl(
  input: string,
): { ok: true; videoId: string; normalizedUrl: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "URL is required" };
  const videoId = extractVideoId(trimmed);
  if (!videoId) return { ok: false, error: "Invalid YouTube video URL" };
  return { ok: true, videoId, normalizedUrl: normalizeVideoUrl(videoId) };
}

/**
 * Validate that a string is a valid YouTube channel URL and return parsed info.
 */
export function validateChannelUrl(
  input: string,
): { ok: true; channelId?: string; handle?: string; normalizedUrl: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "URL is required" };
  const info = extractChannelInfo(trimmed);
  if (!info) return { ok: false, error: "Invalid YouTube channel URL" };
  return { ok: true, ...info, normalizedUrl: normalizeChannelUrl(info) };
}
