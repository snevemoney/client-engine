import { db } from "@/lib/db";
import { isDryRun } from "@/lib/pipeline/dry-run";
import { normalizeUsage } from "@/lib/pipeline/usage";
import type {
  WebResearchRequest,
  WebResearchResult,
  WebResearchMode,
  DeepResearchBrief,
  CompetitiveResearchBrief,
  TechnicalResearchBrief,
  ScrapedPage,
} from "./types";
import { WebResearchRequestSchema } from "./types";
import { dryRunWebResearch } from "./dry-run";
import { runDeepResearch } from "./modes/deep";
import { runCompetitiveResearch } from "./modes/competitive";
import { runTechnicalResearch } from "./modes/technical";
import type { ChatUsage } from "@/lib/llm";

type Brief = DeepResearchBrief | CompetitiveResearchBrief | TechnicalResearchBrief;

/**
 * Format a research brief as markdown for the artifact content field.
 */
function formatBriefMarkdown(
  mode: WebResearchMode,
  brief: Brief,
  title: string,
  sourcesCount: number,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `# Web Research Brief: ${title}`,
    `**Mode:** ${mode} | **Sources:** ${sourcesCount} | **Date:** ${date}`,
    "",
  ];

  if ("summary" in brief) {
    lines.push("## Summary", brief.summary, "");
  }

  if ("keyFindings" in brief && brief.keyFindings.length > 0) {
    lines.push("## Key Findings");
    for (const f of brief.keyFindings) {
      lines.push(`- **${f.finding}** (source: ${f.source}, confidence: ${f.confidence})`);
    }
    lines.push("");
  }

  if ("targetCompany" in brief) {
    const t = brief.targetCompany;
    lines.push("## Target Company", `**${t.name}** — ${t.description}`, `Positioning: ${t.positioning}`, "");
    if (brief.competitors.length > 0) {
      lines.push("## Competitors");
      for (const c of brief.competitors) {
        lines.push(`### ${c.name}`);
        lines.push(`- **Positioning:** ${c.positioning}`);
        if (c.strengths.length) lines.push(`- **Strengths:** ${c.strengths.join(", ")}`);
        if (c.weaknesses.length) lines.push(`- **Weaknesses:** ${c.weaknesses.join(", ")}`);
        if (c.pricing) lines.push(`- **Pricing:** ${c.pricing}`);
      }
      lines.push("");
    }
    if (brief.marketGaps.length > 0) {
      lines.push("## Market Gaps");
      for (const g of brief.marketGaps) lines.push(`- ${g}`);
      lines.push("");
    }
    if (brief.differentiationAngles.length > 0) {
      lines.push("## Differentiation Angles");
      for (const a of brief.differentiationAngles) lines.push(`- ${a}`);
      lines.push("");
    }
  }

  if ("bestPractices" in brief && brief.bestPractices.length > 0) {
    lines.push("## Best Practices");
    for (const bp of brief.bestPractices) {
      lines.push(`- **${bp.practice}** — ${bp.rationale} (${bp.source})`);
    }
    lines.push("");
  }

  if ("toolComparisons" in brief && brief.toolComparisons.length > 0) {
    lines.push("## Tool Comparisons");
    for (const tc of brief.toolComparisons) {
      lines.push(`### ${tc.tool}`);
      lines.push(`- **Pros:** ${tc.pros.join(", ")}`);
      lines.push(`- **Cons:** ${tc.cons.join(", ")}`);
      lines.push(`- **Recommendation:** ${tc.recommendation}`);
    }
    lines.push("");
  }

  if ("opportunities" in brief && brief.opportunities.length > 0) {
    lines.push("## Opportunities");
    for (const o of brief.opportunities) lines.push(`- ${o}`);
    lines.push("");
  }

  if ("risks" in brief && brief.risks.length > 0) {
    lines.push("## Risks");
    for (const r of brief.risks) lines.push(`- ${r}`);
    lines.push("");
  }

  if ("recommendations" in brief && brief.recommendations.length > 0) {
    lines.push("## Recommendations");
    brief.recommendations.forEach((r, i) => {
      const clean = r.replace(/^\d+\.\s*/, "");
      lines.push(`${i + 1}. ${clean}`);
    });
    lines.push("");
  }

  if ("citations" in brief && brief.citations.length > 0) {
    lines.push("## Citations");
    for (const c of brief.citations) {
      lines.push(`- [${c.title}](${c.url}) — ${c.domain} (relevance: ${c.relevance})`);
    }
  }

  return lines.join("\n");
}

/**
 * Main entrypoint for web research.
 * Never throws — catches and returns { ok: false, errors }.
 */
export async function runWebResearch(request: WebResearchRequest): Promise<WebResearchResult> {
  const start = Date.now();
  const mode = request.mode;

  // Validate request
  const parsed = WebResearchRequestSchema.safeParse(request);
  if (!parsed.success) {
    return {
      ok: false,
      mode,
      sourcesScraped: 0,
      totalTokensUsed: 0,
      costEstimate: 0,
      durationMs: Date.now() - start,
      errors: [parsed.error.issues.map((i) => i.message).join("; ")],
    };
  }

  const req = parsed.data;
  const leadId = "leadId" in req ? req.leadId : undefined;

  // Dry-run check
  if (isDryRun()) {
    return dryRunWebResearch(leadId, mode);
  }

  try {
    // Load lead context if leadId provided
    const queryOverride = "query" in req ? req.query : undefined;
    let title = queryOverride ?? "Research";
    let description: string | undefined;
    let techStack: string[] = [];
    let sourceUrl: string | undefined;

    if (leadId) {
      const lead = await db.lead.findUnique({
        where: { id: leadId },
        select: { title: true, description: true, techStack: true, sourceUrl: true },
      });
      if (!lead) {
        return {
          ok: false,
          mode,
          sourcesScraped: 0,
          totalTokensUsed: 0,
          costEstimate: 0,
          durationMs: Date.now() - start,
          errors: ["Lead not found"],
        };
      }
      title = queryOverride ?? lead.title;
      description = lead.description ?? undefined;
      techStack = lead.techStack ?? [];
      sourceUrl = lead.sourceUrl ?? undefined;
    }

    // Dispatch to mode orchestrator
    let brief: Brief;
    let pages: ScrapedPage[];
    let usage: ChatUsage;

    switch (mode) {
      case "deep": {
        const result = await runDeepResearch(req, { title, description, techStack });
        brief = result.brief;
        pages = result.pages;
        usage = result.usage;
        break;
      }
      case "competitive": {
        const targetUrl = req.targetUrl ?? sourceUrl;
        if (!targetUrl) {
          return {
            ok: false,
            mode,
            sourcesScraped: 0,
            totalTokensUsed: 0,
            costEstimate: 0,
            durationMs: Date.now() - start,
            errors: ["Competitive mode requires a targetUrl or lead with sourceUrl"],
          };
        }
        const result = await runCompetitiveResearch(req, { title, description, targetUrl });
        brief = result.brief;
        pages = result.pages;
        usage = result.usage;
        break;
      }
      case "technical": {
        const result = await runTechnicalResearch(req, {
          title,
          description,
          techStack,
          techContext: req.techContext,
        });
        brief = result.brief;
        pages = result.pages;
        usage = result.usage;
        break;
      }
    }

    // Format as markdown
    const content = formatBriefMarkdown(mode, brief, title, pages.length);

    // Cost tracking
    const norm = normalizeUsage(usage, "gpt-4o-mini");

    // Build meta
    const meta = {
      mode,
      sourcesScraped: pages.length,
      brief,
      pages: pages.map((p) => ({
        url: p.url,
        domain: p.domain,
        scrapedVia: p.scrapedVia,
      })),
      usage: { totalTokens: norm.tokensUsed, costEstimate: norm.costEstimate },
      provenance: {
        isDryRun: false,
        createdBy: "web-research" as const,
        stepName: "web-research" as const,
        model: "gpt-4o-mini",
        temperature: 0.3,
      },
    };

    // Store artifact if lead-attached
    let artifactId: string | undefined;
    if (leadId) {
      const artifact = await db.artifact.create({
        data: {
          leadId,
          type: "research",
          title: "WEB_RESEARCH_BRIEF",
          content,
          meta,
        },
      });
      artifactId = artifact.id;
    }

    return {
      ok: true,
      artifactId,
      mode,
      sourcesScraped: pages.length,
      totalTokensUsed: norm.tokensUsed,
      costEstimate: norm.costEstimate,
      durationMs: Date.now() - start,
      errors: [],
      // Include brief + content for standalone mode
      ...(leadId ? {} : { brief, content }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[web-research] Error:", err);
    return {
      ok: false,
      mode,
      sourcesScraped: 0,
      totalTokensUsed: 0,
      costEstimate: 0,
      durationMs: Date.now() - start,
      errors: [message],
    };
  }
}
