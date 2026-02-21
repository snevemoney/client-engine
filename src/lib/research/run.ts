/**
 * Research Engine R1: discover → dedupe → create lead + RESEARCH_SNAPSHOT → runPipelineIfEligible.
 * Single entrypoint for cron or POST /api/research/run.
 */
import { db } from "@/lib/db";
import { runPipelineIfEligible } from "@/lib/pipeline/runPipeline";
import { formatStepFailureNotes } from "@/lib/pipeline/error-classifier";
import { notifyNewProposalsReady } from "@/lib/notify";
import { canonicalizeSourceUrl } from "./canonicalize";
import { shouldSkipLowSignal } from "./filter";
import { rssAdapter } from "./adapters/rss";
import { upworkAdapter } from "./adapters/upwork";
import type { RawOpportunity, ResearchRunReport } from "./types";

const RESEARCH_SNAPSHOT_TITLE = "RESEARCH_SNAPSHOT";
const RESEARCH_RUN_REPORT_TITLE = "RESEARCH_RUN_REPORT";
const SYSTEM_LEAD_SOURCE = "system";
const SYSTEM_LEAD_TITLE = "Research Engine Runs";

const ADAPTERS = [upworkAdapter, rssAdapter];

function nowIso(): string {
  return new Date().toISOString();
}

async function getOrCreateSystemLead(): Promise<string> {
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

export type RunResearchOptions = {
  limit?: number;
};

/**
 * Run one research cycle: discover from adapters, dedupe, create leads + RESEARCH_SNAPSHOT,
 * trigger pipeline for each. Writes RESEARCH_RUN_REPORT artifact to system lead.
 */
export async function runResearchDiscoverAndPipeline(
  opts: RunResearchOptions = {}
): Promise<ResearchRunReport> {
  const enabled = process.env.RESEARCH_ENABLED === "1" || process.env.RESEARCH_ENABLED === "true";
  if (!enabled) {
    return {
      ok: true,
      at: nowIso(),
      discovered: 0,
      filtered: 0,
      skippedDedupe: 0,
      created: 0,
      errors: ["RESEARCH_ENABLED is not set to 1 or true"],
    };
  }

  const limit = opts.limit ?? Math.min(Number(process.env.RESEARCH_LIMIT_PER_RUN) || 10, 50);
  const report: ResearchRunReport = {
    ok: true,
    at: nowIso(),
    discovered: 0,
    filtered: 0,
    skippedDedupe: 0,
    created: 0,
    errors: [],
    leadIds: [],
  };

  const allCandidates: RawOpportunity[] = [];
  for (const adapter of ADAPTERS) {
    try {
      const items = await adapter.discover({ limit });
      allCandidates.push(...items);
    } catch (err) {
      const notes = formatStepFailureNotes(err);
      report.errors.push(`${adapter.name}: ${notes}`);
    }
  }
  report.discovered = allCandidates.length;

  const afterFilter: RawOpportunity[] = [];
  for (const it of allCandidates) {
    if (shouldSkipLowSignal(it.title, it.description)) {
      report.filtered++;
      continue;
    }
    if (!it.sourceUrl?.trim()) {
      report.filtered++;
      continue;
    }
    afterFilter.push(it);
  }

  const systemLeadId = await getOrCreateSystemLead();

  for (const it of afterFilter) {
    if (report.created >= limit) break;

    const canonicalUrl = canonicalizeSourceUrl(it.sourceUrl);
    const existing = await db.lead.findFirst({
      where: { sourceUrl: canonicalUrl },
      select: { id: true },
    });
    if (existing) {
      report.skippedDedupe++;
      continue;
    }

    try {
      const lead = await db.lead.create({
        data: {
          title: (it.title || "Research lead").slice(0, 160),
          source: "research",
          sourceUrl: canonicalUrl,
          description: (it.description || "").slice(0, 2000),
          tags: it.tags ?? [],
          techStack: [],
        },
      });

      await db.artifact.create({
        data: {
          leadId: lead.id,
          type: "research",
          title: RESEARCH_SNAPSHOT_TITLE,
          content: (it.description || it.title || "(no snapshot)").slice(0, 10000),
          meta: {
            sourceUrl: canonicalUrl,
            capturedAt: nowIso(),
            adapter: it.adapter,
            confidence: it.confidence ?? null,
          },
        },
      });

      runPipelineIfEligible(lead.id, "research_ingested").catch((err) => {
        console.error("[research] Pipeline run failed for lead", lead.id, err);
        report.errors.push(`pipeline ${lead.id}: ${formatStepFailureNotes(err)}`);
      });
      report.created++;
      report.leadIds = report.leadIds ?? [];
      report.leadIds.push(lead.id);
    } catch (err) {
      report.ok = false;
      report.errors.push(`create ${it.sourceUrl}: ${formatStepFailureNotes(err)}`);
    }
  }

  const reportContent = [
    `# Research Run Report`,
    ``,
    `- **At:** ${report.at}`,
    `- **Discovered:** ${report.discovered}`,
    `- **Filtered (low-signal):** ${report.filtered}`,
    `- **Skipped (dedupe):** ${report.skippedDedupe}`,
    `- **Created:** ${report.created}`,
    report.leadIds?.length ? `- **Lead IDs:** ${report.leadIds.join(", ")}` : "",
    report.errors.length ? `\n## Errors\n\n${report.errors.map((e) => `- ${e}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await db.artifact.create({
    data: {
      leadId: systemLeadId,
      type: "research",
      title: RESEARCH_RUN_REPORT_TITLE,
      content: reportContent,
      meta: {
        at: report.at,
        discovered: report.discovered,
        filtered: report.filtered,
        skippedDedupe: report.skippedDedupe,
        created: report.created,
        errors: report.errors,
      },
    },
  });

  if (report.created > 0 && report.leadIds?.length) {
    notifyNewProposalsReady(report.created, report.leadIds);
  }

  return report;
}
