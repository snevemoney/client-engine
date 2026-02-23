/**
 * Knowledge insights → IMPROVEMENT_SUGGESTION artifacts.
 * Structured suggestions for Leads/Proposals/Metrics/Chatbot/Website etc.; status queued; no auto-apply.
 * Includes contradiction checks against promoted knowledge and source weighting.
 */

import { chat } from "@/lib/llm";
import type {
  ImprovementSuggestionSystemArea,
  ImprovementSuggestionEffort,
  ConfidenceTier,
} from "./types";
import type { KnowledgeExtraction } from "./insights";

const SYSTEM_AREAS: ImprovementSuggestionSystemArea[] = [
  "Leads",
  "Proposals",
  "Metrics",
  "Chatbot",
  "Website",
  "Command Center",
  "Research",
  "Pipeline",
  "Other",
];

const CONFIDENCE_TIERS: ConfidenceTier[] = ["high", "medium", "low"];

export type ExistingPromotedSuggestion = {
  title: string;
  proposedChange: string;
  systemArea: string;
};

export type ImprovementSuggestionPayload = {
  title: string;
  problem: string;
  proposedChange: string;
  expectedImpact: string;
  effort: ImprovementSuggestionEffort;
  systemArea: ImprovementSuggestionSystemArea;
  sourceTranscriptRef: string;
  status: "queued";
  confidenceTier: ConfidenceTier;
};

export async function generateImprovementSuggestions(
  extraction: KnowledgeExtraction,
  sourceRef: string,
  existingPromoted?: ExistingPromotedSuggestion[]
): Promise<ImprovementSuggestionPayload[]> {
  if (extraction.insights.length === 0) return [];

  const insightsBlob = extraction.insights
    .map((i) => `[${i.kind}] ${i.text} (${i.categories.join(", ")})`)
    .join("\n");

  const contradictionBlock =
    existingPromoted && existingPromoted.length > 0
      ? `\n\nEXISTING PROMOTED KNOWLEDGE (applied/reviewed). Do NOT suggest anything that contradicts or duplicates these:\n${existingPromoted.map((p) => `- [${p.systemArea}] ${p.title}: ${p.proposedChange}`).join("\n")}\n\nAvoid contradictions. Prefer complementary suggestions.`
      : "";

  const systemPrompt = `You are an expert at turning transcript insights into concrete improvement suggestions for a client engine (leads, proposals, metrics, chatbot, website, command center). No auto-apply: suggestions are queued for human review.
Output valid JSON only, no markdown fences: an array of objects. Each object has: title, problem, proposedChange, expectedImpact, effort ("S"|"M"|"L"), systemArea (one of: ${SYSTEM_AREAS.join(", ")}), sourceTranscriptRef (string, use the exact ref provided), status ("queued"), confidenceTier ("high"|"medium"|"low" — use "high" only when clearly well-supported by transcript, "medium" for typical, "low" when speculative).
Generate 1-5 suggestions. Focus on highest impact. sourceTranscriptRef must be the exact string provided. Do not contradict existing promoted knowledge.${contradictionBlock}`;

  const userPrompt = `Source reference: ${sourceRef}\n\nInsights:\n${insightsBlob}\n\nSummary: ${extraction.summary}\n\nGenerate improvement suggestions as a JSON array.`;

  const { content } = await chat(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    { temperature: 0.3, max_tokens: 1024 }
  );

  try {
    const parsed = JSON.parse(content.trim());
    const arr = Array.isArray(parsed) ? parsed : [];
    const result: ImprovementSuggestionPayload[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const t = item as Record<string, unknown>;
      const title = typeof t.title === "string" ? t.title : "Improvement";
      const problem = typeof t.problem === "string" ? t.problem : "";
      const proposedChange = typeof t.proposedChange === "string" ? t.proposedChange : "";
      const expectedImpact = typeof t.expectedImpact === "string" ? t.expectedImpact : "";
      const effort = ["S", "M", "L"].includes(t.effort as string) ? (t.effort as ImprovementSuggestionEffort) : "M";
      const systemArea = typeof t.systemArea === "string" && SYSTEM_AREAS.includes(t.systemArea as ImprovementSuggestionSystemArea)
        ? (t.systemArea as ImprovementSuggestionSystemArea)
        : "Other";
      const confidenceTier = typeof t.confidenceTier === "string" && CONFIDENCE_TIERS.includes(t.confidenceTier as ConfidenceTier)
        ? (t.confidenceTier as ConfidenceTier)
        : "medium";
      result.push({
        title,
        problem,
        proposedChange,
        expectedImpact,
        effort,
        systemArea,
        sourceTranscriptRef: sourceRef,
        status: "queued",
        confidenceTier,
      });
    }
    return result.slice(0, 5);
  } catch {
    return [];
  }
}
