/**
 * Single source of truth for the proposal LLM prompt.
 * Used by: pipeline propose step, manual propose API, any proposal regeneration.
 * Enforces positioning-first (problem > solution > product); no feature-first or "AI-powered" clichés.
 */

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

Write the full proposal in markdown.`;
}
