/**
 * Learning Proposal Generator.
 *
 * Transcript → summary → claims/ideas → classification → system area mapping → action proposal.
 * All proposals are READY_FOR_REVIEW. Nothing auto-applies.
 *
 * GUARDRAILS:
 *   - No direct self-modification from transcripts
 *   - No automatic prompt overwrites
 *   - No automatic SOP replacements
 *   - All learning changes require human review
 */

import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import type { VideoMeta, ProposalCategory, SystemArea, ProducedAssetType, ExpectedImpact } from "./types";
import {
  PROPOSAL_CATEGORIES,
  SYSTEM_AREAS,
  PRODUCED_ASSET_TYPES,
  EXPECTED_IMPACTS,
  TRANSCRIPT_STATUS,
  ytLog,
} from "./types";

type ProposalLLMOutput = {
  summary: string;
  extractedPoints: string[];
  category: ProposalCategory;
  systemArea: SystemArea;
  contradictions: string[];
  proposedActions: Array<{
    type: "prompt_update" | "sop_draft" | "checklist_item" | "script_improvement" | "template_improvement" | "no_action";
    description: string;
  }>;
  producedAssetType: ProducedAssetType;
  expectedImpact: ExpectedImpact;
  revenueLink: string;
};

const SYSTEM_PROMPT = `You are an expert operations analyst for a private operator intelligence pipeline.
You analyze YouTube video transcripts and produce structured learning proposals.

The operator runs a freelance → leverage → product path. Everything maps to:
- **Acquire** (prospecting, approach/contact, follow-up, referral, positioning)
- **Deliver** (client workflows, quality, speed, results)
- **Improve** (reusable assets, playbooks, leverage score, process refinement)

Output ONLY valid JSON (no markdown fences) with these exact keys:
- summary: 2-4 sentence summary of the key insight
- extractedPoints: array of 3-7 short claims/ideas (strings)
- category: one of ${PROPOSAL_CATEGORIES.join("|")}
- systemArea: one of ${SYSTEM_AREAS.join("|")}
- contradictions: array of strings (existing playbook contradictions, empty if none)
- proposedActions: array of objects with {type, description} where type is one of: prompt_update|sop_draft|checklist_item|script_improvement|template_improvement|no_action
- producedAssetType: one of ${PRODUCED_ASSET_TYPES.join("|")}
- expectedImpact: one of ${EXPECTED_IMPACTS.join("|")}
- revenueLink: short text describing revenue/leverage connection (e.g. "improves follow-up discipline", "faster proposal turnaround")

If the transcript does not create a likely benefit, set producedAssetType to "knowledge_only" and proposedActions to [{type: "no_action", description: "Knowledge capture only"}].

Be specific. No hype. Focus on systems, bottlenecks, conversion, and operator leverage.`;

function truncateForLLM(text: string, maxChars = 12000): string {
  return text.length > maxChars ? text.slice(0, maxChars) + "\n[...truncated]" : text;
}

function validateCategory(val: string): ProposalCategory {
  return PROPOSAL_CATEGORIES.includes(val as ProposalCategory) ? (val as ProposalCategory) : "operations";
}

function validateSystemArea(val: string): SystemArea {
  return SYSTEM_AREAS.includes(val as SystemArea) ? (val as SystemArea) : "Improve";
}

function validateAssetType(val: string): ProducedAssetType {
  return PRODUCED_ASSET_TYPES.includes(val as ProducedAssetType) ? (val as ProducedAssetType) : "knowledge_only";
}

function validateImpact(val: string): ExpectedImpact {
  return EXPECTED_IMPACTS.includes(val as ExpectedImpact) ? (val as ExpectedImpact) : "improve";
}

/**
 * Generate a learning proposal from a transcript. Stores in DB as READY_FOR_REVIEW.
 */
export async function generateLearningProposal(
  transcriptId: string,
  transcriptText: string,
  meta: VideoMeta,
): Promise<{ id: string; summary: string; category: ProposalCategory; systemArea: SystemArea }> {
  const userPrompt = `Video: ${meta.title ?? meta.videoId}
Channel: ${meta.channelTitle ?? "unknown"}
${meta.publishedAt ? `Published: ${meta.publishedAt}` : ""}

Transcript:
${truncateForLLM(transcriptText)}

Generate a learning proposal as JSON.`;

  const { content } = await chat(
    [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
    { temperature: 0.3, max_tokens: 1200 },
  );

  let parsed: ProposalLLMOutput;
  try {
    parsed = JSON.parse(content.trim()) as ProposalLLMOutput;
  } catch {
    ytLog("warn", "LLM returned non-JSON for proposal, using fallback", { transcriptId });
    parsed = {
      summary: content.slice(0, 500),
      extractedPoints: [],
      category: "operations",
      systemArea: "Improve",
      contradictions: [],
      proposedActions: [{ type: "no_action", description: "Parsing failed, review manually" }],
      producedAssetType: "knowledge_only",
      expectedImpact: "improve",
      revenueLink: "",
    };
  }

  const category = validateCategory(String(parsed.category));
  const systemArea = validateSystemArea(String(parsed.systemArea));
  const producedAssetType = validateAssetType(String(parsed.producedAssetType));
  const expectedImpact = validateImpact(String(parsed.expectedImpact));

  const proposal = await db.learningProposal.create({
    data: {
      transcriptId,
      summary: typeof parsed.summary === "string" ? parsed.summary : "—",
      extractedPointsJson: Array.isArray(parsed.extractedPoints) ? parsed.extractedPoints : [],
      category,
      systemArea,
      contradictionFlagsJson: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
      proposedActionsJson: Array.isArray(parsed.proposedActions) ? parsed.proposedActions : [],
      producedAssetType,
      expectedImpact,
      revenueLink: typeof parsed.revenueLink === "string" ? parsed.revenueLink : null,
      status: TRANSCRIPT_STATUS.READY_FOR_REVIEW,
    },
  });

  ytLog("info", "learning proposal created", {
    proposalId: proposal.id,
    transcriptId,
    category,
    systemArea,
    producedAssetType,
    expectedImpact,
  });

  return { id: proposal.id, summary: proposal.summary, category, systemArea };
}
