/**
 * AI extraction: learning summary, principles, actions from transcript.
 */

import { chat } from "@/lib/llm";
import type { TranscriptSegment } from "./types";

export type LearningExtraction = {
  summary: string;
  principles: string[];
  actions: string[];
};

function segmentsToText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim().slice(0, 12000);
}

export async function extractLearning(segments: TranscriptSegment[]): Promise<LearningExtraction> {
  const text = segmentsToText(segments);
  if (!text) {
    return { summary: "No transcript content.", principles: [], actions: [] };
  }

  const systemPrompt = `You are an expert at extracting actionable learning from video transcripts for a client engine / sales ops system.
Output valid JSON only, no markdown fences, with keys: summary (string), principles (array of strings), actions (array of strings).
- summary: 2-4 sentences capturing the main insight.
- principles: 3-7 short principles or frameworks mentioned (one per item).
- actions: 3-7 concrete actions the operator could take (one per item).
Be concise. No hype. Focus on systems, bottlenecks, conversion, and operator leverage.`;

  const userPrompt = `Transcript excerpt:\n\n${text}\n\nExtract summary, principles, and actions as JSON.`;

  const { content } = await chat(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    { temperature: 0.3, max_tokens: 1024 }
  );

  try {
    const parsed = JSON.parse(content.trim()) as LearningExtraction;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "—",
      principles: Array.isArray(parsed.principles) ? parsed.principles.filter((p): p is string => typeof p === "string") : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions.filter((a): a is string => typeof a === "string") : [],
    };
  } catch {
    return {
      summary: content.slice(0, 500) || "—",
      principles: [],
      actions: [],
    };
  }
}
