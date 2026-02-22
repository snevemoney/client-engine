/**
 * Workday run: research → pipeline for eligible leads → retry safe failures → report.
 * Used by POST /api/ops/workday-run. No auto-send, no auto-build.
 */

import { runResearchDiscoverAndPipeline } from "@/lib/research/run";
import { runPipelineIfEligible } from "@/lib/pipeline/runPipeline";
import { processPendingKnowledgeQueue } from "@/lib/knowledge/ingest";
import { db } from "@/lib/db";
import { getOrCreateSystemLead } from "./systemLead";
import type { WorkdayRunSummary } from "./types";

const PIPELINE_CAP = 20;
const RETRY_CAP = 5;
const KNOWLEDGE_QUEUE_CAP = 3;
const WORKDAY_RUN_REPORT_TITLE = "WORKDAY_RUN_REPORT";

function nowIso(): string {
  return new Date().toISOString();
}

export async function runWorkdayRun(): Promise<WorkdayRunSummary> {
  const at = nowIso();
  const summary: WorkdayRunSummary = {
    ok: true,
    at,
    research: { discovered: 0, created: 0, errors: [] },
    pipeline: { runs: 0, retries: 0, errors: [] },
  };

  try {
    const researchReport = await runResearchDiscoverAndPipeline({ limit: 50 });
    summary.research.discovered = researchReport.discovered;
    summary.research.created = researchReport.created ?? 0;
    summary.research.errors = researchReport.errors ?? [];
    if (!researchReport.ok && (researchReport.errors?.length ?? 0) > 0) {
      summary.ok = false;
    }
  } catch (err) {
    summary.ok = false;
    summary.research.errors.push(err instanceof Error ? err.message : String(err));
  }

  const eligibleLeads = await db.lead.findMany({
    where: {
      status: { not: "REJECTED" },
      project: null,
    },
    orderBy: { updatedAt: "desc" },
    take: PIPELINE_CAP,
    select: { id: true },
  });

  for (const lead of eligibleLeads) {
    try {
      const result = await runPipelineIfEligible(lead.id, "workday_run");
      if (result.run) summary.pipeline.runs++;
    } catch (err) {
      summary.ok = false;
      summary.pipeline.errors.push(
        `${lead.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const failedRetryable = await db.pipelineRun.findMany({
    where: {
      success: false,
      lastErrorCode: { in: ["OPENAI_429", "OPENAI_5XX", "OPENAI_NETWORK"] },
      retryCount: { lt: 3 },
    },
    orderBy: { lastErrorAt: "desc" },
    take: RETRY_CAP * 2,
    select: { leadId: true },
  });
  const leadIdsToRetry = [...new Set(failedRetryable.map((r) => r.leadId))].slice(0, RETRY_CAP);

  for (const leadId of leadIdsToRetry) {
    try {
      const result = await runPipelineIfEligible(leadId, "workday_retry");
      if (result.run) summary.pipeline.retries++;
    } catch (err) {
      summary.ok = false;
      summary.pipeline.errors.push(
        `retry ${leadId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  try {
    const knowledgeResult = await processPendingKnowledgeQueue(KNOWLEDGE_QUEUE_CAP);
    summary.knowledge = knowledgeResult;
    if (knowledgeResult.errors.length > 0) summary.ok = false;
  } catch (err) {
    summary.ok = false;
    summary.knowledge = { processed: 0, ingested: 0, errors: [err instanceof Error ? err.message : String(err)] };
  }

  const systemLeadId = await getOrCreateSystemLead();
  const reportLines = [
    `# Workday Run Report`,
    ``,
    `- **At:** ${summary.at}`,
    `- **Research:** discovered ${summary.research.discovered}, created ${summary.research.created}`,
    summary.research.errors.length ? `- **Research errors:** ${summary.research.errors.join("; ")}` : "",
    `- **Pipeline runs:** ${summary.pipeline.runs}`,
    `- **Retries:** ${summary.pipeline.retries}`,
    summary.pipeline.errors.length ? `- **Pipeline errors:** ${summary.pipeline.errors.join("; ")}` : "",
  ];
  if (summary.knowledge) {
    reportLines.push(
      `- **Knowledge queue:** processed ${summary.knowledge.processed}, ingested ${summary.knowledge.ingested}`,
      summary.knowledge.errors.length ? `- **Knowledge errors:** ${summary.knowledge.errors.join("; ")}` : ""
    );
  }
  const reportContent = reportLines.filter(Boolean).join("\n");

  const artifact = await db.artifact.create({
    data: {
      leadId: systemLeadId,
      type: "research",
      title: WORKDAY_RUN_REPORT_TITLE,
      content: reportContent,
      meta: {
        at: summary.at,
        research: summary.research,
        pipeline: summary.pipeline,
        knowledge: summary.knowledge,
      },
    },
  });
  summary.reportArtifactId = artifact.id;

  return summary;
}
