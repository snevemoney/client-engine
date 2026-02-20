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
};

/**
 * Build the full proposal prompt from lead + positioning brief.
 * positioningBrief is required — proposals must use positioning.
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

---

## POSITIONING_BRIEF (use this to frame the proposal)

${positioningBrief}

---

## Lead info

${leadBlock}

---

Generate a proposal with these exact sections (use markdown headers):

## Opening (3 sentences max)
A personalized opener that reflects the positioning: their problem and desired outcome first. Reference something specific from their description. No "Dear Sir/Madam" or "I saw your posting."

## Approach & 1-Week Plan
Day-by-day breakdown for the first week. Be specific about deliverables, not vague.

## Scope & Deliverables
Bulleted list of exactly what's included and what's explicitly out of scope.

## Milestones
2-4 milestones with rough timeline.

## Questions Before Starting
3-5 smart questions that show expertise and help define scope better.

## Upwork Snippet
A standalone 3-4 sentence version suitable for an Upwork proposal cover letter (under 600 characters).

Write the full proposal in markdown.`;
}
