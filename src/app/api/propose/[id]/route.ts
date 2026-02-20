import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";

const PROPOSAL_PROMPT = `You are a proposal writer for Evens Louis, a freelance full-stack developer.

Write a proposal for this project lead. The tone should be:
- Professional but human, not corporate
- Confident without being arrogant
- Specific to the project, not generic
- Show you understand their problem before pitching the solution

Lead info:
Title: {title}
Description: {description}
Budget: {budget}
Timeline: {timeline}
Platform: {platform}
Tech Stack: {techStack}

Generate a proposal with these exact sections (use markdown headers):

## Opening (3 sentences max)
A personalized opener that shows you read and understood their project. No "Dear Sir/Madam" or "I saw your posting." Reference something specific from their description.

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const prompt = PROPOSAL_PROMPT
    .replace("{title}", lead.title)
    .replace("{description}", lead.description || "No description provided")
    .replace("{budget}", lead.budget || "Not specified")
    .replace("{timeline}", lead.timeline || "Not specified")
    .replace("{platform}", lead.platform || "Not specified")
    .replace("{techStack}", lead.techStack.join(", ") || "Not specified");

  try {
    const proposal = await chat([
      { role: "system", content: "You are an expert proposal writer for a freelance developer. Write compelling, specific proposals." },
      { role: "user", content: prompt },
    ], { model: "gpt-4o-mini", temperature: 0.6, max_tokens: 2048 });

    const artifact = await db.artifact.create({
      data: {
        leadId: id,
        type: "proposal",
        title: `Proposal: ${lead.title}`,
        content: proposal,
      },
    });

    return NextResponse.json(artifact);
  } catch (err: any) {
    console.error("[propose] Error:", err);
    return NextResponse.json({ error: err.message || "Proposal generation failed" }, { status: 500 });
  }
}
