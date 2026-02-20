import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";

const SCORE_PROMPT = `You are a lead scoring engine for a freelance full-stack developer (Evens Louis).

Profile:
- Specializes in: Next.js, React, Node.js, PostgreSQL, Supabase, AI integrations, automation
- Ideal projects: web apps, dashboards, marketplaces, SaaS MVPs, AI features
- Typical budget: $1,000-$10,000
- Typical timeline: 1-4 weeks
- Prefers: clear scope, responsive clients, repeat potential
- Avoids: maintenance-only, unrealistic budgets, vague "build me an app" requests

Lead to score:
Title: {title}
Source: {source}
Budget: {budget}
Timeline: {timeline}
Platform: {platform}
Tech Stack: {techStack}
Description: {description}

Score this lead from 0-100 based on:
- Budget fit (is it realistic for the work?)
- Scope clarity (is the project well-defined?)
- Tech alignment (does it match the developer's stack?)
- Effort/reward ratio
- Red flags (scope creep risk, client reliability signals)

Return ONLY a JSON object with:
- score: number 0-100
- verdict: "ACCEPT" or "MAYBE" or "REJECT"
- reasons: array of 3-5 short reason strings explaining the score
- suggestion: one sentence about how to approach this lead

No markdown fences, just JSON.`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const prompt = SCORE_PROMPT
    .replace("{title}", lead.title)
    .replace("{source}", lead.source)
    .replace("{budget}", lead.budget || "Not specified")
    .replace("{timeline}", lead.timeline || "Not specified")
    .replace("{platform}", lead.platform || "Not specified")
    .replace("{techStack}", lead.techStack.join(", ") || "Not specified")
    .replace("{description}", lead.description || "No description");

  try {
    const response = await chat([
      { role: "system", content: "You are a precise lead scoring engine. Return only valid JSON." },
      { role: "user", content: prompt },
    ], { temperature: 0.2, max_tokens: 512 });

    const scored = JSON.parse(response);

    const scoreReason = [
      `**Verdict:** ${scored.verdict}`,
      `**Score:** ${scored.score}/100`,
      "",
      "**Reasons:**",
      ...(scored.reasons || []).map((r: string) => `- ${r}`),
      "",
      `**Suggestion:** ${scored.suggestion}`,
    ].join("\n");

    const updated = await db.lead.update({
      where: { id },
      data: {
        score: Math.min(100, Math.max(0, scored.score)),
        scoreReason,
        status: lead.status === "NEW" || lead.status === "ENRICHED" ? "SCORED" : lead.status,
        scoredAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("[score] Error:", err);
    return NextResponse.json({ error: err.message || "Scoring failed" }, { status: 500 });
  }
}
