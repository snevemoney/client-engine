/**
 * 9-phase site brief enrichment — one LLM call per phase, feels like one.
 * Each phase uses a skill (architecture, design-system, content, etc.) and produces
 * a JSON fragment. Orchestrator runs sequentially, merges into EnrichedSiteBrief.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chat } from "@/lib/llm";
import { safeParseJSON } from "@/lib/llm/safe-parse-json";
import { z } from "zod";
import type { EnrichedSiteBrief } from "./enrich-site-brief";
import type { SiteBriefContext } from "./site-brief-prompt";
import { isHeroSubheadGeneric } from "./site-brief-9";

const SKILLS_DIR = join(process.cwd(), "src/lib/builder/skills");

function loadSkill(name: string): string {
  try {
    return readFileSync(join(SKILLS_DIR, `${name}.md`), "utf-8");
  } catch {
    return "";
  }
}

// Coerce helpers — LLM may return arrays for strings, objects for scope, etc.
const defaultScope = ["homepage", "about", "services", "contact"];
const scopeCoerce = z.union([
  z.array(z.string()),
  z.string().transform((s) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)),
  z.record(z.string(), z.unknown()).transform((o) => Object.keys(o)),
  z.any().transform(() => defaultScope),
]).transform((v) => (Array.isArray(v) && v.length > 0 ? v : defaultScope));

function stringOrArray(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v;
  if (Array.isArray(v)) return v.map(String).filter(Boolean).join("\n") || undefined;
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

// Phase output schemas (permissive — accept LLM output variations)
const Phase1Schema = z.object({
  scope: scopeCoerce.optional().default(defaultScope),
  siteMap: z.any().optional().transform(stringOrArray),
  userFlows: z.any().optional().transform(stringOrArray),
});

const Phase2Schema = z.object({
  brandColors: z.array(z.string()).optional(),
  designSystem: z
    .object({
      typographyScale: z.string().optional(),
      spacingSystem: z.string().optional(),
      layoutPatterns: z.string().optional(),
      animationGuidelines: z.string().optional(),
      wcagNotes: z.string().optional(),
    })
    .optional(),
});

const Phase3Schema = z.object({
  contentHints: z.string().optional(),
  clientInfo: z
    .object({
      heroHeadline: z.string().optional(),
      heroSubhead: z.string().optional(),
      ctaPrimary: z.string().optional(),
      features: z.array(z.object({ title: z.string(), body: z.string() })).optional(),
      testimonials: z.array(z.object({ quote: z.string(), author: z.string(), role: z.string() })).optional(),
      faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
      footerTagline: z.string().optional(),
      tone: z.string().optional(),
    })
    .optional(),
});

const Phase4Schema = z.object({ componentLogic: z.string().optional() });
const Phase5Schema = z.object({ figmaMakePrompts: z.array(z.string()).optional() });
const Phase6Schema = z.object({ animationSpecs: z.string().optional() });
const Phase7Schema = z.object({ responsiveSpecs: z.string().optional() });
const Phase8Schema = z.object({ dataIntegration: z.string().optional() });
const Phase9Schema = z.object({ qaChecklist: z.string().optional() });

const JSON_OVERRIDE = `
---
SITE BUILDER INTEGRATION — Output valid JSON only. No markdown, no explanation, no code fences.
Produce ONLY a JSON object with the keys specified below. Do not include any other text.
---`;

const PHASE2_ANTI_SAMENESS = `
---
COLOR ANTI-SAMENESS — For health/fitness/coaching: FORBIDDEN greens (#22c55e, #10b981, #059669, #047857).
Use teal, coral, indigo, amber, or slate instead. Vary hue by client name — pick from a 12-hue wheel so no two clients look identical.
---`;

/** Format contract so site-builder parsers can extract values. Frontend uses these exact patterns. */
const PHASE2_SITE_BUILDER_FORMAT = `
---
SITE BUILDER FORMAT — Output MUST use these exact patterns so the frontend can apply your design:
- typographyScale: "H1:48px H2:36px body:16px" (include H1:, H2:, body: with px or rem values)
- spacingSystem: "8px grid, section:64px" (include "Npx grid" and "section:Npx" or "section:Nrem")
- layoutPatterns: "max-width:1280px" or "Breakpoints 375/768/1440" (include max-width:Npx for container)
- animationGuidelines: "Fade-up 0.6s" (include duration like 0.5s or 0.6s)
- wcagNotes: "Contrast 4.5:1 min" (any non-empty string enables focus rings)
---`;

const PHASE6_SITE_BUILDER_FORMAT = `
---
SITE BUILDER FORMAT — animationSpecs MUST include "fade-up" or "fade" so the frontend applies hero/section animations. Example: "Page load: hero fade-up 0.6s. Scroll: stagger 0.1s."
---`;

const PHASE7_SITE_BUILDER_FORMAT = `
---
SITE BUILDER FORMAT — responsiveSpecs MUST include "1440" and "3-col" or "three" or "full" for 3-column grid on desktop. Example: "375: stack. 768: 2-col. 1440: 3-col full."
---`;

function buildUserPrompt(ctx: SiteBriefContext, priorPhases: Record<string, unknown>): string {
  const parts: string[] = [
    `Client: ${ctx.clientName}`,
    `Business/Title: ${ctx.title}`,
    `Industry: ${ctx.industry}`,
  ];
  if (ctx.description) parts.push(`Description: ${ctx.description.slice(0, 600)}`);
  if (ctx.feltProblem) parts.push(`Felt problem: ${ctx.feltProblem}`);
  if (ctx.reframedOffer) parts.push(`Reframed offer: ${ctx.reframedOffer}`);
  if (ctx.blueOceanAngle) parts.push(`Blue ocean: ${ctx.blueOceanAngle}`);
  if (ctx.enrichmentSummary) parts.push(`Enrichment: ${ctx.enrichmentSummary.slice(0, 400)}`);
  if (ctx.proposalContent) parts.push(`Proposal/scope (for context only; do NOT use verbatim for hero — use description, felt problem, reframed offer for hero):\n---\n${ctx.proposalContent.slice(0, 1500)}\n---`);
  if (Object.keys(priorPhases).length > 0) {
    parts.push(`Prior phases (for context): ${JSON.stringify(priorPhases, null, 2).slice(0, 2000)}`);
  }
  return parts.join("\n\n");
}

async function runPhase(
  phaseNum: number,
  skillName: string,
  jsonKeys: string,
  schema: z.ZodType,
  ctx: SiteBriefContext,
  priorPhases: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const skillContent = loadSkill(skillName);
  const phaseOverride =
    phaseNum === 2
      ? PHASE2_ANTI_SAMENESS + PHASE2_SITE_BUILDER_FORMAT
      : phaseNum === 6
        ? PHASE6_SITE_BUILDER_FORMAT
        : phaseNum === 7
          ? PHASE7_SITE_BUILDER_FORMAT
          : "";
  const system = skillContent
    ? `${skillContent}${phaseOverride}${JSON_OVERRIDE}\n\nOutput a JSON object with exactly these keys: ${jsonKeys}`
    : `Output valid JSON with keys: ${jsonKeys}. Use client context to populate.`;

  const user = buildUserPrompt(ctx, priorPhases);

  const { content } = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model: "claude-sonnet-4-20250514", temperature: 0.3, max_tokens: 4096 },
  );

  try {
    const parsed = safeParseJSON(content, schema);
    return parsed as Record<string, unknown>;
  } catch {
    // Schema failed — parse raw and normalize to expected shape
    let raw: Record<string, unknown>;
    try {
      raw = safeParseJSON(content) as Record<string, unknown>;
    } catch {
      raw = {};
    }
    return normalizePhaseOutput(phaseNum, raw);
  }
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
      // Map content-architect output to expected clientInfo shape
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

/**
 * Run all 9 phases sequentially and merge into EnrichedSiteBrief.
 * Feels like one call from the caller's perspective.
 */
export async function enrichSiteBrief9Phases(
  ctx: SiteBriefContext,
  proposalContent?: string | null,
): Promise<EnrichedSiteBrief | null> {
  const priorPhases: Record<string, unknown> = {};
  let merged: Partial<EnrichedSiteBrief> = {};

  const phases: Array<{
    num: number;
    skill: string;
    keys: string;
    schema: z.ZodType;
  }> = [
    { num: 1, skill: "architecture-strategist", keys: "scope, siteMap, userFlows", schema: Phase1Schema },
    { num: 2, skill: "design-system-generator", keys: "brandColors, designSystem", schema: Phase2Schema },
    { num: 3, skill: "content-architect", keys: "contentHints, clientInfo", schema: Phase3Schema },
    { num: 4, skill: "component-logic-builder", keys: "componentLogic", schema: Phase4Schema },
    { num: 5, skill: "figma-make-prompt-engineer", keys: "figmaMakePrompts", schema: Phase5Schema },
    { num: 6, skill: "animation-interaction-designer", keys: "animationSpecs", schema: Phase6Schema },
    { num: 7, skill: "responsive-behavior-strategist", keys: "responsiveSpecs", schema: Phase7Schema },
    { num: 8, skill: "data-integration-planner", keys: "dataIntegration", schema: Phase8Schema },
    { num: 9, skill: "qa-optimization-checklist", keys: "qaChecklist", schema: Phase9Schema },
  ];

  try {
    for (const { num, skill, keys, schema } of phases) {
      const out = await runPhase(num, skill, keys, schema, ctx, priorPhases);
      Object.assign(priorPhases, out);
      merged = { ...merged, ...out };
    }

    // Ensure scope exists
    if (!merged.scope?.length) {
      merged.scope = ["homepage", "about", "services", "contact", "footer"];
    }

    // Anti-generic hero subhead retry
    if (
      merged.clientInfo?.heroSubhead &&
      isHeroSubheadGeneric(merged.clientInfo.heroSubhead) &&
      proposalContent
    ) {
      const { content: fixRaw } = await chat(
        [
          {
            role: "system",
            content: "Output valid JSON only. heroSubhead: 10–15 words verbatim from proposal. No generic phrases.",
          },
          {
            role: "user",
            content: `heroSubhead "${merged.clientInfo.heroSubhead}" is too generic. Choose a DIFFERENT 10–15 word substring from:\n---\n${proposalContent.slice(0, 1500)}\n---\nOutput: {"heroSubhead": "..."}`,
          },
        ],
        { model: "claude-sonnet-4-20250514", temperature: 0.2, max_tokens: 256 },
      );
      const fixSchema = z.object({ heroSubhead: z.string() });
      const fixParsed = safeParseJSON(fixRaw, fixSchema);
      if (fixParsed?.heroSubhead && !isHeroSubheadGeneric(fixParsed.heroSubhead)) {
        merged = {
          ...merged,
          clientInfo: { ...merged.clientInfo!, heroSubhead: fixParsed.heroSubhead },
        };
      } else {
        const fallback = ctx.reframedOffer ?? ctx.description;
        const fallbackSubhead = fallback ? fallback.split(/\s+/).slice(0, 15).join(" ") : undefined;
        if (fallbackSubhead && !isHeroSubheadGeneric(fallbackSubhead)) {
          merged = {
            ...merged,
            clientInfo: { ...merged.clientInfo!, heroSubhead: fallbackSubhead },
          };
        }
      }
    }

    return merged as EnrichedSiteBrief;
  } catch (err) {
    console.error("[enrich-site-brief-9phases] Phase failed:", err);
    return null;
  }
}
