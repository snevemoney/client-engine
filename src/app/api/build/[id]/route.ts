import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { createRun, startStep, finishStep, finishRun } from "@/lib/pipeline-metrics";
import { normalizeUsage } from "@/lib/pipeline/usage";
import { formatStepFailureNotes } from "@/lib/pipeline/error-classifier";
import { buildProvenance } from "@/lib/pipeline/provenance";
import { rateLimit } from "@/lib/rate-limit";
import { buildCursorRulesFallback } from "@/lib/build/buildCursorRules";

const LIMIT = 10;
const WINDOW_MS = 60_000;

const BuildOutputSchema = z.object({
  projectSpecMd: z.string().min(1),
  doThisNextMd: z.string().min(1),
  cursorRulesMd: z.string().optional(),
});

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

const SPEC_PROMPT = `You are a technical project manager for a private operator app. Given this project lead, generate implementation artifacts.

Return valid JSON only with exactly these keys (no markdown fences):
- projectSpecMd
- doThisNextMd
- cursorRulesMd

Context:
- This app is private/internal. Mission: Acquire / Deliver / Improve.
- Human guardrails: no auto-send proposals, no auto-build/code execution without approval. Human owns positioning, narrative, final send, and build decisions.

Lead:
Title: {title}
Description: {description}
Budget: {budget}
Timeline: {timeline}
Platform: {platform}
Tech Stack: {techStack}

Requirements:

1) projectSpecMd
- Build spec for the requested work.
- Include scope, constraints, dependencies, acceptance criteria, risks.
- Be practical and implementation-ready (overview, core features, tech stack, DB/API/pages as applicable).

2) doThisNextMd
- Immediate execution checklist for a developer (Cursor-friendly).
- Ordered steps with "Do now" vs "Backlog" where relevant.
- Format: - [ ] Task 1 (most critical first). Each task specific and completable in 1-4 hours.
- Include verification after each major step.

3) cursorRulesMd
- A strict implementation rules file for AI coding assistants (Cursor/Claude).
- Keep it concise and enforceable.
- Must include: Mission and scope of this task; files allowed/not to change (if known); guardrails (no fake completion, no silent breaking changes, no hidden migrations); code quality rules (small patches, preserve behavior, type-safe, no dead code); verification rules (what must be tested/checked); output protocol (what to report back: changed files, what worked, risks, follow-ups).
- Emphasize production reliability and reversible changes.

Tone: Senior operator / engineer. Clear, direct, no fluff.
Output: JSON only.`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = `${session.user.id}:build`;
  const { ok, resetAt } = rateLimit(key, LIMIT, WINDOW_MS);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests", resetAt },
      { status: 429, headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(resetAt) } }
    );
  }

  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { project: true, artifacts: { where: { type: "proposal" }, take: 1 } },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (lead.project) {
    return NextResponse.json({ error: "Project already exists for this lead", project: lead.project }, { status: 409 });
  }

  // Approval gate: Build is only allowed when lead is explicitly approved
  if (lead.status !== "APPROVED") {
    return NextResponse.json(
      {
        error: "Lead not approved for build",
        requiredStatus: "APPROVED",
        currentStatus: lead.status,
      },
      { status: 403 }
    );
  }

  // Require at least one proposal artifact (positioning gate implies proposal exists for approved flow)
  if (!lead.artifacts?.length) {
    return NextResponse.json(
      {
        error: "No proposal artifact for this lead. Run propose step first.",
      },
      { status: 403 }
    );
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

  const runId = await createRun(id);
  const stepId = await startStep(runId, "build");

  try {
    const { content, usage } = await chat(
      [
        { role: "system", content: "You are a precise technical project manager. Return only valid JSON with keys projectSpecMd, doThisNextMd, cursorRulesMd. No markdown fences." },
        { role: "user", content: prompt },
      ],
      { model: "gpt-4o-mini", temperature: 0.4, max_tokens: 3000 }
    );

    let spec: string;
    let tasks: string;
    let cursorRulesContent: string;

    let modelJson: unknown = null;
    const trimmed = content.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/m);
    const jsonStr = fenceMatch ? fenceMatch[1]?.trim() ?? trimmed : trimmed;
    try {
      modelJson = JSON.parse(jsonStr);
    } catch {
      modelJson = null;
    }
    const parsed = BuildOutputSchema.safeParse(modelJson);

    if (parsed.success) {
      spec = parsed.data.projectSpecMd.trim();
      tasks = parsed.data.doThisNextMd.trim();
      cursorRulesContent =
        parsed.data.cursorRulesMd?.trim() ||
        buildCursorRulesFallback({
          leadTitle: lead.title,
          taskSummary: (lead.description ?? "").slice(0, 300) || undefined,
        });
    } else {
      const parts = content.split("---SPLIT---");
      spec = parts[0]?.trim() || content;
      tasks = parts[1]?.trim() || "- [ ] Define project scope\n- [ ] Set up development environment\n- [ ] Build core features";
      cursorRulesContent = buildCursorRulesFallback({
        leadTitle: lead.title,
        taskSummary: (lead.description ?? "").slice(0, 300) || undefined,
      });
    }

    const slug = slugify(lead.title);

    const provenance = buildProvenance(runId, "build", {
      model: "gpt-4o-mini",
      temperature: 0.4,
    });
    const project = await db.$transaction(async (tx) => {
      const startedAt = new Date();
      const createdProject = await tx.project.create({
        data: {
          slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
          name: lead.title,
          description: lead.description,
          leadId: lead.id,
          techStack: lead.techStack,
          status: "draft",
        },
      });

      await tx.lead.update({
        where: { id },
        data: { status: "BUILDING", buildStartedAt: startedAt, buildCompletedAt: null },
      });

      await tx.artifact.create({
        data: {
          leadId: id,
          type: "scope",
          title: "PROJECT_SPEC.md",
          content: spec,
          meta: { provenance, buildArtifact: { kind: "project_spec" } } as object,
        },
      });
      await tx.artifact.create({
        data: {
          leadId: id,
          type: "scope",
          title: "DO_THIS_NEXT.md",
          content: tasks,
          meta: { provenance, buildArtifact: { kind: "do_this_next" } } as object,
        },
      });
      await tx.artifact.create({
        data: {
          leadId: id,
          type: "scope",
          title: "CURSOR_RULES.md",
          content: cursorRulesContent,
          meta: { provenance, buildArtifact: { kind: "cursor_rules" } } as object,
        },
      });

      return createdProject;
    });

    const norm = normalizeUsage(usage, "gpt-4o-mini");
    await finishStep(stepId, {
      success: true,
      tokensUsed: norm.tokensUsed,
      costEstimate: norm.costEstimate,
    });
    await finishRun(runId, true);
    return NextResponse.json({ project, spec: spec.slice(0, 200), tasks: tasks.slice(0, 200) });
  } catch (err: unknown) {
    console.error("[build] Error:", err);
    await finishStep(stepId, { success: false, notes: formatStepFailureNotes(err) });
    const msg = err instanceof Error ? err.message : "Build factory failed";
    await finishRun(runId, false, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
