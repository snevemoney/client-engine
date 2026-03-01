/**
 * Learning Proposal Generator.
 *
 * Transcript → summary → claims/ideas → classification → system area mapping → action proposal.
 * Auto-categorization: LLM output determines status automatically.
 *   - knowledge_only asset + no_action → KNOWLEDGE_ONLY
 *   - actionable proposals → PROMOTED_TO_PLAYBOOK (+ creates ReusableAssetLog)
 * Everything is deletable — cascade-deletes propagate to created assets.
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

  // Auto-categorize: knowledge_only → KNOWLEDGE_ONLY, everything else → PROMOTED_TO_PLAYBOOK
  const isKnowledgeOnly =
    producedAssetType === "knowledge_only" &&
    Array.isArray(parsed.proposedActions) &&
    parsed.proposedActions.every((a) => a.type === "no_action");

  const autoStatus = isKnowledgeOnly
    ? TRANSCRIPT_STATUS.KNOWLEDGE_ONLY
    : TRANSCRIPT_STATUS.PROMOTED_TO_PLAYBOOK;

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
      status: autoStatus,
      reviewerNotes: `Auto-categorized as ${autoStatus.toLowerCase().replace(/_/g, " ")}`,
    },
  });

  // For promoted proposals, create a ReusableAssetLog entry so it propagates through the system
  if (autoStatus === TRANSCRIPT_STATUS.PROMOTED_TO_PLAYBOOK) {
    try {
      const assetTypeMap: Record<string, string> = {
        proposal_template: "template",
        sales_script: "sales_script",
        followup_script: "sales_script",
        objection_handling: "sales_script",
        delivery_checklist: "checklist",
        reusable_component: "component",
        case_study_angle: "case_study",
        positioning_note: "prompt_pattern",
      };

      await db.reusableAssetLog.create({
        data: {
          assetType: assetTypeMap[producedAssetType] ?? "prompt_pattern",
          label: meta.title
            ? `[YouTube] ${meta.title}`
            : `[YouTube] Learning: ${category}`,
          notes: [
            proposal.summary,
            parsed.revenueLink ? `Revenue link: ${parsed.revenueLink}` : null,
            `Source: https://youtube.com/watch?v=${meta.videoId}`,
          ]
            .filter(Boolean)
            .join("\n"),
          reusabilityScore: isKnowledgeOnly ? 1 : 3,
          whereStored: `LearningProposal:${proposal.id}`,
          canProductize: producedAssetType === "reusable_component" ? "yes" : "maybe",
        },
      });
    } catch (err) {
      ytLog("warn", "failed to create ReusableAssetLog (non-blocking)", {
        proposalId: proposal.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  ytLog("info", "learning proposal created", {
    proposalId: proposal.id,
    transcriptId,
    category,
    systemArea,
    producedAssetType,
    expectedImpact,
    autoStatus,
  });

  return { id: proposal.id, summary: proposal.summary, category, systemArea };
}
