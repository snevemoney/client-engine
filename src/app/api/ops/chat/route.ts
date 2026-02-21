import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildBrief } from "@/lib/orchestrator/brief";
import { getConstraintSnapshot } from "@/lib/ops/constraint";
import { getLatestOperatorBrief } from "@/lib/ops/operatorBrief";
import { getExecutiveBriefContext } from "@/lib/ops/executiveBrief";
import { getRecentOperatorFeedbackNotes } from "@/lib/ops/feedback";
import { getLearningContextForChat } from "@/lib/learning/ingest";
import { getKnowledgeContextForChat } from "@/lib/knowledge/ingest";
import { getTopRoiSummariesForChat } from "@/lib/revenue/roi";
import { chat } from "@/lib/llm";

export async function POST(req: NextRequest) {
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

  const [brief, execContext, latestBrief, feedbackNotes, learningContext, knowledgeContext, roiContext] = await Promise.all([
    buildBrief(),
    getExecutiveBriefContext(),
    getLatestOperatorBrief(),
    getRecentOperatorFeedbackNotes(3),
    getLearningContextForChat(3),
    getKnowledgeContextForChat(3),
    getTopRoiSummariesForChat(3),
  ]);

  const context = [
    "You are an Executive Operator AI for the Client Engine. Answer like a strategist: direct, specific, grounded in the data below. No hype. You can answer: what happened today? what is the bottleneck? what should I do first? which leads are strongest? where am I leaking money? what should I post as proof? what should I fix before turning up lead volume? If uncertain, say what's missing. Prioritize actions that move revenue.",
    "",
    "--- MONEY SCORECARD ---",
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
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { content } = await chat(
      [
        { role: "system", content: context },
        { role: "user", content: message },
      ],
      { temperature: 0.3, max_tokens: 600 }
    );

    const suggestedActions: { label: string; href: string }[] = [
      { label: "Start workday automation", href: "/dashboard/command" },
      { label: "Review results / brief", href: "/dashboard/command" },
      { label: "Proposals", href: "/dashboard/proposals" },
      { label: "Learning / improvement proposals", href: "/dashboard/learning" },
      { label: "Knowledge / suggestions", href: "/dashboard/knowledge" },
      { label: "Metrics / retry failed", href: "/dashboard/metrics" },
      { label: "Generate proof post", href: "/dashboard/proof" },
      { label: "Generate checklist", href: "/dashboard/checklist" },
    ];

    return NextResponse.json({ reply: content, suggestedActions });
  } catch (err) {
    console.error("[ops/chat]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
