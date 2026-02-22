/**
 * Knowledge Engine ingest: video/channel URL -> transcript -> summary -> insights -> improvement suggestions.
 * Uses system lead "Knowledge Engine Runs". Reuses learning transcript module.
 */

import { db } from "@/lib/db";
import { validateVideoUrl, fetchTranscript, discoverChannelVideos } from "@/lib/learning/transcript";
import { extractKnowledgeFromTranscript } from "./insights";
import { generateImprovementSuggestions, type ExistingPromotedSuggestion } from "./suggestions";
import {
  KNOWLEDGE_ARTIFACT_TYPES,
  type KnowledgeArtifactMetaBase,
  type KnowledgeRunReport,
  type KnowledgeInsightMeta,
  type ImprovementSuggestionMeta,
} from "./types";

const SYSTEM_LEAD_SOURCE = "system";
const SYSTEM_LEAD_TITLE = "Knowledge Engine Runs";

async function getOrCreateKnowledgeSystemLead(): Promise<string> {
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
  channelName?: string;
  channelId?: string;
};

/**
 * Ingest a single video: validate -> fetch transcript -> create transcript + summary artifacts ->
 * extract insights -> create KNOWLEDGE_INSIGHT -> generate IMPROVEMENT_SUGGESTION -> run report.
 */
export async function ingestVideo(opts: IngestVideoOptions): Promise<KnowledgeRunReport> {
  const at = nowIso();
  const report: KnowledgeRunReport = {
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
    const leadId = await getOrCreateKnowledgeSystemLead();
    await writeKnowledgeRunReport(leadId, report);
    return report;
  }

  const { videoUrl, videoId } = validated;
  const leadId = await getOrCreateKnowledgeSystemLead();
  const metaBase: KnowledgeArtifactMetaBase = {
    sourceUrl: videoUrl,
    videoId,
    videoTitle: undefined,
    channelName: opts.channelName,
    channelId: opts.channelId,
    capturedAt: at,
    tags: opts.tags ?? [],
  };

  const transcriptResult = await fetchTranscript(videoId, videoUrl);
  if (!transcriptResult.ok) {
    report.ok = false;
    report.errors.push(transcriptResult.error);
    await writeKnowledgeRunReport(leadId, report);
    return report;
  }

  const { segments, metadata } = transcriptResult;
  const transcriptText = segments.map((s) => s.text).join("\n");
  const videoTitle = metadata.title ?? videoId;
  const channelName = metadata.channelTitle ?? opts.channelName;
  const channelId = metadata.channelId ?? opts.channelId;
  const publishedAt = metadata.publishedAt;

  const metaWithTitle: KnowledgeArtifactMetaBase = {
    ...metaBase,
    videoTitle,
    channelName,
    channelId,
    publishedAt,
  };

  try {
    const transcriptArtifact = await db.artifact.create({
      data: {
        leadId,
        type: KNOWLEDGE_ARTIFACT_TYPES.YOUTUBE_VIDEO_TRANSCRIPT,
        title: `TRANSCRIPT_${videoId}`,
        content: transcriptText,
        meta: metaWithTitle,
      },
    });
    report.artifactIds.push(transcriptArtifact.id);

    const extraction = await extractKnowledgeFromTranscript(transcriptText);

    const summaryArtifact = await db.artifact.create({
      data: {
        leadId,
        type: KNOWLEDGE_ARTIFACT_TYPES.YOUTUBE_VIDEO_SUMMARY,
        title: `SUMMARY_${videoId}`,
        content: extraction.summary,
        meta: metaWithTitle,
      },
    });
    report.artifactIds.push(summaryArtifact.id);

    for (const ins of extraction.insights) {
      const insightMeta: KnowledgeInsightMeta = {
        ...metaWithTitle,
        categories: ins.categories,
        principle: ins.kind === "principle",
        tactical: ins.kind === "tactical",
        warning: ins.kind === "warning",
        metricsIdea: ins.kind === "metrics",
        bottleneckIdea: ins.kind === "bottleneck",
        websiteMonetization: ins.kind === "website_monetization",
        proposalSales: ins.kind === "proposal_sales",
      };
      const a = await db.artifact.create({
        data: {
          leadId,
          type: KNOWLEDGE_ARTIFACT_TYPES.KNOWLEDGE_INSIGHT,
          title: ins.kind,
          content: ins.text,
          meta: insightMeta,
        },
      });
      report.artifactIds.push(a.id);
    }

    const suggestions = await generateImprovementSuggestions(extraction, videoUrl);
    for (const s of suggestions) {
      const sugMeta: ImprovementSuggestionMeta = {
        ...metaWithTitle,
        problem: s.problem,
        proposedChange: s.proposedChange,
        expectedImpact: s.expectedImpact,
        effort: s.effort,
        systemArea: s.systemArea,
        sourceTranscriptRef: s.sourceTranscriptRef,
        sourceArtifactId: transcriptArtifact.id,
        status: "queued",
      };
      const a = await db.artifact.create({
        data: {
          leadId,
          type: KNOWLEDGE_ARTIFACT_TYPES.IMPROVEMENT_SUGGESTION,
          title: s.title,
          content: `${s.problem}\n\nProposed: ${s.proposedChange}\n\nImpact: ${s.expectedImpact}`,
          meta: sugMeta,
        },
      });
      report.artifactIds.push(a.id);
    }

    report.ingested = 1;
  } catch (e) {
    report.ok = false;
    report.errors.push(e instanceof Error ? e.message : "Ingest failed");
  }

  await writeKnowledgeRunReport(leadId, report);
  return report;
}

async function writeKnowledgeRunReport(leadId: string, report: KnowledgeRunReport): Promise<void> {
  const content = [
    `# Knowledge Run Report`,
    `- At: ${report.at}`,
    `- Source: ${report.sourceType}`,
    report.videoUrl ? `- Video: ${report.videoUrl}` : "",
    report.channelUrl ? `- Channel: ${report.channelUrl}` : "",
    `- Ingested: ${report.ingested}`,
    `- Skipped: ${report.skipped}`,
    report.errors.length ? `- Errors: ${report.errors.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const art = await db.artifact.create({
    data: {
      leadId,
      type: KNOWLEDGE_ARTIFACT_TYPES.KNOWLEDGE_RUN_REPORT,
      title: "KNOWLEDGE_RUN_REPORT",
      content,
      meta: report,
    },
  });
  report.artifactIds.push(art.id);
}

export type IngestChannelOptions = {
  channelUrl: string;
  maxVideos?: number;
  tags?: string[];
};

/**
 * Ingest a channel: discover videos -> dedupe -> ingest each; create YOUTUBE_CHANNEL_INDEX; one batch report.
 */
export async function ingestChannel(opts: IngestChannelOptions): Promise<KnowledgeRunReport> {
  const at = nowIso();
  const maxVideos = Math.min(opts.maxVideos ?? 10, 50);
  const report: KnowledgeRunReport = {
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
    const leadId = await getOrCreateKnowledgeSystemLead();
    await writeKnowledgeRunReport(leadId, report);
    return report;
  }

  report.discovered = discoverResult.videos.length;
  report.channelName = discoverResult.channelName ?? undefined;
  const leadId = await getOrCreateKnowledgeSystemLead();

  const indexContent = [
    `# Channel index: ${discoverResult.channelName ?? opts.channelUrl}`,
    `Captured: ${at}`,
    `Videos: ${discoverResult.videos.map((v) => `- ${v.title ?? v.videoId} ${v.videoUrl}`).join("\n")}`,
  ].join("\n");

  const indexMeta: KnowledgeArtifactMetaBase = {
    sourceUrl: opts.channelUrl,
    channelName: discoverResult.channelName,
    capturedAt: at,
    tags: opts.tags ?? [],
  };

  const indexArtifact = await db.artifact.create({
    data: {
      leadId,
      type: KNOWLEDGE_ARTIFACT_TYPES.YOUTUBE_CHANNEL_INDEX,
      title: `CHANNEL_INDEX_${opts.channelUrl.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60)}`,
      content: indexContent,
      meta: indexMeta,
    },
  });
  report.artifactIds.push(indexArtifact.id);

  const seenIds = new Set<string>();
  for (const v of discoverResult.videos) {
    if (seenIds.has(v.videoId)) {
      report.skipped++;
      continue;
    }
    seenIds.add(v.videoId);
    try {
      const videoReport = await ingestVideo({
        videoUrl: v.videoUrl,
        tags: opts.tags,
        channelName: discoverResult.channelName,
        channelId: undefined,
      });
      if (videoReport.ok) report.ingested++;
      else report.skipped++;
      report.artifactIds.push(...videoReport.artifactIds);
      report.errors.push(...videoReport.errors);
    } catch (e) {
      report.skipped++;
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  await writeKnowledgeRunReport(leadId, report);
  return report;
}

/** Get recent artifacts for API GET /api/knowledge and dashboard. */
export async function getRecentKnowledgeArtifacts(opts?: { limit?: number }) {
  const limit = opts?.limit ?? 20;
  const lead = await db.lead.findFirst({
    where: { source: SYSTEM_LEAD_SOURCE, title: SYSTEM_LEAD_TITLE },
    select: { id: true },
  });
  if (!lead) {
    return { runs: [], transcripts: [], summaries: [], insights: [], suggestions: [] };
  }

  const [runs, transcripts, summaries, insights, suggestions] = await Promise.all([
    db.artifact.findMany({
      where: { leadId: lead.id, type: KNOWLEDGE_ARTIFACT_TYPES.KNOWLEDGE_RUN_REPORT },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, content: true, meta: true, createdAt: true },
    }),
    db.artifact.findMany({
      where: { leadId: lead.id, type: KNOWLEDGE_ARTIFACT_TYPES.YOUTUBE_VIDEO_TRANSCRIPT },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, content: true, meta: true, createdAt: true },
    }),
    db.artifact.findMany({
      where: { leadId: lead.id, type: KNOWLEDGE_ARTIFACT_TYPES.YOUTUBE_VIDEO_SUMMARY },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, content: true, meta: true, createdAt: true },
    }),
    db.artifact.findMany({
      where: { leadId: lead.id, type: KNOWLEDGE_ARTIFACT_TYPES.KNOWLEDGE_INSIGHT },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, content: true, meta: true, createdAt: true },
    }),
    db.artifact.findMany({
      where: { leadId: lead.id, type: KNOWLEDGE_ARTIFACT_TYPES.IMPROVEMENT_SUGGESTION },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, content: true, meta: true, createdAt: true },
    }),
  ]);

  return { runs, transcripts, summaries, insights, suggestions };
}

/** Counts for today: new transcripts, insights, suggestions (for Knowledge Queue card). */
export async function getKnowledgeQueueCounts(): Promise<{
  transcriptsToday: number;
  insightsToday: number;
  suggestionsToday: number;
  suggestionQueuedTotal: number;
}> {
  const lead = await db.lead.findFirst({
    where: { source: SYSTEM_LEAD_SOURCE, title: SYSTEM_LEAD_TITLE },
    select: { id: true },
  });
  if (!lead) {
    return { transcriptsToday: 0, insightsToday: 0, suggestionsToday: 0, suggestionQueuedTotal: 0 };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [transcriptsToday, insightsToday, suggestionsToday, allSuggestions] = await Promise.all([
    db.artifact.count({
      where: {
        leadId: lead.id,
        type: KNOWLEDGE_ARTIFACT_TYPES.YOUTUBE_VIDEO_TRANSCRIPT,
        createdAt: { gte: todayStart },
      },
    }),
    db.artifact.count({
      where: {
        leadId: lead.id,
        type: KNOWLEDGE_ARTIFACT_TYPES.KNOWLEDGE_INSIGHT,
        createdAt: { gte: todayStart },
      },
    }),
    db.artifact.count({
      where: {
        leadId: lead.id,
        type: KNOWLEDGE_ARTIFACT_TYPES.IMPROVEMENT_SUGGESTION,
        createdAt: { gte: todayStart },
      },
    }),
    db.artifact.findMany({
      where: { leadId: lead.id, type: KNOWLEDGE_ARTIFACT_TYPES.IMPROVEMENT_SUGGESTION },
      select: { meta: true },
    }),
  ]);
  const suggestionQueuedTotal = allSuggestions.filter((a) => (a.meta as { status?: string })?.status === "queued").length;

  return {
    transcriptsToday,
    insightsToday,
    suggestionsToday,
    suggestionQueuedTotal,
  };
}

/** Concise knowledge context for operator chatbot: what we learned, what to improve, bottleneck/website ideas. */
export async function getKnowledgeContextForChat(limit = 3): Promise<string> {
  const { summaries, suggestions } = await getRecentKnowledgeArtifacts({ limit });
  if (summaries.length === 0 && suggestions.length === 0) return "";

  const lines: string[] = ["--- KNOWLEDGE (YouTube transcript learning) ---"];
  summaries.slice(0, limit).forEach((s, i) => {
    lines.push(`Summary ${i + 1}: ${s.content.slice(0, 180)}${s.content.length > 180 ? "…" : ""}`);
  });
  suggestions.slice(0, limit).forEach((s, i) => {
    const meta = s.meta as { systemArea?: string; expectedImpact?: string } | null;
    lines.push(`Suggestion ${i + 1}: ${s.title}. Area: ${meta?.systemArea ?? "—"}. Impact: ${meta?.expectedImpact?.slice(0, 80) ?? s.content.slice(0, 80)}…`);
  });
  lines.push("");
  return lines.join("\n");
}

/** Top improvement suggestions by expected impact (for card). We use creation order; meta.expectedImpact could be used for sort later. */
export async function getTopImprovementSuggestions(limit = 5) {
  const lead = await db.lead.findFirst({
    where: { source: SYSTEM_LEAD_SOURCE, title: SYSTEM_LEAD_TITLE },
    select: { id: true },
  });
  if (!lead) return [];

  return db.artifact.findMany({
    where: { leadId: lead.id, type: KNOWLEDGE_ARTIFACT_TYPES.IMPROVEMENT_SUGGESTION },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, title: true, content: true, meta: true, createdAt: true },
  });
}

/** Pending URL queue for autopilot workday run. */
export type PendingKnowledgeUrl = { id: string; url: string; type: "video" | "channel"; maxVideos?: number };

export async function getPendingKnowledgeUrls(limit = 10): Promise<PendingKnowledgeUrl[]> {
  const lead = await db.lead.findFirst({
    where: { source: SYSTEM_LEAD_SOURCE, title: SYSTEM_LEAD_TITLE },
    select: { id: true },
  });
  if (!lead) return [];

  const artifacts = await db.artifact.findMany({
    where: { leadId: lead.id, type: KNOWLEDGE_ARTIFACT_TYPES.PENDING_KNOWLEDGE_URL },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, content: true, meta: true },
  });

  const pending: PendingKnowledgeUrl[] = [];
  for (const a of artifacts) {
    const meta = a.meta as { type?: string; maxVideos?: number } | null;
    const url = a.content?.trim();
    if (!url) continue;
    const type: "video" | "channel" = meta?.type === "channel" ? "channel" : "video";
    pending.push({ id: a.id, url, type, maxVideos: meta?.maxVideos });
  }
  return pending;
}

export async function addPendingKnowledgeUrl(
  url: string,
  type: "video" | "channel",
  maxVideos?: number
): Promise<void> {
  const leadId = await getOrCreateKnowledgeSystemLead();
  await db.artifact.create({
    data: {
      leadId,
      type: KNOWLEDGE_ARTIFACT_TYPES.PENDING_KNOWLEDGE_URL,
      title: `PENDING_${type}_${url.slice(0, 50)}`,
      content: url.trim(),
      meta: { type, maxVideos: type === "channel" ? maxVideos ?? 10 : undefined },
    },
  });
}

export async function deletePendingKnowledgeUrl(artifactId: string): Promise<void> {
  await db.artifact.delete({ where: { id: artifactId } }).catch(() => {});
}

/**
 * Process up to cap pending URLs (for workday run). Returns summary for report.
 */
export async function processPendingKnowledgeQueue(cap: number = 3): Promise<{
  processed: number;
  ingested: number;
  errors: string[];
}> {
  const pending = await getPendingKnowledgeUrls(cap);
  const result = { processed: 0, ingested: 0, errors: [] as string[] };

  for (const item of pending) {
    result.processed++;
    try {
      if (item.type === "channel") {
        const report = await ingestChannel({ channelUrl: item.url, maxVideos: item.maxVideos ?? 5 });
        if (report.ok) result.ingested += report.ingested ?? 0;
        else result.errors.push(...report.errors);
      } else {
        const report = await ingestVideo({ videoUrl: item.url });
        if (report.ok) result.ingested++;
        else result.errors.push(...report.errors);
      }
      await deletePendingKnowledgeUrl(item.id);
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return result;
}
