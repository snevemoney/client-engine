import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";

const ENRICH_PROMPT = `You are a lead analyst for a freelance software developer. Analyze this lead and extract structured information.

Lead title: {title}
Source: {source}
Description: {description}

Extract and return a JSON object with these fields:
- budget: estimated budget range (string like "$500-$2000" or "Not specified")
- timeline: estimated timeline (string like "1-2 weeks" or "Not specified")
- platform: target platform (string like "web", "mobile", "both", "desktop")
- techStack: array of likely technologies needed (e.g. ["React", "Node.js", "PostgreSQL"])
- requirements: 3-5 bullet points summarizing key requirements
- riskFlags: array of potential risk factors (e.g. ["vague scope", "very tight timeline", "budget too low"])
- category: one of "marketplace", "dashboard", "automation", "ai-integration", "mobile-app", "saas", "landing-page", "other"

Return ONLY valid JSON, no markdown fences.`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const prompt = ENRICH_PROMPT
    .replace("{title}", lead.title)
    .replace("{source}", lead.source)
    .replace("{description}", lead.description || "No description provided");

  try {
    const response = await chat([
      { role: "system", content: "You are a precise lead analyst. Return only valid JSON." },
      { role: "user", content: prompt },
    ], { temperature: 0.3, max_tokens: 1024 });

    const enriched = JSON.parse(response);

    const updated = await db.lead.update({
      where: { id },
      data: {
        budget: enriched.budget || lead.budget,
        timeline: enriched.timeline || lead.timeline,
        platform: enriched.platform || lead.platform,
        techStack: enriched.techStack || lead.techStack,
        status: "ENRICHED",
        enrichedAt: new Date(),
      },
    });

    await db.artifact.create({
      data: {
        leadId: id,
        type: "notes",
        title: "AI Enrichment Report",
        content: [
          `**Category:** ${enriched.category}`,
          `**Budget:** ${enriched.budget}`,
          `**Timeline:** ${enriched.timeline}`,
          `**Platform:** ${enriched.platform}`,
          `**Tech Stack:** ${(enriched.techStack || []).join(", ")}`,
          "",
          "**Requirements:**",
          ...(enriched.requirements || []).map((r: string) => `- ${r}`),
          "",
          "**Risk Flags:**",
          ...(enriched.riskFlags || []).map((r: string) => `- ⚠️ ${r}`),
        ].join("\n"),
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("[enrich] Error:", err);
    return NextResponse.json({ error: err.message || "Enrichment failed" }, { status: 500 });
  }
}
