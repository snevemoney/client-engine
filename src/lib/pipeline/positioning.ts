import { db } from "@/lib/db";
import { chat } from "@/lib/llm";

const POSITIONING_PROMPT = `You are a positioning strategist for a freelance full-stack developer. Given this lead, write a short POSITIONING_BRIEF that will be used to open proposals.

Focus on problem and outcome, not features:
- What problem does the client have?
- What outcome do they want?
- One sentence "positioning" that frames how we approach this (e.g. "This is a scope-tight MVP to validate X before scaling").

Lead:
Title: {title}
Description: {description}
Budget: {budget}
Timeline: {timeline}
Platform: {platform}

Write 2-4 short paragraphs in markdown. No generic intros. Start with the problem/outcome.`;

/**
 * Run positioning for a lead; creates artifact type "positioning", title "POSITIONING_BRIEF".
 * Throws on error.
 */
export async function runPositioning(leadId: string): Promise<{ artifactId: string }> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const prompt = POSITIONING_PROMPT
    .replace("{title}", lead.title)
    .replace("{description}", lead.description || "No description")
    .replace("{budget}", lead.budget || "Not specified")
    .replace("{timeline}", lead.timeline || "Not specified")
    .replace("{platform}", lead.platform || "Not specified");

  const { content: briefContent, usage } = await chat(
    [
      { role: "system", content: "You write concise positioning briefs. Output markdown only." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.4, max_tokens: 1024 }
  );

  const artifact = await db.artifact.create({
    data: {
      leadId,
      type: "positioning",
      title: "POSITIONING_BRIEF",
      content: briefContent,
    },
  });

  return { artifactId: artifact.id, usage };
}
