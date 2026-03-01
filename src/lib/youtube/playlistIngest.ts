/**
 * Playlist ingestion pipeline.
 *
 * Flow: validate playlist URL → scrape playlist page for video IDs → de-dupe → ingest each video.
 */

import { db } from "@/lib/db";
import { validatePlaylistUrl } from "./normalize";
import { ingestVideo } from "./videoIngest";
import { TRANSCRIPT_STATUS, ytLog } from "./types";

const FETCH_HEADERS: Record<string, string> = {
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://www.youtube.com",
  Referer: "https://www.youtube.com/",
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CONCURRENCY = 3;

type PlaylistIngestSummary = {
  playlistId: string;
  playlistTitle?: string;
  totalFound: number;
  alreadyIngested: number;
  transcribed: number;
  failed: number;
  queuedForReview: number;
};

export type PlaylistIngestResult = {
  ok: boolean;
  playlistUrl: string;
  summary: PlaylistIngestSummary;
  jobId: string;
  videoResults: Array<{
    videoId: string;
    status: string;
    error: string | null;
  }>;
  errors: string[];
};

/**
 * Discover videos from a YouTube playlist page (no API key required).
 */
async function discoverPlaylistVideos(
  playlistId: string,
  limit: number,
): Promise<{ ok: true; videos: { videoId: string; videoUrl: string }[]; title?: string } | { ok: false; error: string }> {
  const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

  let html: string;
  try {
    const res = await fetch(playlistUrl, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to fetch playlist page" };
  }

  // Extract playlist title
  const titleMatch = html.match(/<title>(.+?)<\/title>/);
  const rawTitle = titleMatch?.[1]
    ?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/ - YouTube$/, "").trim();

  // Extract video IDs from playlist page
  const videoIdRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
  const seen = new Set<string>();
  const videos: { videoId: string; videoUrl: string }[] = [];
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

  if (videos.length === 0) {
    return { ok: false, error: "No videos found in playlist" };
  }

  return { ok: true, videos, title: rawTitle || undefined };
}

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

export async function ingestPlaylist(
  url: string,
  limit?: number,
): Promise<PlaylistIngestResult> {
  const effectiveLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const validated = validatePlaylistUrl(url);

  if (!validated.ok) {
    return {
      ok: false,
      playlistUrl: url,
      summary: { playlistId: "", totalFound: 0, alreadyIngested: 0, transcribed: 0, failed: 0, queuedForReview: 0 },
      jobId: "",
      videoResults: [],
      errors: [validated.error],
    };
  }

  const { playlistId, normalizedUrl } = validated;

  ytLog("info", "starting playlist ingest", { playlistId, url: normalizedUrl, limit: effectiveLimit });

  // Create or find source
  const externalId = `playlist:${playlistId}`;
  let source = await db.youTubeSource.findUnique({ where: { externalId } });
  if (!source) {
    source = await db.youTubeSource.create({
      data: {
        type: "channel", // reuse channel type for playlists (same shape)
        url,
        normalizedUrl,
        externalId,
      },
    });
  }

  // Create ingest job
  const job = await db.youTubeIngestJob.create({
    data: {
      sourceType: "channel", // reuse channel type
      sourceId: source.id,
      status: TRANSCRIPT_STATUS.FETCHING,
      startedAt: new Date(),
    },
  });

  // Discover videos
  const discovered = await discoverPlaylistVideos(playlistId, effectiveLimit);
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
      playlistUrl: normalizedUrl,
      summary: { playlistId, totalFound: 0, alreadyIngested: 0, transcribed: 0, failed: 0, queuedForReview: 0 },
      jobId: job.id,
      videoResults: [],
      errors: [discovered.error],
    };
  }

  // Update source with playlist title
  if (discovered.title) {
    await db.youTubeSource.update({
      where: { id: source.id },
      data: { title: discovered.title },
    });
  }

  const summary: PlaylistIngestSummary = {
    playlistId,
    playlistTitle: discovered.title,
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
      return { videoId: video.videoId, status: result.status, error: result.error };
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
    videoResults.push({ videoId: vid.videoId, status: "ALREADY_INGESTED", error: null });
  }

  const errors = videoResults.filter((r) => r.error).map((r) => `${r.videoId}: ${r.error}`);
  const ok = summary.transcribed > 0 || summary.alreadyIngested > 0;

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

  ytLog("info", "playlist ingest complete", {
    playlistId,
    totalFound: summary.totalFound,
    transcribed: summary.transcribed,
    failed: summary.failed,
    alreadyIngested: summary.alreadyIngested,
  });

  return { ok, playlistUrl: normalizedUrl, summary, jobId: job.id, videoResults, errors };
}
