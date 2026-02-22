/**
 * Single source of truth for the proposal LLM prompt.
 * Used by: pipeline propose step, manual propose API, any proposal regeneration.
 * Enforces positioning-first (problem > solution > product); no feature-first or "AI-powered" clichés.
 */

import type { LeadIntelligence } from "@/lib/lead-intelligence/schema";

/** Format lead intelligence for the proposal prompt; supports full schema including trustSensitivity, changeSurface, safeStartingPoint, rolloutNotes, influence/stance. */
function formatLeadIntelligenceForPrompt(li: LeadIntelligence | null | undefined): string {
  if (!li) {
    return `
## LEAD INTELLIGENCE (structured)
Not available. Default to:
- low-risk framing
- reversible first step
- stakeholder-safe language
- explicit assumptions + questions
`;
  }
  const adoption = li.adoptionRisk;
  const tool = li.toolLoyaltyRisk;
  const rev = li.reversibility;
  const firstStep = rev?.lowRiskStart ?? (rev as { firstStep?: string })?.firstStep ?? "—";
  const stakeholders = (li.stakeholderMap ?? []).map((s) => {
    const concern = s.likelyObjection ?? (s as { likelyConcern?: string })?.likelyConcern ?? "—";
    const safety = (s as { whatMakesThemFeelSafe?: string })?.whatMakesThemFeelSafe ?? "—";
    const needsSafe = (s as { needsToFeelSafeAbout?: string[] })?.needsToFeelSafeAbout ?? [];
    const inf = s.influence ? ` influence: ${s.influence}` : "";
    const st = s.stance ? ` stance: ${s.stance}` : "";
    const needsStr = needsSafe.length ? ` | needs to feel safe about: ${needsSafe.join(", ")}` : "";
    return `- ${s.role}${s.who ? ` (${s.who})` : ""}${inf}${st} — concern=${concern}; safety=${safety}${needsStr}${s.notes ? ` — ${s.notes}` : ""}`;
  }).join("\n") || "- None identified yet (ask who is affected and who approves).";

  const trustFriction = (adoption as { trustFriction?: string[] })?.trustFriction ?? [];
  const lockIn = (tool as { lockInConcerns?: string[] })?.lockInConcerns ?? [];
  const migrationSens = (tool as { migrationSensitivity?: string })?.migrationSensitivity;
  const pilotFirst = (rev as { pilotFirst?: boolean })?.pilotFirst;

  const trustLine = li.trustSensitivity ? `\n**Trust sensitivity:** ${li.trustSensitivity}` : "";
  const trustFrictionLine = trustFriction.length > 0 ? `\n**Trust friction:** ${trustFriction.join("; ")}` : "";
  const changeLine = (li.changeSurface?.length ?? 0) > 0 ? `\n**Change surface:** ${(li.changeSurface ?? []).join(", ") || "Unknown"}` : "";
  const safeLine = li.safeStartingPoint ? `\n**Safe starting point:** ${li.safeStartingPoint}` : "";
  const rolloutLine = li.rolloutNotes ? `\n**Rollout notes:** ${li.rolloutNotes}` : "";
  const lockInLine = lockIn.length > 0 ? `\n**Lock-in concerns:** ${lockIn.join("; ")}` : "";
  const migrationLine = migrationSens ? `\n**Migration sensitivity:** ${migrationSens}` : "";
  const pilotLine = typeof pilotFirst === "boolean" ? `\n**Pilot first:** ${pilotFirst}` : "";

  return `
---
## LEAD INTELLIGENCE (structured — use explicitly)

**Adoption risk:** ${adoption?.level ?? "unknown"}${adoption?.confidence ? ` (confidence: ${adoption.confidence})` : ""}. Reasons: ${(adoption?.reasons ?? []).join("; ") || "—"}${trustFriction.length ? `. Trust friction: ${trustFriction.join("; ")}` : ""}

**Tool loyalty risk:** ${tool?.level ?? "unknown"}${tool?.confidence ? ` (confidence: ${tool.confidence})` : ""}. ${(tool?.currentTools ?? []).length ? `Current tools: ${(tool.currentTools ?? []).join(", ")}.` : ""}${lockIn.length ? ` Lock-in concerns: ${lockIn.join("; ")}.` : ""}${migrationSens ? ` Migration sensitivity: ${migrationSens}.` : ""}${tool?.notes ? ` ${tool.notes}` : ""}

**Reversibility:** ${rev?.strategy ?? "—"}. First step: ${firstStep}. Rollback: ${rev?.rollbackPlan ?? "—"}${(rev as { blastRadius?: string })?.blastRadius ? `. Blast radius: ${(rev as { blastRadius: string }).blastRadius}` : ""}${(rev as { level?: string })?.level ? `. Level: ${(rev as { level: string }).level}` : ""}${typeof pilotFirst === "boolean" ? `. Pilot first: ${pilotFirst}` : ""}
${trustLine}${trustFrictionLine}${changeLine}${lockInLine}${migrationLine}${safeLine}${rolloutLine}${pilotLine}

### Stakeholder map
${stakeholders}

### Proposal rules (important)
- Do NOT propose a risky "big bang" replacement unless the lead data strongly supports it.
- If adoption risk is medium/high, propose a pilot or phased rollout first.
- If tool loyalty risk is medium/high, position the solution as additive/coexisting first.
- Mention reversibility/rollback in plain language when trust friction is present.
- Speak to the primary buyer's outcome, but reduce fear for approvers/blockers.
- The opening should be confidence + clarity, not hype.
- The Upwork snippet must be concise and low-friction.
- Questions should reduce uncertainty and de-risk implementation.
- Reduce perceived risk in the opening; emphasize reversibility and safe rollout.
- The proposal must feel safe to approve; use the least risky credible path.
---
`;
}

export type LeadForProposal = {
  title: string;
  description: string | null;
  budget: string | null;
  timeline: string | null;
  platform: string | null;
  techStack: string[];
  /** When lead comes from research engine: use for "Why them" and "Why now". */
  researchSnapshot?: string | null;
  researchSourceUrl?: string | null;
  /** When ROI estimate exists: include ROI summary, why now, pilot recommendation in proposal. */
  roiSummary?: string | null;
  /** When result target exists: frame proposal as outcome contract (current → target, metric, timeline). */
  resultTarget?: { currentState: string; targetState: string; metric: string; timeline: string } | null;
  /** From enrich artifact: adoption risk, tool loyalty, reversibility, stakeholder map. Use to tailor proposal. */
  leadIntelligence?: LeadIntelligence | null;
};

/**
 * Build the full proposal prompt from lead + positioning brief.
 * positioningBrief is required — proposals must use positioning.
 * When researchSnapshot is present (research-sourced lead), proposal can cite it for "Why now" and "Opening".
 */
export function buildProposalPrompt(
  lead: LeadForProposal,
  positioningBrief: string
): string {
  const leadBlock = `
Title: ${lead.title}
Description: ${lead.description ?? "No description provided"}
Budget: ${lead.budget ?? "Not specified"}
Timeline: ${lead.timeline ?? "Not specified"}
Platform: ${lead.platform ?? "Not specified"}
Tech Stack: ${lead.techStack?.join(", ") ?? "Not specified"}
`.trim();

  const researchBlock =
    lead.researchSnapshot?.trim()
      ? `
---

## Research snapshot (use for "Why them" and "Why now")

${lead.researchSnapshot}

${lead.researchSourceUrl ? `(Source: ${lead.researchSourceUrl})` : ""}

---
`
      : "\n---\n";

  const leadIntelligenceBlock = formatLeadIntelligenceForPrompt(lead.leadIntelligence ?? undefined);

  return `You are a proposal writer for Evens Louis, a freelance full-stack developer.

Write a proposal for this project lead. The tone should be:
- Professional but human, not corporate
- Confident without being arrogant
- Specific to the project, not generic
- **Positioning-first:** lead with the client's problem and desired outcome (from the positioning brief), not with features or tech.

**RULES:**
- Use the POSITIONING_BRIEF below to shape your opening and framing. Do not ignore it.
- No feature-first language. No "AI-powered" or similar clichés.
- Show you understand their problem before pitching the solution.
- If a research snapshot is provided, use it to make "Why now" and "Opening" specific (e.g. recent post, hiring signal, tech stack, or pain from the source). Do not invent facts; cite the snapshot or the lead description.

**SALES-ENGINEER RULES (non-negotiable):**
- Frame change as safe and reversible. Emphasize small experiments, pilot, rollback, low-risk trials—not big-bang or irreversible commitment.
- Remove blame from past choices. No "you should have," "obviously you need," or judgment of their current setup.
- No oversell. No guarantees, no certainty claims (e.g. "will definitely," "100%"). Prefer "we can," "typically," "first we'll validate."
- If internal politics or multiple stakeholders are implied (e.g. team, finance), acknowledge safety and who needs to say yes—e.g. "we can start with a sandbox" or "one workflow first."
- Proposals that violate these rules must be rejected or rewritten; do not output them.

---

## POSITIONING_BRIEF (use this to frame the proposal)

${positioningBrief}

---

## Lead info

${leadBlock}
${researchBlock}
${leadIntelligenceBlock}
${lead.resultTarget
    ? `
---
## Result Target (outcome contract — use this to frame scope and success)

- **Current state:** ${lead.resultTarget.currentState}
- **Target state:** ${lead.resultTarget.targetState}
- **Metric:** ${lead.resultTarget.metric}
- **Timeline:** ${lead.resultTarget.timeline}

Frame the proposal as removing a specific bottleneck and delivering this measurable result. Do not invent numbers; use the metric and timeline above.
---
`
    : ""}

Generate a proposal with these exact sections (use markdown headers). Put the first two at the very top so the proposal sells from line one:

## Felt Problem & Hook (at top)
One short paragraph: the client’s felt problem in their words, then one sentence that hooks them (from the POSITIONING_BRIEF). This must appear at the very top of the proposal.

## Why now
One short line on why this is the right moment (timing, urgency, or opportunity).${lead.roiSummary ? " If an ROI summary is provided below, ground this in it." : ""}

## Proof / credibility / mechanism
Exactly 3 bullets: proof you can do this, credibility (relevant experience or outcome), and the mechanism (how you’ll deliver). Be specific, not generic.

## Opening (2–3 sentences)
A personalized opener that reflects the positioning. Reference something specific from their description. No "Dear Sir/Madam" or "I saw your posting."

## Approach & 1-Week Plan
Day-by-day breakdown for the first week. Be specific about deliverables, not vague.

## Scope & Deliverables
Bulleted list of exactly what's included and what's explicitly out of scope.

## Milestones
2-4 milestones with rough timeline.
${lead.roiSummary ? `
## ROI & Pilot (use the following to shape a low-risk first step)
${lead.roiSummary}
` : ""}

## Questions Before Starting
3-5 smart questions that show expertise and help define scope better.

## Upwork Snippet
A standalone 3-4 sentence version suitable for an Upwork proposal cover letter (under 600 characters).

## Questions Before Starting
3-5 smart questions that show expertise and help define scope better (or use header ## Questions).

Return EXACTLY this markdown structure so the proposal console can parse sections:
- ## Opening — 3–8 sentences, outcome-first, stakeholder-safe, no hype.
- ## Upwork Snippet — <= 600 characters, concise, client-facing.
- ## Questions Before Starting (or ## Questions) — 5–10 bullets max, clarifying questions that reduce risk or scope ambiguity.

Do not add extra sections that would break the console parser. Use the exact headers above. Write the full proposal in markdown.`;
}
