import { db } from "@/lib/db";
import { chat, type ChatUsage } from "@/lib/llm";
import { buildProposalPrompt } from "@/lib/pipeline/prompts/buildProposalPrompt";
import { isDryRun } from "@/lib/pipeline/dry-run";

const POSITIONING_ARTIFACT_TITLE = "POSITIONING_BRIEF";

/**
 * Run proposal step. Requires a positioning artifact for this lead (gate: no proposal without positioning).
 */
export async function runPropose(leadId: string): Promise<{ artifactId: string; usage?: ChatUsage }> {
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
    throw new Error(
      "Proposal requires POSITIONING_BRIEF. Run position step first."
    );
  }

  if (isDryRun()) {
    const artifact = await db.artifact.create({
      data: {
        leadId,
        type: "proposal",
        title: `Proposal: ${lead.title}`,
        content: "**[DRY RUN]** Placeholder proposal.",
      },
    });
    return { artifactId: artifact.id };
  }

  const prompt = buildProposalPrompt(
    {
      title: lead.title,
      description: lead.description,
      budget: lead.budget,
      timeline: lead.timeline,
      platform: lead.platform,
      techStack: lead.techStack,
    },
    positioning.content
  );

  const { content, usage } = await chat(
    [
      {
        role: "system",
        content:
          "You are an expert proposal writer for a freelance developer. Write compelling, specific, positioning-first proposals.",
      },
      { role: "user", content: prompt },
    ],
    { model: "gpt-4o-mini", temperature: 0.6, max_tokens: 2048 }
  );

  const artifact = await db.artifact.create({
    data: {
      leadId,
      type: "proposal",
      title: `Proposal: ${lead.title}`,
      content,
    },
  });

  return { artifactId: artifact.id, usage };
}
