/**
 * Site Build Pipeline — run a single phase, create artifact, update phase status.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { safeParseJSON } from "@/lib/llm/safe-parse-json";
import { buildPhaseContext } from "./context-builder";
import { PHASE_CONFIG } from "./constants";
import { getPhaseSchema } from "./output-validators";

const SKILLS_DIR = join(process.cwd(), "src/lib/builder/skills");
const JSON_OVERRIDE = `
---
SITE BUILDER INTEGRATION — Output valid JSON only. No markdown, no explanation, no code fences.
Produce ONLY a JSON object with the keys specified below. Do not include any other text.
---`;

const PHASE_KEYS: Record<number, string> = {
  1: "scope, siteMap, userFlows",
  2: "brandColors, designSystem",
  3: "contentHints, clientInfo",
  4: "componentLogic",
  5: "figmaMakePrompts",
  6: "animationSpecs",
  7: "responsiveSpecs",
  8: "dataIntegration",
  9: "qaChecklist",
};

const defaultScope = ["homepage", "about", "services", "contact"];

function loadSkill(name: string): string {
  try {
    return readFileSync(join(SKILLS_DIR, `${name}.md`), "utf-8");
  } catch {
    return "";
  }
}

function stringOrArray(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v;
  if (Array.isArray(v)) return v.map(String).filter(Boolean).join("\n") || undefined;
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function buildUserPrompt(ctx: { priorPhases: Record<string, unknown> } & Record<string, unknown>, operatorNotes?: string): string {
  const parts: string[] = [
    `Client: ${ctx.clientName}`,
    `Business/Title: ${ctx.title}`,
    `Industry: ${ctx.industry}`,
  ];
  if (ctx.description) parts.push(`Description: ${String(ctx.description).slice(0, 600)}`);
  if (ctx.feltProblem) parts.push(`Felt problem: ${ctx.feltProblem}`);
  if (ctx.reframedOffer) parts.push(`Reframed offer: ${ctx.reframedOffer}`);
  if (ctx.blueOceanAngle) parts.push(`Blue ocean: ${ctx.blueOceanAngle}`);
  if (ctx.enrichmentSummary) parts.push(`Enrichment: ${String(ctx.enrichmentSummary).slice(0, 400)}`);
  if (ctx.proposalContent) parts.push(`Proposal (use verbatim for hero):\n---\n${String(ctx.proposalContent).slice(0, 1500)}\n---`);
  if (Object.keys(ctx.priorPhases).length > 0) {
    parts.push(`Prior phases (for context): ${JSON.stringify(ctx.priorPhases, null, 2).slice(0, 2000)}`);
  }
  if (operatorNotes?.trim()) {
    parts.push(`Operator notes (apply these changes): ${operatorNotes.trim()}`);
  }
  return parts.join("\n\n");
}

function normalizePhaseOutput(phaseNum: number, raw: Record<string, unknown>): Record<string, unknown> {
  switch (phaseNum) {
    case 1:
      return {
        scope: Array.isArray(raw.scope) && raw.scope.length ? raw.scope : defaultScope,
        siteMap: stringOrArray(raw.siteMap),
        userFlows: stringOrArray(raw.userFlows),
      };
    case 2:
      return {
        brandColors: Array.isArray(raw.brandColors) ? raw.brandColors.filter((x): x is string => typeof x === "string") : undefined,
        designSystem: raw.designSystem && typeof raw.designSystem === "object" ? raw.designSystem : undefined,
      };
    case 3: {
      const ci = raw.clientInfo;
      if (!ci || typeof ci !== "object")
        return { contentHints: typeof raw.contentHints === "string" ? raw.contentHints : undefined, clientInfo: undefined };
      const obj = ci as Record<string, unknown>;
      return {
        contentHints: typeof raw.contentHints === "string" ? raw.contentHints : undefined,
        clientInfo: {
          heroHeadline: str(obj.heroHeadline ?? obj.headline),
          heroSubhead: str(obj.heroSubhead ?? obj.subheadline),
          ctaPrimary: str(obj.ctaPrimary ?? obj.ctaText),
          features: Array.isArray(obj.features) ? obj.features : undefined,
          testimonials: Array.isArray(obj.testimonials) ? obj.testimonials : undefined,
          faq: Array.isArray(obj.faq) ? obj.faq : undefined,
          footerTagline: str(obj.footerTagline),
          tone: str(obj.tone),
        },
      };
    }
    case 4:
      return { componentLogic: typeof raw.componentLogic === "string" ? raw.componentLogic : undefined };
    case 5:
      return { figmaMakePrompts: Array.isArray(raw.figmaMakePrompts) ? raw.figmaMakePrompts.filter((x): x is string => typeof x === "string") : undefined };
    case 6:
      return { animationSpecs: typeof raw.animationSpecs === "string" ? raw.animationSpecs : undefined };
    case 7:
      return { responsiveSpecs: typeof raw.responsiveSpecs === "string" ? raw.responsiveSpecs : undefined };
    case 8:
      return { dataIntegration: typeof raw.dataIntegration === "string" ? raw.dataIntegration : undefined };
    case 9:
      return { qaChecklist: typeof raw.qaChecklist === "string" ? raw.qaChecklist : undefined };
    default:
      return raw;
  }
}

export type RunPhaseResult =
  | { ok: true; output: Record<string, unknown>; artifactId: string }
  | { ok: false; error: string };

/**
 * Run a single phase: load context, call LLM, create artifact, update phase.
 * @param operatorNotes — Optional notes for regeneration; injected into the prompt.
 */
export async function runSitePhase(planId: string, phaseNum: number, operatorNotes?: string): Promise<RunPhaseResult> {
  const config = PHASE_CONFIG.find((p) => p.num === phaseNum);
  if (!config) return { ok: false, error: `Invalid phase: ${phaseNum}` };

  const plan = await db.siteBuildPlan.findUnique({
    where: { id: planId },
    include: {
      deliveryProject: { select: { pipelineLeadId: true } },
      phases: {
        where: { phaseNum: { lt: phaseNum } },
        orderBy: { phaseNum: "asc" },
      },
    },
  });

  if (!plan) return { ok: false, error: "Plan not found" };
  if (!plan.deliveryProject.pipelineLeadId) {
    return { ok: false, error: "SBP requires a pipeline Lead; project has none" };
  }

  const phase = await db.siteBuildPhase.findFirst({
    where: { siteBuildPlanId: planId, phaseNum },
  });
  if (!phase) return { ok: false, error: `Phase ${phaseNum} not found` };
  if (phase.status === "running") return { ok: false, error: `Phase ${phaseNum} already running` };

  // Check prior phases approved
  for (const p of plan.phases) {
    if (p.status !== "approved") {
      return { ok: false, error: `Phase ${p.phaseNum} must be approved before phase ${phaseNum}` };
    }
  }

  const ctx = await buildPhaseContext(planId, phaseNum);
  if (!ctx) return { ok: false, error: "Failed to build phase context" };

  await db.siteBuildPhase.update({
    where: { id: phase.id },
    data: { status: "running", runAt: new Date() },
  });

  const startMs = Date.now();
  let output: Record<string, unknown>;

  try {
    const skillContent = loadSkill(config.skill);
    const keys = PHASE_KEYS[phaseNum] ?? "";
    const system = skillContent
      ? `${skillContent}${JSON_OVERRIDE}\n\nOutput a JSON object with exactly these keys: ${keys}`
      : `Output valid JSON with keys: ${keys}. Use client context to populate.`;

    const user = buildUserPrompt(ctx, operatorNotes);

    const { content } = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "claude-sonnet-4-20250514", temperature: 0.3, max_tokens: 4096 },
    );

    const schema = getPhaseSchema(phaseNum);
    try {
      const parsed = schema
        ? (safeParseJSON(content, schema as Parameters<typeof safeParseJSON>[1]) as Record<string, unknown>)
        : (JSON.parse(content) as Record<string, unknown>);
      output = parsed;
    } catch {
      let raw: Record<string, unknown>;
      try {
        raw = safeParseJSON(content) as Record<string, unknown>;
      } catch {
        raw = {};
      }
      output = normalizePhaseOutput(phaseNum, raw);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.siteBuildPhase.update({
      where: { id: phase.id },
      data: { status: "failed", error: msg.slice(0, 2000) },
    });
    return { ok: false, error: msg };
  }

  const durationMs = Date.now() - startMs;

  const artifact = await db.artifact.create({
    data: {
      leadId: plan.deliveryProject.pipelineLeadId,
      type: config.artifactType,
      title: `Phase ${phaseNum}: ${config.skill}`,
      content: JSON.stringify(output),
      meta: output,
    },
  });

  await db.siteBuildPhase.update({
    where: { id: phase.id },
    data: {
      status: "complete",
      outputArtifactId: artifact.id,
      durationMs,
      modelUsed: "claude-sonnet-4-20250514",
      error: null,
    },
  });

  return { ok: true, output, artifactId: artifact.id };
}
