/**
 * Site brief enrichment — 9-phase orchestration or legacy single-call.
 * Produces brandColors, clientInfo (hero, features, CTA), design spec for builder.
 */

import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { safeParseJSON } from "@/lib/llm/safe-parse-json";
import { z } from "zod";
import { enrichSiteBrief9Phases } from "./enrich-site-brief-9phases";
import { buildSiteBrief9Prompt, isHeroSubheadGeneric } from "./site-brief-9";
import type { SiteBriefContext } from "./site-brief-prompt";
import { ENRICHMENT_ARTIFACT_TYPE, ENRICHMENT_ARTIFACT_TITLE } from "@/lib/pipeline/enrich";

const EnrichedSiteBriefSchema = z.object({
  scope: z.array(z.string()).min(1),
  siteMap: z.string().optional(),
  userFlows: z.string().optional(),
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
  componentLogic: z.string().optional(),
  figmaMakePrompts: z.array(z.string()).optional(),
  animationSpecs: z.string().optional(),
  responsiveSpecs: z.string().optional(),
  dataIntegration: z.string().optional(),
  qaChecklist: z.string().optional(),
});

export type EnrichedSiteBrief = z.infer<typeof EnrichedSiteBriefSchema>;

/**
 * Build contentHints prose from enriched clientInfo (hero, features, CTA).
 * Pack into contentHints so builder's AI can use it — no API changes needed.
 */
export function packContentHintsForBuilder(
  baseHints: string | undefined,
  clientInfo: EnrichedSiteBrief["clientInfo"],
): string {
  if (!clientInfo) return baseHints ?? "";

  const parts: string[] = [];
  if (baseHints?.trim()) parts.push(baseHints.trim());

  if (clientInfo.heroHeadline) parts.push(`Hero headline (6 words): ${clientInfo.heroHeadline}`);
  if (clientInfo.heroSubhead) parts.push(`Hero subhead (15 words): ${clientInfo.heroSubhead}`);
  if (clientInfo.ctaPrimary) parts.push(`Primary CTA: ${clientInfo.ctaPrimary}`);
  if (clientInfo.features?.length) {
    clientInfo.features.forEach((f, i) => parts.push(`Feature ${i + 1}: ${f.title} — ${f.body}`));
  }
  if (clientInfo.testimonials?.length) {
    clientInfo.testimonials.forEach((t, i) => parts.push(`Testimonial ${i + 1}: "${t.quote}" — ${t.author}, ${t.role}`));
  }
  if (clientInfo.faq?.length) {
    clientInfo.faq.forEach((f, i) => parts.push(`FAQ ${i + 1}: Q: ${f.q} A: ${f.a}`));
  }
  if (clientInfo.footerTagline) parts.push(`Footer: ${clientInfo.footerTagline}`);
  if (clientInfo.tone) parts.push(`Tone: ${clientInfo.tone}`);

  return (parts.join("\n\n") || baseHints) ?? "";
}

/**
 * Enrich site brief for a delivery project. Fetches project, lead, artifacts,
 * calls LLM, returns structured output. Returns null on error (caller falls back).
 * @param opts.forceLegacy — Use legacy single-call (faster). E2E tests can pass this via header.
 */
export async function enrichSiteBrief(
  deliveryProjectId: string,
  opts?: { forceLegacy?: boolean },
): Promise<EnrichedSiteBrief | null> {
  const project = await db.deliveryProject.findUnique({
    where: { id: deliveryProjectId },
    include: {
      pipelineLead: {
        select: {
          id: true,
          title: true,
          description: true,
          contactName: true,
          scoreVerdict: true,
          scoreReason: true,
        },
      },
      proposal: {
        select: { summary: true, scopeOfWork: true, title: true },
      },
    },
  });

  if (!project) return null;

  const leadId = project.pipelineLeadId ?? project.intakeLeadId;
  let enrichArtifact: { content: string; meta: unknown } | null = null;
  let positionArtifact: { content: string; meta: unknown } | null = null;

  if (leadId) {
    [enrichArtifact, positionArtifact] = await Promise.all([
      db.artifact.findFirst({
        where: {
          leadId,
          OR: [
            { type: ENRICHMENT_ARTIFACT_TYPE, title: ENRICHMENT_ARTIFACT_TITLE },
            { type: "notes", title: ENRICHMENT_ARTIFACT_TITLE },
          ],
        },
        orderBy: { createdAt: "desc" },
      }),
      db.artifact.findFirst({
        where: { leadId, type: "positioning" },
        orderBy: { createdAt: "desc" },
      }),
    ]);
  }

  const posData = (positionArtifact?.meta as Record<string, unknown> | null)
    ?.positioning as Record<string, unknown> | undefined;
  const lead = project.pipelineLead as
    | {
        title?: string;
        description?: string;
        contactName?: string;
        scoreVerdict?: string;
        scoreReason?: string;
      }
    | null;

  const proposal = project.proposal as { summary?: string | null; scopeOfWork?: string | null; title?: string } | null;
  const proposalContent = proposal
    ? [proposal.summary, proposal.scopeOfWork].filter(Boolean).join("\n\n")
    : undefined;

  const ctx: SiteBriefContext = {
    clientName: project.clientName ?? project.title,
    title: project.title,
    industry: project.builderPreset ?? "custom",
    description: lead?.description ?? project.summary ?? undefined,
    feltProblem: posData?.feltProblem as string | undefined,
    reframedOffer: posData?.reframedOffer as string | undefined,
    blueOceanAngle: posData?.blueOceanAngle as string | undefined,
    languageMap: posData?.languageMap as unknown,
    packaging: posData?.packaging as SiteBriefContext["packaging"],
    enrichmentSummary: enrichArtifact?.content?.slice(0, 800) ?? undefined,
    scoreVerdict: lead?.scoreVerdict ?? undefined,
    scoreReason: lead?.scoreReason ?? undefined,
    proposalContent: proposalContent?.slice(0, 2000),
  };

  const useLegacy =
    opts?.forceLegacy === true ||
    process.env.ENRICH_9_PHASES === "0" ||
    process.env.E2E_TEST_MODE === "1";

  if (useLegacy) {
    const { system, user } = buildSiteBrief9Prompt(ctx);
    try {
      const { content: raw } = await chat(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { model: "claude-sonnet-4-20250514", temperature: 0.3, max_tokens: 4096 },
      );
      const parsed = safeParseJSON(raw, EnrichedSiteBriefSchema);
      if (!parsed) return null;
      if (
        parsed.clientInfo?.heroSubhead &&
        isHeroSubheadGeneric(parsed.clientInfo.heroSubhead) &&
        proposalContent
      ) {
        const fallbackSource = [ctx.reframedOffer, ctx.description].filter(Boolean).join("\n\n").slice(0, 1200);
        const { content: fixRaw } = await chat(
          [
            {
              role: "system",
              content: "Output valid JSON only. heroSubhead: 10–15 words, client-facing value prop from reframed offer or description. NOT proposal scope.",
            },
            {
              role: "user",
              content: `heroSubhead "${parsed.clientInfo.heroSubhead}" is too generic. Choose 10–15 words from:\n---\n${fallbackSource || (proposalContent?.slice(0, 1200) ?? "")}\n---\nOutput: {"heroSubhead": "..."}`,
            },
          ],
          { model: "claude-sonnet-4-20250514", temperature: 0.2, max_tokens: 256 },
        );
        const fixSchema = z.object({ heroSubhead: z.string() });
        const fixParsed = safeParseJSON(fixRaw, fixSchema);
        if (fixParsed?.heroSubhead && !isHeroSubheadGeneric(fixParsed.heroSubhead)) {
          parsed.clientInfo = { ...parsed.clientInfo!, heroSubhead: fixParsed.heroSubhead };
        } else {
          const fallback = ctx.reframedOffer ?? ctx.description;
          const fallbackSubhead = fallback ? fallback.split(/\s+/).slice(0, 15).join(" ") : undefined;
          if (fallbackSubhead && !isHeroSubheadGeneric(fallbackSubhead)) {
            parsed.clientInfo = { ...parsed.clientInfo!, heroSubhead: fallbackSubhead };
          }
        }
      }
      return parsed;
    } catch (err) {
      console.error("[enrich-site-brief] Legacy LLM failed:", err);
      return null;
    }
  }

  return enrichSiteBrief9Phases(ctx, proposalContent ?? undefined);
}
