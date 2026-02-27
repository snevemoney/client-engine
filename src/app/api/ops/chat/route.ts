import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withRouteTiming } from "@/lib/api-utils";
import { buildBrief } from "@/lib/orchestrator/brief";
import { getLatestOperatorBrief } from "@/lib/ops/operatorBrief";
import { getExecutiveBriefContext } from "@/lib/ops/executiveBrief";
import { getRecentOperatorFeedbackNotes } from "@/lib/ops/feedback";
import { getLearningContextForChat } from "@/lib/learning/ingest";
import { getKnowledgeContextForChat } from "@/lib/knowledge/ingest";
import { getTopRoiSummariesForChat } from "@/lib/revenue/roi";
import { getFailuresAndInterventions } from "@/lib/ops/failuresInterventions";
import { getOpsHealth } from "@/lib/ops/opsHealth";
import { getRegisteredActions } from "@/lib/ops/actions/registry";
import { chat } from "@/lib/llm";
import { searchArtifacts } from "@/lib/pinecone";

const LLM_RESPONSE_SCHEMA = z.object({
  answer: z.string(),
  data_gaps: z.array(z.string()).optional().default([]),
  sources_used: z.array(z.string()).optional().default([]),
  confidence: z.enum(["high", "medium", "low"]).optional().default("medium"),
});

type SuggestedAction =
  | { type: "link"; label: string; href: string }
  | {
      type: "executable";
      action: string;
      label: string;
      reason?: string;
      risk?: "low" | "medium" | "high";
      requiresApproval: boolean;
    };

function buildDynamicSuggestedActions(failures: {
  failedPipelineRunsCount: number;
}): SuggestedAction[] {
  const registered = getRegisteredActions();
  const actions: SuggestedAction[] = [];

  if (failures.failedPipelineRunsCount > 0 && registered.includes("retry_failed_pipeline_runs")) {
    actions.push({
      type: "executable",
      action: "retry_failed_pipeline_runs",
      label: `Retry ${failures.failedPipelineRunsCount} failed pipeline run(s)`,
      reason: "Pipeline runs failed with retryable errors (e.g. rate limit).",
      risk: "low",
      requiresApproval: true,
    });
  }

  if (failures.failedPipelineRunsCount > 0) {
    actions.push({ type: "link", label: "Open Metrics", href: "/dashboard/metrics" });
  }
  actions.push(
    { type: "link", label: "Open Command Center", href: "/dashboard/command" },
    { type: "link", label: "Open Proposals", href: "/dashboard/proposals" },
    { type: "link", label: "Open Learning", href: "/dashboard/learning" },
    { type: "link", label: "Open Knowledge", href: "/dashboard/knowledge" },
    { type: "link", label: "Open Proof", href: "/dashboard/proof" },
    { type: "link", label: "Open Checklist", href: "/dashboard/checklist" }
  );

  return actions;
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/ops/chat", async () => {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body with message required" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  const [
    brief,
    execContext,
    latestBrief,
    feedbackNotes,
    learningContext,
    knowledgeContext,
    roiContext,
    failures,
    opsHealth,
    semanticResults,
  ] = await Promise.all([
    buildBrief(),
    getExecutiveBriefContext(),
    getLatestOperatorBrief(),
    getRecentOperatorFeedbackNotes(3),
    getLearningContextForChat(3),
    getKnowledgeContextForChat(3),
    getTopRoiSummariesForChat(3),
    getFailuresAndInterventions(),
    getOpsHealth(),
    searchArtifacts(message, { topK: 3 }),
  ]);

  const failedPipelineRunsCount = failures.failedPipelineRuns.length;
  const suggested_actions = buildDynamicSuggestedActions({ failedPipelineRunsCount });

  const context = [
    "You are an Executive Operator AI for the Client Engine. Answer like a strategist: direct, specific, grounded in the data below. No hype.",
    "",
    "RESPONSE FORMAT: You MUST respond with valid JSON only, no markdown or extra text. Use this exact shape:",
    '{"answer":"...","data_gaps":["..."],"sources_used":["..."],"confidence":"high|medium|low"}',
    "- answer: Your reply (plain text or markdown). Cite sources in the text (e.g. \"Per money scorecard:\", \"Per brief:\"). When you don't have data, say \"Data missing: [what would be needed].\" Do not guess.",
    "- data_gaps: Array of strings describing what data is missing to answer fully (empty array if none).",
    "- sources_used: Array of which data blocks you used (e.g. \"moneyScorecard\", \"brief\", \"queue\", \"constraintSnapshot\", \"learning\", \"roi\").",
    "- confidence: \"high\" if data is complete, \"medium\" if partial, \"low\" if mostly inference.",
    "",
    "OPERATOR CONTEXT (use for sources_used):",
    `- Failed pipeline runs (last 24h): ${opsHealth.failedJobs.last24h}. Failed in last 7d: ${opsHealth.failedJobs.last7d}.`,
    failedPipelineRunsCount > 0
      ? `- There are ${failedPipelineRunsCount} failed pipeline run(s) that may be retryable.`
      : "",
    "",
    "--- MONEY SCORECARD (cite as \"per money scorecard\") ---",
    execContext.moneyScorecard,
    "",
    "--- STAGE CONVERSION ---",
    execContext.stageConversion,
    "",
    "--- PIPELINE LEAK ---",
    execContext.pipelineLeak,
    "",
    "--- REVENUE FORECAST ---",
    execContext.revenueForecast,
    "",
    "--- EXECUTIVE BRIEF ---",
    `Throughput: ${execContext.todaysThroughput}`,
    `Primary constraint: ${execContext.primaryConstraint}`,
    execContext.constraintPlaybook ? `Constraint playbook: ${execContext.constraintPlaybook}` : "",
    execContext.moneyOpportunityMissed ? `Money opportunity missed: ${execContext.moneyOpportunityMissed}` : "",
    `Top 3 actions tomorrow: ${execContext.top3ActionsTomorrow.join("; ") || "—"}`,
    `Biggest risk: ${execContext.biggestRisk}`,
    execContext.bestLeadToPrioritize ? `Best lead to prioritize: ${execContext.bestLeadToPrioritize}` : "",
    "",
    "--- QUEUE ---",
    `Qualified leads: ${brief.qualifiedLeads.length}. Ready proposals: ${brief.readyProposals.length}. Next actions: ${brief.nextActions.slice(0, 5).map((a) => `${a.title}: ${a.action}`).join("; ") || "None"}.`,
    brief.risks.length ? `Risks: ${brief.risks.join("; ")}` : "",
    latestBrief ? `Latest brief: ${latestBrief.summary}` : "",
    feedbackNotes.length ? `Recent operator feedback: ${feedbackNotes.map((n) => n.content.slice(0, 80)).join(" | ")}` : "",
    learningContext || "",
    knowledgeContext || "",
    roiContext || "",
    ...(semanticResults.length
      ? [
          "",
          "--- SEMANTIC SEARCH (related artifacts from knowledge base) ---",
          ...semanticResults.map(
            (r) => `[${r.title}] (relevance: ${r.score.toFixed(2)})\n${r.content.slice(0, 500)}`,
          ),
        ]
      : []),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { content } = await chat(
      [
        { role: "system", content: context },
        { role: "user", content: message },
      ],
      { temperature: 0.3, max_tokens: 800 }
    );

    let parsed: z.infer<typeof LLM_RESPONSE_SCHEMA>;
    const trimmed = content.trim().replace(/^```json?\s*|\s*```$/g, "");
    try {
      const parsedJson = JSON.parse(trimmed);
      const parseResult = LLM_RESPONSE_SCHEMA.safeParse(parsedJson);
      if (parseResult.success) {
        parsed = parseResult.data;
      } else {
        parsed = { answer: content, data_gaps: [], sources_used: [], confidence: "medium" };
      }
    } catch {
      parsed = { answer: content, data_gaps: [], sources_used: [], confidence: "medium" };
    }

    return NextResponse.json({
      reply: {
        answer: parsed.answer,
        data_gaps: parsed.data_gaps ?? [],
        sources_used: parsed.sources_used ?? [],
        confidence: parsed.confidence ?? "medium",
        suggested_actions,
      },
    });
  } catch (err) {
    console.error("[ops/chat]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
  });
}
