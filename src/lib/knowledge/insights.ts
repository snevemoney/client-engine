/**
 * Transcript -> KNOWLEDGE_INSIGHT extraction.
 * Key principles, tactical steps, warnings, metrics/bottleneck/website/proposal ideas; tagged by category.
 */

import { chat } from "@/lib/llm";
import type { KnowledgeInsightCategory } from "./types";

const CATEGORIES: KnowledgeInsightCategory[] = [
  "sales", "ops", "marketing", "delivery", "offer", "automation", "constraint", "mindset",
];

export type ExtractedInsight = {
  text: string;
  categories: KnowledgeInsightCategory[];
  kind: "principle" | "tactical" | "warning" | "metrics" | "bottleneck" | "website_monetization" | "proposal_sales";
};

export type KnowledgeExtraction = {
  summary: string;
  insights: ExtractedInsight[];
};

function truncateTranscript(text: string, maxLen = 12000): string {
  return text.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export async function extractKnowledgeFromTranscript(transcriptText: string): Promise<KnowledgeExtraction> {
  const text = truncateTranscript(transcriptText);
  if (!text) return { summary: "No transcript content.", insights: [] };

  const systemPrompt = `You extract actionable knowledge from video transcripts for a client engine / sales ops system.
Output valid JSON only, no markdown. Keys: summary (string), insights (array of objects).
Each insight: "text" (string), "categories" (array from: ${CATEGORIES.join(", ")}), "kind" (one of: principle, tactical, warning, metrics, bottleneck, website_monetization, proposal_sales).
Extract: principles, tactical steps, warnings, metrics ideas, bottleneck ideas, website monetization ideas, proposal/sales improvements. Tag each with 1-3 categories. Max 15 insights.`;

  const userPrompt = `Transcript:\n\n${text}\n\nExtract as JSON.`;

  const { content } = await chat(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    { temperature: 0.3, max_tokens: 2048 }
  );

  try {
    const parsed = JSON.parse(content.trim()) as { summary?: string; insights?: unknown[] };
    const summary = typeof parsed.summary === "string" ? parsed.summary : "—";
    const insights: ExtractedInsight[] = [];
    for (const item of Array.isArray(parsed.insights) ? parsed.insights : []) {
      if (!item || typeof item !== "object" || typeof (item as { text?: unknown }).text !== "string") continue;
      const obj = item as { text: string; categories?: unknown; kind?: string };
      const categories = Array.isArray(obj.categories)
        ? obj.categories.filter((c): c is KnowledgeInsightCategory => typeof c === "string" && CATEGORIES.includes(c as KnowledgeInsightCategory))
        : [];
      const kind = ["principle", "tactical", "warning", "metrics", "bottleneck", "website_monetization", "proposal_sales"].includes(obj.kind ?? "")
        ? obj.kind as ExtractedInsight["kind"]
        : "principle";
      insights.push({ text: obj.text, categories: categories.slice(0, 3), kind });
    }
    return { summary, insights };
  } catch {
    return { summary: content.slice(0, 500) || "—", insights: [] };
  }
}
