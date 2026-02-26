import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { getLeadIntelligenceForLead } from "@/lib/pipeline/getLeadIntelligenceForLead";
import { getLeadRoiEstimate } from "@/lib/revenue/roi";
import { getClientSuccessData } from "@/lib/client-success";
import { buildLeadCopilotPrompt } from "@/lib/copilot/buildLeadCopilotPrompt";

const CopilotRequestSchema = z.object({
  question: z.string().min(1).max(2000),
});

const ReceiptSchema = z.object({
  source: z.string(),
  note: z.string(),
});

const WhoNeedsToFeelSafeSchema = z.object({
  stakeholder: z.string(),
  why: z.string(),
  safetyNeed: z.string(),
});

const CopilotResponseSchema = z.object({
  verdict: z.string(),
  nextMove: z.string(),
  riskType: z.enum(["TRUST", "TECHNICAL", "MIXED"]),
  whoNeedsToFeelSafe: z.array(WhoNeedsToFeelSafeSchema).default([]),
  why: z.array(z.string()).min(0).max(6).default([]),
  risks: z.array(z.string()).default([]),
  safeguards: z.array(z.string()).default([]),
  questionsToAskNext: z.array(z.string()).default([]),
  suggestedMessage: z.string().optional(),
  receipts: z.array(ReceiptSchema).default([]),
  uncertainty: z.string().optional(),
});

export type CopilotResponse = z.infer<typeof CopilotResponseSchema>;

function parseJsonFromContent(content: string): unknown {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/m);
  const raw = fence ? fence[1]?.trim() ?? trimmed : trimmed;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedReq = CopilotRequestSchema.safeParse(body);
  if (!parsedReq.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsedReq.error.flatten() }, { status: 400 });
  }

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
        take: 5,
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

  const enrichArtifact = lead.artifacts.find((a) => a.type === "notes" && a.title === "AI Enrichment Report");
  const positioningArtifact = lead.artifacts.find((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");
  const proposalArtifact = lead.artifacts.find((a) => a.type === "proposal");

  const [leadIntelligence, roi, successData] = await Promise.all([
    getLeadIntelligenceForLead(leadId),
    getLeadRoiEstimate(leadId),
    getClientSuccessData(leadId),
  ]);

  const roiSummary = roi
    ? [roi.meta.whyNow, roi.meta.pilotRecommendation].filter(Boolean).join("; ")
    : null;
  const resultTarget = successData.resultTarget ?? null;
  const recentFailures = lead.pipelineRuns.map(
    (r) => `${r.lastErrorCode ?? "error"} at ${r.lastErrorAt?.toISOString() ?? "unknown"}`
  );

  const prompt = buildLeadCopilotPrompt({
    question: parsedReq.data.question,
    lead,
    enrichArtifact: enrichArtifact ?? null,
    positioningArtifact: positioningArtifact ?? null,
    proposalArtifact: proposalArtifact ?? null,
    leadIntelligence: leadIntelligence ?? null,
    roiSummary: roiSummary || null,
    resultTarget,
    recentFailures: recentFailures.length ? recentFailures : undefined,
  });

  try {
    const { content } = await chat(
      [
        { role: "system", content: "Reply with valid JSON only. No markdown code fences or extra text." },
        { role: "user", content: prompt },
      ],
      { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 1024 }
    );

    const raw = parseJsonFromContent(content ?? "");
    const parsed = CopilotResponseSchema.safeParse(raw);

    if (parsed.success) {
      return NextResponse.json(parsed.data);
    }

    return NextResponse.json(
      {
        verdict: content?.replace(/\n*```[\s\S]*$/m, "").trim() ?? "No response.",
        nextMove: "",
        riskType: "MIXED" as const,
        whoNeedsToFeelSafe: [],
        why: [],
        risks: [],
        safeguards: [],
        questionsToAskNext: [],
        receipts: [],
        uncertainty: "Response was not valid JSON; showing raw reply.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[leads/copilot]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Copilot failed" },
      { status: 500 }
    );
  }
}
