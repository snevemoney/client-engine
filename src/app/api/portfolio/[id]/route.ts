import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";

const PORTFOLIO_PROMPT = `Write an Upwork portfolio entry for this project. Must be UNDER 600 characters total.

Project: {name}
Description: {description}
Tech Stack: {techStack}

Rules:
- First person ("I built...")
- Focus on the business value delivered, not just tech
- Mention 2-3 key features
- End with the tech stack used
- Professional but not stuffy
- MUST be under 600 characters including spaces

Return ONLY the portfolio text, no quotes, no explanation.`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const prompt = PORTFOLIO_PROMPT
    .replace("{name}", project.name)
    .replace("{description}", project.description || "")
    .replace("{techStack}", project.techStack.join(", ") || "React, TypeScript");

  try {
    const { content } = await chat([
      { role: "system", content: "You write concise portfolio entries. Stay under 600 characters." },
      { role: "user", content: prompt },
    ], { temperature: 0.5, max_tokens: 300 });

    const trimmed = (content ?? "").trim().slice(0, 600);

    return NextResponse.json({ text: trimmed, length: trimmed.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
