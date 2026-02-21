/**
 * Generate engine_improvement_proposal from transcript + learning extraction.
 */

import { chat } from "@/lib/llm";
import type { EngineImprovementProposal, VideoMetadata } from "./types";
import type { LearningExtraction } from "./summarize";

export type ProposalGenerationResult = {
  proposal: EngineImprovementProposal;
  markdown: string;
};

const INSIGHT_TYPES: EngineImprovementProposal["insightType"][] = [
  "sales", "ops", "marketing", "finance", "product", "mindset", "positioning", "metrics",
];

const EFFORT_LEVELS: EngineImprovementProposal["effort"][] = ["low", "med", "high"];
const RISK_LEVELS: EngineImprovementProposal["risk"][] = ["low", "med", "high"];
const APPLY_TARGETS: NonNullable<EngineImprovementProposal["applyTarget"]>[] = [
  "prompt", "workflow", "ui", "scorecard", "playbook", "automation",
];

export async function generateImprovementProposal(
  extraction: LearningExtraction,
  metadata: VideoMetadata,
  videoUrl: string
): Promise<ProposalGenerationResult> {
  const systemPrompt = `You are an expert at turning learning from videos into one structured engine improvement proposal.
Output valid JSON only, no markdown fences. Object must have these exact keys (strings unless noted):
- title: short title
- sourceVideo: video URL (use provided)
- sourceChannel: channel name or ""
- insightType: one of sales|ops|marketing|finance|product|mindset|positioning|metrics
- problemObserved: what problem the insight addresses
- principle: the principle or framework
- proposedChange: what to change in the engine
- expectedImpact: what improves
- effort: low|med|high
- risk: low|med|high
- metricToTrack: optional string
- rollbackPlan: optional string
- applyTarget: one of prompt|workflow|ui|scorecard|playbook|automation (optional)
No extra keys. Be specific and actionable.`;

  const userPrompt = `Video: ${metadata.title}. Channel: ${metadata.channelTitle ?? "—"}.
Summary: ${extraction.summary}
Principles: ${extraction.principles.join("; ")}
Actions: ${extraction.actions.join("; ")}

Generate one engine improvement proposal as JSON. sourceVideo: "${videoUrl}".`;

  const { content } = await chat(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    { temperature: 0.4, max_tokens: 800 }
  );

  let proposal: EngineImprovementProposal;
  try {
    const parsed = JSON.parse(content.trim()) as Record<string, unknown>;
    const insightType = INSIGHT_TYPES.includes(parsed.insightType as EngineImprovementProposal["insightType"])
      ? (parsed.insightType as EngineImprovementProposal["insightType"])
      : "ops";
    const effort = EFFORT_LEVELS.includes(parsed.effort as EngineImprovementProposal["effort"])
      ? (parsed.effort as EngineImprovementProposal["effort"])
      : "med";
    const risk = RISK_LEVELS.includes(parsed.risk as EngineImprovementProposal["risk"])
      ? (parsed.risk as EngineImprovementProposal["risk"])
      : "med";
    const applyTarget = typeof parsed.applyTarget === "string" && APPLY_TARGETS.includes(parsed.applyTarget as any)
      ? (parsed.applyTarget as EngineImprovementProposal["applyTarget"])
      : undefined;

    proposal = {
      title: String(parsed.title ?? "Improvement proposal"),
      sourceVideo: videoUrl,
      sourceChannel: metadata.channelTitle ? String(parsed.sourceChannel ?? metadata.channelTitle) : String(parsed.sourceChannel ?? ""),
      insightType,
      problemObserved: String(parsed.problemObserved ?? ""),
      principle: String(parsed.principle ?? ""),
      proposedChange: String(parsed.proposedChange ?? ""),
      expectedImpact: String(parsed.expectedImpact ?? ""),
      effort,
      risk,
      metricToTrack: parsed.metricToTrack != null ? String(parsed.metricToTrack) : undefined,
      rollbackPlan: parsed.rollbackPlan != null ? String(parsed.rollbackPlan) : undefined,
      applyTarget,
    };
  } catch {
    proposal = {
      title: "Improvement proposal",
      sourceVideo: videoUrl,
      sourceChannel: metadata.channelTitle ?? "",
      insightType: "ops",
      problemObserved: extraction.summary.slice(0, 200),
      principle: extraction.principles[0] ?? "",
      proposedChange: extraction.actions[0] ?? "",
      expectedImpact: "",
      effort: "med",
      risk: "med",
    };
  }

  const markdown = [
    `# ${proposal.title}`,
    ``,
    `**Source:** ${proposal.sourceVideo} ${proposal.sourceChannel ? `(${proposal.sourceChannel})` : ""}`,
    `**Type:** ${proposal.insightType} | **Effort:** ${proposal.effort} | **Risk:** ${proposal.risk}`,
    ``,
    `## Problem observed`,
    proposal.problemObserved,
    ``,
    `## Principle`,
    proposal.principle,
    ``,
    `## Proposed change`,
    proposal.proposedChange,
    ``,
    `## Expected impact`,
    proposal.expectedImpact,
    proposal.metricToTrack ? `\n**Metric to track:** ${proposal.metricToTrack}` : "",
    proposal.rollbackPlan ? `\n**Rollback:** ${proposal.rollbackPlan}` : "",
    proposal.applyTarget ? `\n**Apply to:** ${proposal.applyTarget}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { proposal, markdown };
}
