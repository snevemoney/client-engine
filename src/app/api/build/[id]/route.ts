import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

const SPEC_PROMPT = `You are a technical project manager. Given this project lead, generate:

1. A PROJECT_SPEC.md — a clear specification document with:
   - Project overview (2-3 sentences)
   - Core features (bulleted list, prioritized)
   - Tech stack recommendation
   - Database schema (if applicable, in plain text)
   - API endpoints (if applicable)
   - Pages/screens list

2. A DO_THIS_NEXT.md — an ordered task list for a developer (Cursor-friendly). Format:
   - [ ] Task 1 (most critical first)
   - [ ] Task 2
   Each task should be specific and completable in 1-4 hours.

Lead:
Title: {title}
Description: {description}
Budget: {budget}
Timeline: {timeline}
Platform: {platform}
Tech Stack: {techStack}

Output two sections separated by "---SPLIT---":
First section: PROJECT_SPEC.md content
Second section: DO_THIS_NEXT.md content`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id }, include: { project: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (lead.project) {
    return NextResponse.json({ error: "Project already exists for this lead", project: lead.project }, { status: 409 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const prompt = SPEC_PROMPT
    .replace("{title}", lead.title)
    .replace("{description}", lead.description || "No description")
    .replace("{budget}", lead.budget || "Not specified")
    .replace("{timeline}", lead.timeline || "Not specified")
    .replace("{platform}", lead.platform || "Not specified")
    .replace("{techStack}", lead.techStack.join(", ") || "Not specified");

  try {
    const response = await chat([
      { role: "system", content: "You are a precise technical project manager. Output clean markdown." },
      { role: "user", content: prompt },
    ], { model: "gpt-4o-mini", temperature: 0.4, max_tokens: 3000 });

    const parts = response.split("---SPLIT---");
    const spec = parts[0]?.trim() || response;
    const tasks = parts[1]?.trim() || "- [ ] Define project scope\n- [ ] Set up development environment\n- [ ] Build core features";

    const slug = slugify(lead.title);

    const project = await db.project.create({
      data: {
        slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
        name: lead.title,
        description: lead.description,
        leadId: lead.id,
        techStack: lead.techStack,
        status: "draft",
      },
    });

    await db.lead.update({
      where: { id },
      data: { status: "BUILDING" },
    });

    await db.artifact.createMany({
      data: [
        { leadId: id, type: "scope", title: "PROJECT_SPEC.md", content: spec },
        { leadId: id, type: "scope", title: "DO_THIS_NEXT.md", content: tasks },
      ],
    });

    return NextResponse.json({ project, spec: spec.slice(0, 200), tasks: tasks.slice(0, 200) });
  } catch (err: any) {
    console.error("[build] Error:", err);
    return NextResponse.json({ error: err.message || "Build factory failed" }, { status: 500 });
  }
}
