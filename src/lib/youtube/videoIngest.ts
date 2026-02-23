/**
 * Single video ingestion pipeline.
 *
 * Flow: validate URL → de-dupe → create source + job → resolve transcript → store → trigger learning proposal.
 * NEVER auto-applies anything. All proposals require human review.
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

  // De-dupe: if transcript already exists, skip
  const existing = await db.youTubeTranscript.findUnique({ where: { videoId } });
  if (existing && existing.transcriptStatus === TRANSCRIPT_STATUS.TRANSCRIBED) {
    ytLog("info", "video already ingested, skipping", { videoId });
    return {
      ok: true,
      videoId,
      jobId: null,
      transcriptId: existing.id,
      proposalId: null,
      status: "ALREADY_INGESTED",
      providerUsed: existing.providerUsed,
      error: null,
      attempts: 0,
    };
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
  const { segments, meta, language, provider, confidence } = resolved.success;
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

  // Generate learning proposal (human-gated)
  let proposalId: string | null = null;
  try {
    const proposal = await generateLearningProposal(transcript.id, transcriptText, meta);
    proposalId = proposal.id;
  } catch (err) {
    ytLog("warn", "learning proposal generation failed (non-blocking)", {
      videoId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Update job to completed
  await db.youTubeIngestJob.update({
    where: { id: job.id },
    data: {
      status: proposalId ? TRANSCRIPT_STATUS.READY_FOR_REVIEW : TRANSCRIPT_STATUS.TRANSCRIBED,
      attempts: resolved.attempts,
      providerUsed: provider,
      completedAt: new Date(),
      runSummaryJson: {
        providersTried: resolved.providersTried,
        errors: resolved.errors,
        transcriptLength: transcriptText.length,
        segmentCount: segments.length,
        durationSeconds,
        proposalId,
      },
    },
  });

  ytLog("info", "video ingest complete", {
    videoId,
    provider,
    segments: segments.length,
    textLength: transcriptText.length,
    proposalId,
  });

  return {
    ok: true,
    videoId,
    jobId: job.id,
    transcriptId: transcript.id,
    proposalId,
    status: proposalId ? TRANSCRIPT_STATUS.READY_FOR_REVIEW : TRANSCRIPT_STATUS.TRANSCRIBED,
    providerUsed: provider,
    error: null,
    attempts: resolved.attempts,
  };
}
