/**
 * Learning Engine ingest: video/channel URL → transcript → artifacts → run report.
 * Uses system lead "Learning Engine Runs" for all learning artifacts.
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { validateVideoUrl, fetchTranscript, discoverChannelVideos } from "./transcript";
import { extractLearning } from "./summarize";
import { generateImprovementProposal } from "./proposals";
import {
  LEARNING_ARTIFACT_TYPES,
  type LearningMetaBase,
  type LearningRunReport,
  type EngineImprovementProposal,
} from "./types";

const SYSTEM_LEAD_SOURCE = "system";
const SYSTEM_LEAD_TITLE = "Learning Engine Runs";

async function getOrCreateLearningSystemLead(): Promise<string> {
  const existing = await db.lead.findFirst({
    where: { source: SYSTEM_LEAD_SOURCE, title: SYSTEM_LEAD_TITLE },
    select: { id: true },
  });
  if (existing) return existing.id;
  const lead = await db.lead.create({
    data: { title: SYSTEM_LEAD_TITLE, source: SYSTEM_LEAD_SOURCE },
  });
  return lead.id;
}

function nowIso(): string {
  return new Date().toISOString();
}

export type IngestVideoOptions = {
  videoUrl: string;
  tags?: string[];
};

/**
 * Ingest a single video: validate URL → fetch transcript → create artifacts → AI extraction → proposal → run report.
 */
export async function ingestVideo(opts: IngestVideoOptions): Promise<LearningRunReport> {
  const at = nowIso();
  const report: LearningRunReport = {
    ok: true,
    at,
    sourceType: "video",
    videoUrl: opts.videoUrl,
    ingested: 0,
    skipped: 0,
    errors: [],
    artifactIds: [],
  };

  const validated = validateVideoUrl(opts.videoUrl);
  if (!validated.ok) {
    report.ok = false;
    report.errors.push(validated.error);
    const leadId = await getOrCreateLearningSystemLead();
    await writeLearningRunReport(leadId, report);
    return report;
  }

  const { videoUrl, videoId } = validated;
  const leadId = await getOrCreateLearningSystemLead();
  const metaBase: LearningMetaBase = {
    sourceType: "youtube",
    videoUrl,
    videoId,
    capturedAt: at,
    tags: opts.tags ?? [],
  };

  const transcriptResult = await fetchTranscript(videoId, videoUrl);
  if (!transcriptResult.ok) {
    report.ok = false;
    report.errors.push(transcriptResult.error);
    await writeLearningRunReport(leadId, report);
    return report;
  }

  const { segments, metadata } = transcriptResult;
  const transcriptText = segments.map((s) => s.text).join("\n");

  try {
    const [videoArtifact, transcriptArtifact] = await Promise.all([
      db.artifact.create({
        data: {
          leadId,
          type: LEARNING_ARTIFACT_TYPES.YOUTUBE_VIDEO,
          title: metadata.title ?? videoId,
          content: metadata.description ?? "",
          meta: {
            ...metaBase,
            channelId: metadata.channelId,
            channelName: metadata.channelTitle,
            publishedAt: metadata.publishedAt,
          },
        },
      }),
      db.artifact.create({
        data: {
          leadId,
          type: LEARNING_ARTIFACT_TYPES.YOUTUBE_TRANSCRIPT,
          title: `TRANSCRIPT_${videoId}`,
          content: transcriptText,
          meta: metaBase,
        },
      }),
    ]);
    report.artifactIds.push(videoArtifact.id, transcriptArtifact.id);
  } catch (e) {
    report.ok = false;
    report.errors.push(e instanceof Error ? e.message : "Failed to create video/transcript artifacts");
    await writeLearningRunReport(leadId, report);
    return report;
  }

  let extraction: Awaited<ReturnType<typeof extractLearning>>;
  try {
    extraction = await extractLearning(segments);
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : "Extraction failed");
    report.ok = false;
    await writeLearningRunReport(leadId, report);
    return report;
  }

  try {
    const summaryArtifact = await db.artifact.create({
      data: {
        leadId,
        type: LEARNING_ARTIFACT_TYPES.LEARNING_SUMMARY,
        title: `SUMMARY_${videoId}`,
        content: extraction.summary,
        meta: metaBase,
      },
    });
    report.artifactIds.push(summaryArtifact.id);
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : "Failed to create summary artifact");
  }

  try {
    const principlesArtifact = await db.artifact.create({
      data: {
        leadId,
        type: LEARNING_ARTIFACT_TYPES.LEARNING_PRINCIPLES,
        title: `PRINCIPLES_${videoId}`,
        content: extraction.principles.join("\n"),
        meta: { ...metaBase, principles: extraction.principles },
      },
    });
    report.artifactIds.push(principlesArtifact.id);
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : "Failed to create principles artifact");
  }

  try {
    const actionsArtifact = await db.artifact.create({
      data: {
        leadId,
        type: LEARNING_ARTIFACT_TYPES.LEARNING_ACTIONS,
        title: `ACTIONS_${videoId}`,
        content: extraction.actions.join("\n"),
        meta: { ...metaBase, actions: extraction.actions },
      },
    });
    report.artifactIds.push(actionsArtifact.id);
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : "Failed to create actions artifact");
  }

  let proposalResult: Awaited<ReturnType<typeof generateImprovementProposal>>;
  try {
    proposalResult = await generateImprovementProposal(extraction, metadata, videoUrl);
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : "Proposal generation failed");
    report.ok = false;
    await writeLearningRunReport(leadId, report);
    return report;
  }

  try {
    const proposalArtifact = await db.artifact.create({
      data: {
        leadId,
        type: LEARNING_ARTIFACT_TYPES.ENGINE_IMPROVEMENT_PROPOSAL,
        title: proposalResult.proposal.title,
        content: proposalResult.markdown,
        meta: { ...metaBase, proposal: proposalResult.proposal } as Prisma.InputJsonValue,
      },
    });
    report.artifactIds.push(proposalArtifact.id);
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : "Failed to create proposal artifact");
  }

  report.ingested = 1;
  await writeLearningRunReport(leadId, report);
  return report;
}

async function writeLearningRunReport(leadId: string, report: LearningRunReport): Promise<void> {
  const content = [
    `# Learning Run Report`,
    ``,
    `- **At:** ${report.at}`,
    `- **Source:** ${report.sourceType}${report.videoUrl ? ` ${report.videoUrl}` : ""}${report.channelUrl ? ` ${report.channelUrl}` : ""}`,
    `- **Ingested:** ${report.ingested}`,
    report.discovered != null ? `- **Discovered:** ${report.discovered}` : "",
    `- **Skipped:** ${report.skipped}`,
    report.errors.length ? `\n## Errors\n\n${report.errors.map((e) => `- ${e}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await db.artifact.create({
    data: {
      leadId,
      type: LEARNING_ARTIFACT_TYPES.LEARNING_RUN_REPORT,
      title: "LEARNING_RUN_REPORT",
      content,
      meta: {
        at: report.at,
        sourceType: report.sourceType,
        videoUrl: report.videoUrl,
        channelUrl: report.channelUrl,
        ingested: report.ingested,
        discovered: report.discovered,
        skipped: report.skipped,
        errors: report.errors,
        artifactIds: report.artifactIds,
      },
    },
  });
}

/**
 * GET recent ingests and proposal artifacts (for API GET /api/learning).
 */
export async function getRecentLearningArtifacts(opts?: { limit?: number }) {
  const limit = opts?.limit ?? 20;
  const lead = await db.lead.findFirst({
    where: { source: SYSTEM_LEAD_SOURCE, title: SYSTEM_LEAD_TITLE },
    select: { id: true },
  });
  if (!lead) return { runs: [], proposals: [], summaries: [] };

  const [runs, proposals, summaries] = await Promise.all([
    db.artifact.findMany({
      where: { leadId: lead.id, type: LEARNING_ARTIFACT_TYPES.LEARNING_RUN_REPORT },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, content: true, meta: true, createdAt: true },
    }),
    db.artifact.findMany({
      where: { leadId: lead.id, type: LEARNING_ARTIFACT_TYPES.ENGINE_IMPROVEMENT_PROPOSAL },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, content: true, meta: true, createdAt: true },
    }),
    db.artifact.findMany({
      where: { leadId: lead.id, type: LEARNING_ARTIFACT_TYPES.LEARNING_SUMMARY },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, content: true, meta: true, createdAt: true },
    }),
  ]);

  return { runs, proposals, summaries };
}

/**
 * Lightweight summary for Command Center "Learning Inbox" card.
 */
export async function getLearningInboxSummary(): Promise<{
  proposalCount: number;
  latestSource: string | null;
}> {
  const lead = await db.lead.findFirst({
    where: { source: SYSTEM_LEAD_SOURCE, title: SYSTEM_LEAD_TITLE },
    select: { id: true },
  });
  if (!lead)
    return { proposalCount: 0, latestSource: null };

  const [proposalCount, latestProposal, latestRun] = await Promise.all([
    db.artifact.count({
      where: { leadId: lead.id, type: LEARNING_ARTIFACT_TYPES.ENGINE_IMPROVEMENT_PROPOSAL },
    }),
    db.artifact.findFirst({
      where: { leadId: lead.id, type: LEARNING_ARTIFACT_TYPES.ENGINE_IMPROVEMENT_PROPOSAL },
      orderBy: { createdAt: "desc" },
      select: { meta: true },
    }),
    db.artifact.findFirst({
      where: { leadId: lead.id, type: LEARNING_ARTIFACT_TYPES.LEARNING_RUN_REPORT },
      orderBy: { createdAt: "desc" },
      select: { meta: true, content: true },
    }),
  ]);

  const fromProposal = latestProposal?.meta && typeof latestProposal.meta === "object" && "proposal" in latestProposal.meta
    ? (latestProposal.meta as { proposal?: { sourceVideo?: string; sourceChannel?: string } }).proposal?.sourceChannel
      ?? (latestProposal.meta as { proposal?: { sourceVideo?: string } }).proposal?.sourceVideo
    : null;
  const fromRun = latestRun?.meta && typeof latestRun.meta === "object"
    ? (latestRun.meta as { channelName?: string; channelUrl?: string; videoUrl?: string }).channelName
      ?? (latestRun.meta as { channelUrl?: string }).channelUrl
      ?? (latestRun.meta as { videoUrl?: string }).videoUrl
    : null;
  const latestSource = fromProposal ?? fromRun ?? null;

  return { proposalCount, latestSource: typeof latestSource === "string" ? latestSource : null };
}

const LEARNING_CHAT_LIMIT = 3;

/**
 * Concise learning context for operator chatbot (top N summaries + proposals).
 */
export async function getLearningContextForChat(limit: number = LEARNING_CHAT_LIMIT): Promise<string> {
  const { summaries, proposals } = await getRecentLearningArtifacts({ limit });
  if (summaries.length === 0 && proposals.length === 0) return "";

  const lines: string[] = ["--- RECENT LEARNING (video/channel ingest) ---"];
  summaries.slice(0, limit).forEach((s, i) => {
    lines.push(`Summary ${i + 1}: ${s.content.slice(0, 200)}${s.content.length > 200 ? "…" : ""}`);
  });
  proposals.slice(0, limit).forEach((p, i) => {
    const meta = p.meta as { proposal?: EngineImprovementProposal } | null;
    const prop = meta?.proposal;
    const title = p.title || prop?.title || "Proposal";
    const insight = prop?.insightType ?? "—";
    const change = prop?.proposedChange?.slice(0, 120) ?? p.content.slice(0, 120);
    lines.push(`Proposal ${i + 1} [${insight}]: ${title}. Change: ${change}${(prop?.proposedChange?.length ?? p.content.length) > 120 ? "…" : ""}`);
  });
  lines.push("");
  return lines.join("\n");
}

export type IngestChannelOptions = {
  channelUrl: string;
  maxVideos?: number;
  tags?: string[];
};

/**
 * Ingest a channel: discover videos → dedupe by videoId → ingest each → one batch run report.
 */
export async function ingestChannel(opts: IngestChannelOptions): Promise<LearningRunReport> {
  const at = nowIso();
  const maxVideos = Math.min(opts.maxVideos ?? 10, 50);
  const report: LearningRunReport = {
    ok: true,
    at,
    sourceType: "channel",
    channelUrl: opts.channelUrl,
    discovered: 0,
    ingested: 0,
    skipped: 0,
    errors: [],
    artifactIds: [],
  };

  const discoverResult = await discoverChannelVideos(opts.channelUrl, maxVideos);
  if (!discoverResult.ok) {
    report.ok = false;
    report.errors.push(discoverResult.error);
    const leadId = await getOrCreateLearningSystemLead();
    await writeLearningRunReport(leadId, report);
    return report;
  }

  report.discovered = discoverResult.videos.length;
  const leadId = await getOrCreateLearningSystemLead();

  const seenIds = new Set<string>();
  for (const v of discoverResult.videos) {
    if (seenIds.has(v.videoId)) {
      report.skipped++;
      continue;
    }
    seenIds.add(v.videoId);
    try {
      const videoReport = await ingestVideo({ videoUrl: v.videoUrl, tags: opts.tags });
      if (videoReport.ok) {
        report.ingested++;
        report.artifactIds.push(...videoReport.artifactIds);
      } else {
        report.skipped++;
        report.errors.push(...videoReport.errors);
      }
    } catch (e) {
      report.skipped++;
      report.errors.push(`${v.videoId}: ${e instanceof Error ? e.message : "Ingest failed"}`);
    }
  }

  report.ok = report.errors.length === 0;
  await writeLearningRunReport(leadId, report);
  return report;
}

export { getOrCreateLearningSystemLead };
