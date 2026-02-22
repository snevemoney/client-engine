/**
 * YouTube ingestion pipeline — read queries for API + UI.
 */

import { db } from "@/lib/db";
import { TRANSCRIPT_STATUS } from "./types";

export async function getRecentJobs(opts?: { limit?: number; status?: string }) {
  const limit = Math.min(opts?.limit ?? 20, 100);
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;

  return db.youTubeIngestJob.findMany({
    where,
    orderBy: { queuedAt: "desc" },
    take: limit,
    include: {
      source: { select: { id: true, type: true, title: true, externalId: true, channelName: true } },
    },
  });
}

export async function getTranscripts(opts?: {
  limit?: number;
  status?: string;
  channelId?: string;
  provider?: string;
}) {
  const limit = Math.min(opts?.limit ?? 20, 100);
  const where: Record<string, unknown> = {};
  if (opts?.status) where.transcriptStatus = opts.status;
  if (opts?.channelId) where.channelId = opts.channelId;
  if (opts?.provider) where.providerUsed = opts.provider;

  return db.youTubeTranscript.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      videoId: true,
      channelId: true,
      sourceUrl: true,
      title: true,
      language: true,
      durationSeconds: true,
      providerUsed: true,
      transcriptStatus: true,
      failureReason: true,
      transcriptHash: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getFailedTranscripts(limit = 20) {
  return db.youTubeTranscript.findMany({
    where: { transcriptStatus: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      videoId: true,
      sourceUrl: true,
      title: true,
      providerUsed: true,
      failureReason: true,
      createdAt: true,
    },
  });
}

export async function getLearningProposals(opts?: { limit?: number; status?: string; category?: string; systemArea?: string }) {
  const limit = Math.min(opts?.limit ?? 20, 100);
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.category) where.category = opts.category;
  if (opts?.systemArea) where.systemArea = opts.systemArea;

  return db.learningProposal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      transcript: {
        select: { videoId: true, title: true, sourceUrl: true, channelId: true, providerUsed: true },
      },
    },
  });
}

export async function getProposalById(id: string) {
  return db.learningProposal.findUnique({
    where: { id },
    include: {
      transcript: {
        select: { videoId: true, title: true, sourceUrl: true, channelId: true, transcriptText: true },
      },
    },
  });
}

/**
 * Summary counts for Command Center card.
 */
export async function getYouTubeIngestSummary() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [transcriptsThisWeek, failedJobs, pendingProposals, promotedCount] = await Promise.all([
    db.youTubeTranscript.count({
      where: { createdAt: { gte: oneWeekAgo }, transcriptStatus: TRANSCRIPT_STATUS.TRANSCRIBED },
    }),
    db.youTubeIngestJob.count({
      where: { status: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT },
    }),
    db.learningProposal.count({
      where: { status: TRANSCRIPT_STATUS.READY_FOR_REVIEW },
    }),
    db.learningProposal.count({
      where: { status: TRANSCRIPT_STATUS.PROMOTED_TO_PLAYBOOK },
    }),
  ]);

  return { transcriptsThisWeek, failedJobs, pendingProposals, promotedCount };
}
