import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { parseLeadIntelligenceFromMeta } from "@/lib/lead-intelligence";
import { getLeadRoiEstimate } from "@/lib/revenue/roi";
import { getClientSuccessData } from "@/lib/client-success";

const QUESTION_PROMPTS: Record<string, string> = {
  best_next_move:
    "What is the single least risky next move for this lead? One concrete, reversible action. No list of options. Prefer: one small experiment, one sandbox, one rollback-safe step. Answer in 1–3 sentences.",
  whats_blocking:
    "What is blocking this lead from moving forward? Is it a technical problem or a trust problem? If both, what to fix first? Use only data from the lead and artifacts. One short paragraph.",
  derisk_proposal:
    "How do I de-risk this proposal? Consider: adoption risk, tool loyalty, reversibility, and who needs to feel safe. Give one concrete suggestion (e.g. reframe as pilot, add a rollback line, address a specific stakeholder).",
  what_to_ask_next:
    "What should I ask the client or prospect next? One specific question or message that would reduce uncertainty or move the deal. Base it on what's missing or unclear in the artifacts.",
};

export type CopilotResponse = {
  verdict: string;
  why?: string[];
  risks?: string[];
  whoNeedsToFeelSafe?: string[];
  whatToSayNext?: string;
  missingEvidence?: string[];
  confidence: "low" | "medium" | "high";
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;
  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const questionKey = (body.question || "best_next_move") as keyof typeof QUESTION_PROMPTS;
  const promptInstruction = QUESTION_PROMPTS[questionKey] ?? QUESTION_PROMPTS.best_next_move;

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      artifacts: {
        where: {
          OR: [
            { type: "notes", title: "AI Enrichment Report" },
            { type: "positioning", title: "POSITIONING_BRIEF" },
            { type: "proposal" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      pipelineRuns: {
        where: { success: false },
        orderBy: { lastErrorAt: "desc" },
        take: 2,
        select: { lastErrorCode: true, lastErrorAt: true },
      },
    },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const enrich = lead.artifacts.find((a) => a.type === "notes" && a.title === "AI Enrichment Report");
  const positioning = lead.artifacts.find((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");
  const proposal = lead.artifacts.find((a) => a.type === "proposal");
  const leadIntelligence =
    parseLeadIntelligenceFromMeta(positioning?.meta) ||
    (enrich?.meta ? parseLeadIntelligenceFromMeta(enrich.meta) : null);

  const [roi, successData] = await Promise.all([
    getLeadRoiEstimate(leadId),
    getClientSuccessData(leadId),
  ]);
  const resultTarget = successData.resultTarget ?? null;

  const contextParts: string[] = [
    `Lead: ${lead.title}`,
    `Status: ${lead.status}. Score: ${lead.score ?? "—"}.`,
    `Description: ${(lead.description || "").slice(0, 800)}`,
    lead.budget ? `Budget: ${lead.budget}` : "",
    lead.timeline ? `Timeline: ${lead.timeline}` : "",
  ];
  if (enrich?.content) contextParts.push(`Enrichment:\n${enrich.content.slice(0, 1200)}`);
  if (leadIntelligence) {
    contextParts.push(
      `Lead intelligence: Adoption ${leadIntelligence.adoptionRisk.level}; Tool loyalty ${leadIntelligence.toolLoyaltyRisk.level}; Reversibility: ${leadIntelligence.reversibility.strategy}. Stakeholders: ${leadIntelligence.stakeholderMap.map((s) => `${s.role}: ${s.caresAbout.join(", ")}`).join("; ")}`
    );
  }
  if (positioning?.content) contextParts.push(`Positioning brief (excerpt):\n${positioning.content.slice(0, 600)}`);
  if (proposal?.content) contextParts.push(`Proposal (excerpt):\n${proposal.content.slice(0, 800)}`);
  if (roi) contextParts.push(`ROI summary: ${[roi.meta.whyNow, roi.meta.pilotRecommendation].filter(Boolean).join("; ")}`);
  if (resultTarget) contextParts.push(`Result target: ${resultTarget.currentState} → ${resultTarget.targetState}`);
  if (lead.pipelineRuns.length > 0) {
    contextParts.push(
      `Recent pipeline failures: ${lead.pipelineRuns.map((r) => `${r.lastErrorCode ?? "error"} at ${r.lastErrorAt}`).join("; ")}`
    );
  }

  const systemPrompt = `You are a Lead Copilot for a freelance developer. Answer only from the provided lead and artifact data. No invented facts. Tone: senior solution architect. Short. No cheerleading. If uncertain, say "Unclear from artifacts" or "Need X to answer." Do not suggest auto-send, hype, or anything that violates money-path gates.`;

  const userPrompt = `Context for this lead:\n\n${contextParts.filter(Boolean).join("\n\n")}\n\n---\n\nQuestion: ${promptInstruction}\n\nRespond in 2-4 short sentences or bullets. Then on a new line write "CONFIDENCE: low|medium|high" based on how much the artifacts support your answer.`;

  try {
    const { content } = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 500 }
    );

    const confidenceMatch = content?.match(/CONFIDENCE:\s*(low|medium|high)/i);
    const confidence = (confidenceMatch?.[1]?.toLowerCase() as "low" | "medium" | "high") ?? "medium";
    const verdict = content?.replace(/\n*CONFIDENCE:\s*(low|medium|high).*$/i, "").trim() ?? "No response.";

    const response: CopilotResponse = {
      verdict,
      confidence,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[copilot/lead]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Copilot failed" },
      { status: 500 }
    );
  }
}
