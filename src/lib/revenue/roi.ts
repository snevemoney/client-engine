/**
 * ROI estimate for a lead: grounded in artifacts, ranges + confidence, why now, pilot recommendation.
 * Stored as ROI_ESTIMATE artifact on the lead. No fake certainty; assumptions explicit.
 */

import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import type { RoiEstimate } from "./types";
import { ROI_ESTIMATE_ARTIFACT_TYPE } from "./types";

const POSITIONING_TITLE = "POSITIONING_BRIEF";
const RESEARCH_SNAPSHOT_TITLE = "RESEARCH_SNAPSHOT";

export async function estimateLeadRoi(leadId: string): Promise<{ artifactId: string; estimate: RoiEstimate }> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      artifacts: {
        where: {
          OR: [
            { type: "positioning", title: POSITIONING_TITLE },
            { type: "research", title: RESEARCH_SNAPSHOT_TITLE },
            { type: "notes" },
            { type: "proposal" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!lead) throw new Error("Lead not found");

  const positioning = lead.artifacts.find((a) => a.type === "positioning" && a.title === POSITIONING_TITLE);
  const research = lead.artifacts.find((a) => a.type === "research" && a.title === RESEARCH_SNAPSHOT_TITLE);
  const enrichment = lead.artifacts.find((a) => a.type === "notes" && a.title === "AI Enrichment Report");
  const proposalDraft = lead.artifacts.find((a) => a.type === "proposal");

  const contextParts: string[] = [];
  contextParts.push(`Lead: ${lead.title}`);
  if (lead.description) contextParts.push(`Description: ${lead.description.slice(0, 2000)}`);
  if (lead.budget) contextParts.push(`Budget: ${lead.budget}`);
  if (positioning?.content) contextParts.push(`Positioning: ${positioning.content.slice(0, 1500)}`);
  if (research?.content) contextParts.push(`Research snapshot: ${research.content.slice(0, 1000)}`);
  if (enrichment?.content) contextParts.push(`Enrichment: ${enrichment.content.slice(0, 1000)}`);
  if (proposalDraft?.content) contextParts.push(`Proposal draft (excerpt): ${proposalDraft.content.slice(0, 800)}`);

  const context = contextParts.join("\n\n---\n\n");

  const systemPrompt = `You are an expert at estimating ROI and risk for a freelance developer's client engagements.
Output valid JSON only, no markdown. Use this exact structure:
{
  "timeWasteEstimateHoursPerWeek": { "min": number, "max": number } or null,
  "toolCostWastePerMonth": { "min": number, "max": number } or null,
  "lostRevenueRiskPerMonth": { "min": number, "max": number } or null,
  "implementationEffortEstimate": "small" | "medium" | "large",
  "confidence": number between 0 and 1,
  "assumptions": [ "string", ... ],
  "whyNow": "one short paragraph grounded in the lead's situation",
  "pilotRecommendation": "14-30 day low-risk pilot description",
  "expectedPilotOutcome": [ "bullet string", ... ]
}
Rules:
- If data is weak, set confidence low (e.g. 0.3-0.5) and list assumptions explicitly.
- Never invent exact numbers without source support. Use ranges (e.g. 2-5 hours, $200-$800/mo).
- whyNow must be specific to this lead's problem/signals, not generic.
- pilotRecommendation should be a concrete 14-30 day first step.
- expectedPilotOutcome: 2-4 short bullets.`;

  const userPrompt = `Based on this lead context, produce the ROI estimate JSON.\n\n${context}`;

  const { content } = await chat(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    { temperature: 0.3, max_tokens: 1024 }
  );

  let estimate: RoiEstimate;
  try {
    const parsed = JSON.parse(content.trim().replace(/^```json?\s*|\s*```$/g, "")) as Record<string, unknown>;
    const numRange = (r: unknown): { min: number; max: number } | null => {
      if (r && typeof r === "object" && "min" in r && "max" in r)
        return { min: Number((r as { min: unknown }).min), max: Number((r as { max: unknown }).max) };
      return null;
    };
    estimate = {
      timeWasteEstimateHoursPerWeek: numRange(parsed.timeWasteEstimateHoursPerWeek),
      toolCostWastePerMonth: numRange(parsed.toolCostWastePerMonth),
      lostRevenueRiskPerMonth: numRange(parsed.lostRevenueRiskPerMonth),
      implementationEffortEstimate: ["small", "medium", "large"].includes(parsed.implementationEffortEstimate as string)
        ? (parsed.implementationEffortEstimate as RoiEstimate["implementationEffortEstimate"])
        : "medium",
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.filter((a): a is string => typeof a === "string") : [],
      whyNow: typeof parsed.whyNow === "string" ? parsed.whyNow : "Insufficient data to assess timing.",
      pilotRecommendation: typeof parsed.pilotRecommendation === "string" ? parsed.pilotRecommendation : "14-day discovery + one workflow pilot.",
      expectedPilotOutcome: Array.isArray(parsed.expectedPilotOutcome) ? parsed.expectedPilotOutcome.filter((x): x is string => typeof x === "string") : [],
    };
  } catch {
    estimate = {
      timeWasteEstimateHoursPerWeek: null,
      toolCostWastePerMonth: null,
      lostRevenueRiskPerMonth: null,
      implementationEffortEstimate: "medium",
      confidence: 0.3,
      assumptions: ["Parse failed; manual review recommended."],
      whyNow: "Insufficient data to assess timing.",
      pilotRecommendation: "14-day discovery + one workflow pilot.",
      expectedPilotOutcome: ["Clear scope", "One deliverable"],
    };
  }

  const contentMarkdown = [
    "# ROI Estimate",
    `Confidence: ${(estimate.confidence * 100).toFixed(0)}%`,
    "",
    "## Why now",
    estimate.whyNow,
    "",
    "## Pilot recommendation",
    estimate.pilotRecommendation,
    "",
    "## Expected pilot outcome",
    ...estimate.expectedPilotOutcome.map((b) => `- ${b}`),
    "",
    "## Assumptions",
    ...estimate.assumptions.map((a) => `- ${a}`),
    "",
    "## Ranges (when available)",
    estimate.timeWasteEstimateHoursPerWeek && `- Time waste: ${estimate.timeWasteEstimateHoursPerWeek.min}-${estimate.timeWasteEstimateHoursPerWeek.max} hrs/week`,
    estimate.toolCostWastePerMonth && `- Tool cost waste: $${estimate.toolCostWastePerMonth.min}-$${estimate.toolCostWastePerMonth.max}/mo`,
    estimate.lostRevenueRiskPerMonth && `- Lost revenue risk: $${estimate.lostRevenueRiskPerMonth.min}-$${estimate.lostRevenueRiskPerMonth.max}/mo`,
  ]
    .filter(Boolean)
    .join("\n");

  const existing = await db.artifact.findFirst({
    where: { leadId, type: ROI_ESTIMATE_ARTIFACT_TYPE },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content: contentMarkdown, meta: estimate },
    });
    return { artifactId: existing.id, estimate };
  }

  const artifact = await db.artifact.create({
    data: {
      leadId,
      type: ROI_ESTIMATE_ARTIFACT_TYPE,
      title: "ROI_ESTIMATE",
      content: contentMarkdown,
      meta: estimate,
    },
  });
  return { artifactId: artifact.id, estimate };
}

export async function getLeadRoiEstimate(leadId: string): Promise<{ id: string; content: string; meta: RoiEstimate } | null> {
  const a = await db.artifact.findFirst({
    where: { leadId, type: ROI_ESTIMATE_ARTIFACT_TYPE },
    orderBy: { createdAt: "desc" },
  });
  if (!a || !a.meta || typeof a.meta !== "object") return null;
  return { id: a.id, content: a.content, meta: a.meta as RoiEstimate };
}

/** Top ROI summaries for chatbot context (operator-grade answers). */
export async function getTopRoiSummariesForChat(limit: number = 3): Promise<string> {
  const leadsWithRoi = await db.artifact.findMany({
    where: { type: ROI_ESTIMATE_ARTIFACT_TYPE },
    orderBy: { createdAt: "desc" },
    take: limit * 2,
    select: { leadId: true, meta: true },
  });
  if (leadsWithRoi.length === 0) return "";
  const leadIds = [...new Set(leadsWithRoi.map((a) => a.leadId))].slice(0, limit);
  const leads = await db.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, title: true },
  });
  const lines: string[] = ["--- TOP ROI ESTIMATES ---"];
  for (const lead of leads) {
    const art = leadsWithRoi.find((a) => a.leadId === lead.id);
    if (!art?.meta || typeof art.meta !== "object") continue;
    const m = art.meta as RoiEstimate;
    lines.push(`${lead.title}: confidence ${(m.confidence * 100).toFixed(0)}%; why now: ${m.whyNow.slice(0, 100)}…`);
  }
  lines.push("");
  return lines.join("\n");
}
