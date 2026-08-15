/**
 * Single video ingestion pipeline.
 *
 * Flow: validate URL → de-dupe → create source + job → resolve transcript → store → auto-categorize learning proposal.
 * Proposals are auto-categorized (promoted or knowledge-only). Deletable with cascade cleanup.
 */

import { db } from "@/lib/db";
import { createHash } from "node:crypto";
import { validateVideoUrl } from "./normalize";
import { resolveTranscript } from "./transcriptResolver";
import { generateLearningProposal } from "./learningProposal";
import { TRANSCRIPT_STATUS, ytLog } from "./types";
import type { TranscriptSegment } from "./types";

export type VideoIngestResult = {
  ok: boolean;
  videoId: string;
  jobId: string | null;
  transcriptId: string | null;
  proposalId: string | null;
  status: string;
  providerUsed: string | null;
  error: string | null;
  attempts: number;
};

function hashTranscript(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 40);
}

type VideoMeta = { videoId: string; title?: string; channelId?: string; channelTitle?: string; publishedAt?: string };

/** Retry proposal generation when transcript exists but no LearningProposal (e.g. after PROPOSAL_FAILED). */
async function runProposalRetry(
  videoId: string,
  normalizedUrl: string,
  url: string,
  transcript: { id: string; transcriptText: string; title: string | null; channelId: string | null; publishedAt: Date | null; metadataJson: unknown },
): Promise<VideoIngestResult> {
  const md = transcript.metadataJson as Record<string, unknown> | null;
  const meta: VideoMeta = {
    videoId,
    title: transcript.title ?? (md?.title as string) ?? undefined,
    channelId: transcript.channelId ?? (md?.channelId as string) ?? undefined,
    channelTitle: (md?.channelTitle as string) ?? undefined,
    publishedAt: transcript.publishedAt ? transcript.publishedAt.toISOString() : (md?.publishedAt as string) ?? undefined,
  };

  let source = await db.youTubeSource.findUnique({ where: { externalId: videoId } });
  if (!source) {
    source = await db.youTubeSource.create({
      data: { type: "video", url, normalizedUrl, externalId: videoId },
    });
  }

  const job = await db.youTubeIngestJob.create({
    data: {
      sourceType: "video",
      sourceId: source.id,
      status: TRANSCRIPT_STATUS.FETCHING,
      startedAt: new Date(),
    },
  });

  let proposalId: string | null = null;
  let proposalFailed = false;
  let proposalError: string | null = null;
  try {
    const proposal = await generateLearningProposal(transcript.id, transcript.transcriptText, meta);
    proposalId = proposal.id;
  } catch (err) {
    proposalFailed = true;
    proposalError = err instanceof Error ? err.message : String(err);
    ytLog("error", "learning proposal retry failed", { videoId, error: proposalError });
  }

  let jobStatus: string = proposalFailed ? TRANSCRIPT_STATUS.PROPOSAL_FAILED : TRANSCRIPT_STATUS.TRANSCRIBED;
  if (proposalId) {
    const prop = await db.learningProposal.findUnique({ where: { id: proposalId }, select: { status: true } });
    jobStatus = prop?.status ?? TRANSCRIPT_STATUS.TRANSCRIBED;
  }

  await db.youTubeIngestJob.update({
    where: { id: job.id },
    data: {
      status: jobStatus,
      attempts: 1,
      providerUsed: "proposal-retry",
      completedAt: new Date(),
      ...(proposalFailed && proposalError ? { lastError: proposalError } : {}),
      runSummaryJson: {
        providersTried: ["proposal-retry"],
        errors: [],
        transcriptLength: transcript.transcriptText.length,
        proposalId,
        ...(proposalError ? { proposalError } : {}),
      },
    },
  });

  ytLog("info", "proposal retry complete", { videoId, proposalId, jobStatus });
  return {
    ok: true,
    videoId,
    jobId: job.id,
    transcriptId: transcript.id,
    proposalId,
    status: jobStatus,
    providerUsed: "proposal-retry",
    error: null,
    attempts: 1,
  };
}

export async function ingestVideo(url: string): Promise<VideoIngestResult> {
  const validation = validateVideoUrl(url);
  if (!validation.ok) {
    return {
      ok: false,
      videoId: "",
      jobId: null,
      transcriptId: null,
      proposalId: null,
      status: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT,
      providerUsed: null,
      error: validation.error,
      attempts: 0,
    };
  }

  const { videoId, normalizedUrl } = validation;
  ytLog("info", "starting video ingest", { videoId, url: normalizedUrl });

  // De-dupe: if transcript already exists with a proposal, skip
  const existing = await db.youTubeTranscript.findUnique({
    where: { videoId },
    include: { learningProposals: { take: 1 } },
  });
  if (existing && existing.transcriptStatus === TRANSCRIPT_STATUS.TRANSCRIBED && existing.learningProposals.length > 0) {
    ytLog("info", "video already ingested, skipping", { videoId });
    return {
      ok: true,
      videoId,
      jobId: null,
      transcriptId: existing.id,
      proposalId: existing.learningProposals[0]!.id,
      status: "ALREADY_INGESTED",
      providerUsed: existing.providerUsed,
      error: null,
      attempts: 0,
    };
  }

  // Transcript exists but no proposal — retry proposal generation (e.g. after PROPOSAL_FAILED)
  if (existing && existing.transcriptStatus === TRANSCRIPT_STATUS.TRANSCRIBED) {
    return runProposalRetry(videoId, normalizedUrl, url, existing);
  }

  // Create or find source record
  let source = await db.youTubeSource.findUnique({ where: { externalId: videoId } });
  if (!source) {
    source = await db.youTubeSource.create({
      data: {
        type: "video",
        url,
        normalizedUrl,
        externalId: videoId,
      },
    });
  }

  // Create ingest job
  const job = await db.youTubeIngestJob.create({
    data: {
      sourceType: "video",
      sourceId: source.id,
      status: TRANSCRIPT_STATUS.FETCHING,
      startedAt: new Date(),
    },
  });

  // Resolve transcript through provider chain
  const resolved = await resolveTranscript(videoId);

  if (!resolved.success) {
    const errorSummary = resolved.errors
      .map((e) => `${e.provider}: ${e.error}`)
      .join("; ");

    await db.youTubeIngestJob.update({
      where: { id: job.id },
      data: {
        status: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT,
        attempts: resolved.attempts,
        providerUsed: resolved.providersTried.join(","),
        lastError: errorSummary,
        completedAt: new Date(),
      },
    });

    // Store a failed transcript record for visibility
    if (!existing) {
      await db.youTubeTranscript.create({
        data: {
          videoId,
          sourceUrl: normalizedUrl,
          transcriptText: "",
          providerUsed: resolved.providersTried.join(","),
          transcriptStatus: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT,
          failureReason: errorSummary,
        },
      });
    }

    ytLog("error", "video ingest failed", { videoId, attempts: resolved.attempts, error: errorSummary });
    return {
      ok: false,
      videoId,
      jobId: job.id,
      transcriptId: null,
      proposalId: null,
      status: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT,
      providerUsed: resolved.providersTried.join(","),
      error: errorSummary,
      attempts: resolved.attempts,
    };
  }

  // Build transcript text
  const { segments, meta: rawMeta, language, provider, confidence } = resolved.success;
  const meta = { ...rawMeta };

  // If title is still the fallback "Video {id}", fetch the real title from YouTube
  if (!meta.title || meta.title === `Video ${videoId}`) {
    try {
      const watchRes = await globalThis.fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ClientEngine/1.0)" },
        signal: AbortSignal.timeout(5000),
      });
      if (watchRes.ok) {
        const html = await watchRes.text();
        const titleMatch = html.match(/<title>(.+?)<\/title>/);
        if (titleMatch?.[1]) {
          const realTitle = titleMatch[1]
            .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
            .replace(/ - YouTube$/, "").trim();
          if (realTitle) meta.title = realTitle;
        }
      }
    } catch {
      ytLog("warn", "failed to fetch real title (non-blocking)", { videoId });
    }
  }

  const transcriptText = segments.map((s: TranscriptSegment) => s.text).join("\n");
  const transcriptHash = hashTranscript(transcriptText);
  const durationSeconds = segments.length > 0
    ? Math.ceil((segments[segments.length - 1]!.start ?? 0) + (segments[segments.length - 1]!.duration ?? 0))
    : null;

  // Update or create transcript
  const transcript = existing
    ? await db.youTubeTranscript.update({
        where: { videoId },
        data: {
          transcriptText,
          transcriptSegmentsJson: segments as unknown as undefined,
          language: language ?? null,
          durationSeconds,
          providerUsed: provider,
          transcriptHash,
          transcriptStatus: TRANSCRIPT_STATUS.TRANSCRIBED,
          failureReason: null,
          title: meta.title ?? null,
          channelId: meta.channelId ?? null,
          publishedAt: meta.publishedAt ? new Date(meta.publishedAt) : null,
          metadataJson: { ...meta, confidence } as unknown as undefined,
        },
      })
    : await db.youTubeTranscript.create({
        data: {
          videoId,
          sourceUrl: normalizedUrl,
          title: meta.title ?? null,
          channelId: meta.channelId ?? null,
          transcriptText,
          transcriptSegmentsJson: segments as unknown as undefined,
          language: language ?? null,
          durationSeconds,
          providerUsed: provider,
          transcriptHash,
          transcriptStatus: TRANSCRIPT_STATUS.TRANSCRIBED,
          metadataJson: { ...meta, confidence } as unknown as undefined,
        },
      });

  // Update source with metadata
  await db.youTubeSource.update({
    where: { id: source.id },
    data: {
      title: meta.title ?? source.title,
      channelName: meta.channelTitle ?? source.channelName,
      channelId: meta.channelId ?? source.channelId,
    },
  });

  // Generate learning proposal (auto-categorized)
  let proposalId: string | null = null;
  let proposalFailed = false;
  let proposalError: string | null = null;
  try {
    const proposal = await generateLearningProposal(transcript.id, transcriptText, meta);
    proposalId = proposal.id;
  } catch (err) {
    proposalFailed = true;
    proposalError = err instanceof Error ? err.message : String(err);
    ytLog("error", "learning proposal generation failed", {
      videoId,
      error: proposalError,
    });
  }

  // Determine job status from the actual proposal status (auto-categorized)
  let jobStatus: string = proposalFailed
    ? TRANSCRIPT_STATUS.PROPOSAL_FAILED
    : TRANSCRIPT_STATUS.TRANSCRIBED;
  if (proposalId) {
    const prop = await db.learningProposal.findUnique({
      where: { id: proposalId },
      select: { status: true },
    });
    jobStatus = prop?.status ?? TRANSCRIPT_STATUS.TRANSCRIBED;
  }

  // Update job to completed
  await db.youTubeIngestJob.update({
    where: { id: job.id },
    data: {
      status: jobStatus,
      attempts: resolved.attempts,
      providerUsed: provider,
      completedAt: new Date(),
      ...(proposalFailed && proposalError ? { lastError: proposalError } : {}),
      runSummaryJson: {
        providersTried: resolved.providersTried,
        errors: resolved.errors,
        transcriptLength: transcriptText.length,
        segmentCount: segments.length,
        durationSeconds,
        proposalId,
        ...(proposalError ? { proposalError } : {}),
      },
    },
  });

  ytLog("info", "video ingest complete", {
    videoId,
    provider,
    segments: segments.length,
    textLength: transcriptText.length,
    proposalId,
    jobStatus,
  });

  return {
    ok: true,
    videoId,
    jobId: job.id,
    transcriptId: transcript.id,
    proposalId,
    status: jobStatus,
    providerUsed: provider,
    error: null,
    attempts: resolved.attempts,
  };
}
