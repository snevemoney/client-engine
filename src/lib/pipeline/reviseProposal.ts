import { db } from "@/lib/db";
import { chat, type ChatUsage } from "@/lib/llm";
import { isDryRun } from "@/lib/pipeline/dry-run";
import type { Provenance } from "@/lib/pipeline/provenance";

const POSITIONING_ARTIFACT_TITLE = "POSITIONING_BRIEF";

/**
 * Revise the latest proposal for a lead using the same positioning.
 * Creates a new proposal artifact. Requires existing positioning + at least one proposal.
 */
export async function runReviseProposal(
  leadId: string,
  instruction: string,
  provenance?: Provenance
): Promise<{ artifactId: string; usage?: ChatUsage }> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const positioning = await db.artifact.findFirst({
    where: {
      leadId,
      type: "positioning",
      title: POSITIONING_ARTIFACT_TITLE,
    },
  });
  if (!positioning) {
    throw new Error("Proposal revise requires POSITIONING_BRIEF. Run position step first.");
  }

  const currentProposal = await db.artifact.findFirst({
    where: { leadId, type: "proposal" },
    orderBy: { createdAt: "desc" },
  });
  if (!currentProposal) {
    throw new Error("No proposal to revise. Generate a proposal first.");
  }

  const meta = provenance ? { provenance } : undefined;
  if (isDryRun()) {
    const artifact = await db.artifact.create({
      data: {
        leadId,
        type: "proposal",
        title: `Proposal: ${lead.title} (revised)`,
        content: `**[DRY RUN]** Revised proposal.\n\nInstruction: ${instruction}`,
        ...(meta ? { meta } : {}),
      },
    });
    return { artifactId: artifact.id };
  }

  const systemContent = `You are an expert proposal writer for a freelance developer. Revise the given proposal according to the user's instruction. Keep the same structure and positioning; only change what the instruction asks for. Output the full revised proposal in markdown.`;

  const userContent = `## Instruction from the user
${instruction.trim()}

## POSITIONING_BRIEF (do not change the positioning; keep the proposal aligned with this)
${positioning.content}

## Current proposal (revise this according to the instruction above)
${currentProposal.content}

---
Output the complete revised proposal in markdown, keeping all required sections (Felt Problem & Hook, Why now, Proof/credibility/mechanism, Opening, Approach & 1-Week Plan, Scope & Deliverables, Milestones, Questions Before Starting, Upwork Snippet).`;

  const { content, usage } = await chat(
    [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    { model: "gpt-4o-mini", temperature: 0.5, max_tokens: 2048 }
  );

  const artifact = await db.artifact.create({
    data: {
      leadId,
      type: "proposal",
      title: `Proposal: ${lead.title}`,
      content,
      ...(meta ? { meta } : {}),
    },
  });

  return { artifactId: artifact.id, usage };
}
