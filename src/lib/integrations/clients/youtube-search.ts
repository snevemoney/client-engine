/**
 * YouTube Data API v3 client — channel/creator search.
 * Finds creators and channels by topic for prospecting.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type YouTubeChannel = {
  id: string;
  title: string;
  description: string;
  channelUrl: string;
  thumbnailUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  publishedAt?: string;
};

const MOCK_RESULTS: YouTubeChannel[] = [
  { id: "mock-1", title: "Mock: Coach Sarah - Life & Business", description: "Weekly coaching tips for entrepreneurs", channelUrl: "https://youtube.com/@mocksarah", subscriberCount: 12000, videoCount: 150 },
  { id: "mock-2", title: "Mock: Peak Performance with Dave", description: "Mindset coaching and personal growth", channelUrl: "https://youtube.com/@mockdave", subscriberCount: 45000, videoCount: 320 },
];

export async function searchYouTubeChannels(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  query: string,
): Promise<ProviderClientResult<YouTubeChannel[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF" };
    case "mock":
      return { ok: true, data: MOCK_RESULTS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: not supported" };
    case "live": {
      const apiKey = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!apiKey) {
        return { ok: false, data: null, message: "YouTube Data API key required. Enable YouTube Data API v3 in Google Cloud Console." };
      }

      const params = new URLSearchParams({
        part: "snippet",
        q: query,
        type: "channel",
        maxResults: "20",
        key: apiKey,
      });

      const url = `https://www.googleapis.com/youtube/v3/search?${params}`;

      try {
        const res = await trackedFetch("youtube", "search_channels", url);
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, data: null, message: `YouTube API error: HTTP ${res.status} — ${text.slice(0, 200)}` };
        }

        const json = await res.json() as {
          items?: Array<{
            id: { channelId: string };
            snippet: {
              title: string;
              description: string;
              publishedAt?: string;
              thumbnails?: { default?: { url: string } };
            };
          }>;
          error?: { message: string };
        };

        if (json.error) {
          return { ok: false, data: null, message: `YouTube: ${json.error.message}` };
        }

        const channelIds = (json.items ?? []).map((i) => i.id.channelId).filter(Boolean);
        if (channelIds.length === 0) return { ok: true, data: [] };

        // Fetch stats for each channel
        const statsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(",")}&key=${apiKey}`;
        const statsRes = await trackedFetch("youtube", "channel_stats", statsUrl);
        const statsMap = new Map<string, { subscriberCount?: number; videoCount?: number }>();
        if (statsRes.ok) {
          const statsJson = await statsRes.json() as {
            items?: Array<{
              id: string;
              statistics?: { subscriberCount?: string; videoCount?: string };
            }>;
          };
          for (const item of statsJson.items ?? []) {
            statsMap.set(item.id, {
              subscriberCount: item.statistics?.subscriberCount ? parseInt(item.statistics.subscriberCount) : undefined,
              videoCount: item.statistics?.videoCount ? parseInt(item.statistics.videoCount) : undefined,
            });
          }
        }

        const results: YouTubeChannel[] = (json.items ?? []).map((i) => {
          const stats = statsMap.get(i.id.channelId);
          return {
            id: i.id.channelId,
            title: i.snippet.title,
            description: i.snippet.description,
            channelUrl: `https://youtube.com/channel/${i.id.channelId}`,
            thumbnailUrl: i.snippet.thumbnails?.default?.url,
            publishedAt: i.snippet.publishedAt,
            subscriberCount: stats?.subscriberCount,
            videoCount: stats?.videoCount,
          };
        });

        return { ok: true, data: results };
      } catch (err) {
        return { ok: false, data: null, message: err instanceof Error ? err.message : String(err) };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
