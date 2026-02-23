/**
 * Channel ingestion pipeline.
 *
 * Flow: validate channel URL → resolve channel → fetch recent videos → de-dupe → queue ingest for each.
 * Processes with concurrency limit to avoid overwhelming providers.
 */

import { db } from "@/lib/db";
import { validateChannelUrl } from "./normalize";
import { ingestVideo } from "./videoIngest";
import { TRANSCRIPT_STATUS, ytLog } from "./types";
import type { ChannelIngestRunSummary } from "./types";

const FETCH_HEADERS: Record<string, string> = {
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://www.youtube.com",
  Referer: "https://www.youtube.com/",
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const CONCURRENCY = 3;

type DiscoveredVideo = {
  videoId: string;
  videoUrl: string;
  title?: string;
};

export type ChannelIngestResult = {
  ok: boolean;
  channelUrl: string;
  summary: ChannelIngestRunSummary;
  jobId: string;
  videoResults: Array<{
    videoId: string;
    status: string;
    error: string | null;
  }>;
  errors: string[];
};

/**
 * Discover recent videos from a channel page (no API key required).
 */
async function discoverChannelVideos(
  channelUrl: string,
  limit: number,
): Promise<{ ok: true; videos: DiscoveredVideo[]; channelName?: string } | { ok: false; error: string }> {
  const validated = validateChannelUrl(channelUrl);
  if (!validated.ok) return { ok: false, error: validated.error };

  const videosPageUrl = validated.channelId
    ? `https://www.youtube.com/channel/${validated.channelId}/videos`
    : `https://www.youtube.com/@${validated.handle}/videos`;

  let html: string;
  try {
    const res = await fetch(videosPageUrl, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to fetch channel page" };
  }

  const videoIdRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
  const seen = new Set<string>();
  const videos: DiscoveredVideo[] = [];
  let match: RegExpExecArray | null;
  while ((match = videoIdRegex.exec(html)) !== null && videos.length < limit) {
    const id = match[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    videos.push({
      videoId: id,
      videoUrl: `https://www.youtube.com/watch?v=${id}`,
    });
  }

  const channelNameMatch = html.match(/"channelName":"([^"]+)"/);
  const channelName = channelNameMatch?.[1] ?? (validated.handle ? `@${validated.handle}` : undefined);

  if (videos.length === 0) {
    return { ok: false, error: "No videos found on channel page" };
  }

  return { ok: true, videos, channelName };
}

/**
 * Process items with limited concurrency.
 */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Ingest a YouTube channel: discover recent videos, de-dupe, ingest each.
 */
export async function ingestChannel(
  url: string,
  limit?: number,
): Promise<ChannelIngestResult> {
  const effectiveLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const validated = validateChannelUrl(url);

  if (!validated.ok) {
    return {
      ok: false,
      channelUrl: url,
      summary: { channelId: "", totalFound: 0, alreadyIngested: 0, transcribed: 0, failed: 0, queuedForReview: 0 },
      jobId: "",
      videoResults: [],
      errors: [validated.error],
    };
  }

  const externalId = validated.channelId ?? validated.handle ?? "";
  const normalizedUrl = validated.normalizedUrl;

  ytLog("info", "starting channel ingest", { url: normalizedUrl, limit: effectiveLimit });

  // Create or find source
  let source = await db.youTubeSource.findUnique({ where: { externalId } });
  if (!source) {
    source = await db.youTubeSource.create({
      data: {
        type: "channel",
        url,
        normalizedUrl,
        externalId,
      },
    });
  }

  // Create channel ingest job
  const job = await db.youTubeIngestJob.create({
    data: {
      sourceType: "channel",
      sourceId: source.id,
      status: TRANSCRIPT_STATUS.FETCHING,
      startedAt: new Date(),
    },
  });

  // Discover videos
  const discovered = await discoverChannelVideos(url, effectiveLimit);
  if (!discovered.ok) {
    await db.youTubeIngestJob.update({
      where: { id: job.id },
      data: {
        status: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT,
        lastError: discovered.error,
        completedAt: new Date(),
      },
    });

    return {
      ok: false,
      channelUrl: normalizedUrl,
      summary: { channelId: externalId, totalFound: 0, alreadyIngested: 0, transcribed: 0, failed: 0, queuedForReview: 0 },
      jobId: job.id,
      videoResults: [],
      errors: [discovered.error],
    };
  }

  // Update source with channel name
  if (discovered.channelName) {
    await db.youTubeSource.update({
      where: { id: source.id },
      data: { channelName: discovered.channelName, title: discovered.channelName },
    });
  }

  const summary: ChannelIngestRunSummary = {
    channelId: externalId,
    channelName: discovered.channelName,
    totalFound: discovered.videos.length,
    alreadyIngested: 0,
    transcribed: 0,
    failed: 0,
    queuedForReview: 0,
  };

  // Check which videos are already ingested
  const existingTranscripts = await db.youTubeTranscript.findMany({
    where: {
      videoId: { in: discovered.videos.map((v) => v.videoId) },
      transcriptStatus: TRANSCRIPT_STATUS.TRANSCRIBED,
    },
    select: { videoId: true },
  });
  const alreadyIngested = new Set(existingTranscripts.map((t) => t.videoId));
  summary.alreadyIngested = alreadyIngested.size;

  const videosToProcess = discovered.videos.filter((v) => !alreadyIngested.has(v.videoId));

  // Process with concurrency limit
  const videoResults = await mapConcurrent(videosToProcess, CONCURRENCY, async (video) => {
    try {
      const result = await ingestVideo(video.videoUrl);
      if (result.ok) {
        if (result.status === "ALREADY_INGESTED") {
          summary.alreadyIngested++;
        } else {
          summary.transcribed++;
          if (result.proposalId) summary.queuedForReview++;
        }
      } else {
        summary.failed++;
      }
      return {
        videoId: video.videoId,
        status: result.status,
        error: result.error,
      };
    } catch (err) {
      summary.failed++;
      return {
        videoId: video.videoId,
        status: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

  // Include already-ingested ones in results
  for (const vid of discovered.videos.filter((v) => alreadyIngested.has(v.videoId))) {
    videoResults.push({
      videoId: vid.videoId,
      status: "ALREADY_INGESTED",
      error: null,
    });
  }

  const errors = videoResults.filter((r) => r.error).map((r) => `${r.videoId}: ${r.error}`);
  const ok = summary.failed === 0;

  await db.youTubeIngestJob.update({
    where: { id: job.id },
    data: {
      status: ok ? TRANSCRIPT_STATUS.TRANSCRIBED : TRANSCRIPT_STATUS.FAILED_TRANSCRIPT,
      attempts: videoResults.length,
      completedAt: new Date(),
      lastError: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      runSummaryJson: summary,
    },
  });

  ytLog("info", "channel ingest complete", {
    channelId: externalId,
    totalFound: summary.totalFound,
    transcribed: summary.transcribed,
    failed: summary.failed,
    alreadyIngested: summary.alreadyIngested,
  });

  return {
    ok,
    channelUrl: normalizedUrl,
    summary,
    jobId: job.id,
    videoResults,
    errors,
  };
}
