/**
 * GET /api/internal/test/builder-gen-input?projectId=xxx
 *
 * E2E-only: Returns the genInput that would be sent to the builder for content generation.
 * Used by Playwright to verify all 9 phases are passed. Only available when E2E_TEST_MODE=1.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireAuth, requireDeliveryProject } from "@/lib/api-utils";
import { ENRICHMENT_ARTIFACT_TYPE, ENRICHMENT_ARTIFACT_TITLE } from "@/lib/pipeline/enrich";

const NINE_PHASE_KEYS = [
  "siteMap",
  "userFlows",
  "designSystem",
  "componentLogic",
  "figmaMakeDesignIntent",
  "animationSpecs",
  "responsiveSpecs",
  "dataIntegration",
  "qaChecklist",
] as const;

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return jsonError("Unauthorized", 401);

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return jsonError("projectId required", 400);

  const result = await requireDeliveryProject(projectId, {
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
    },
  });
  if (!result.ok) return result.response;
  const { project } = result;

  const { enrichSiteBrief, packContentHintsForBuilder } = await import("@/lib/builder/enrich-site-brief");
  const forceLegacy =
    process.env.E2E_TEST_MODE === "1" ||
    (process.env.NODE_ENV !== "production" && req.headers.get("x-e2e-force-legacy") === "1");
  const enrichment = await enrichSiteBrief(projectId, { forceLegacy });

  const defaultScope = ["homepage", "about", "services", "contact"];
  const scope = enrichment?.scope ?? defaultScope;
  const contentHints = enrichment
    ? packContentHintsForBuilder(enrichment.contentHints, enrichment.clientInfo)
    : undefined;

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
      db.artifact.findFirst({ where: { leadId, type: "positioning" }, orderBy: { createdAt: "desc" } }),
    ]);
  }

  const posData = (positionArtifact?.meta as Record<string, unknown> | null)
    ?.positioning as Record<string, unknown> | undefined;
  const enrichData = (enrichArtifact?.meta as Record<string, unknown> | null)
    ?.leadIntelligence as Record<string, unknown> | undefined;
  const lead = project.pipelineLead as {
    title?: string;
    contactName?: string;
    description?: string;
    scoreVerdict?: string;
    scoreReason?: string;
  } | null;

  // Use null (not undefined) for 9-phase keys so they appear in JSON — test asserts key in ci
  const orNull = <T>(v: T | undefined): T | null => (v != null && v !== "" ? v : null);
  const genInput = {
    sections: scope,
    clientInfo: {
      name: project.clientName ?? lead?.contactName ?? project.title,
      niche: (posData?.feltProblem as string | undefined) ?? undefined,
      bio: contentHints ?? enrichArtifact?.content?.slice(0, 1500) ?? lead?.description ?? undefined,
      heroHeadline: enrichment?.clientInfo?.heroHeadline,
      heroSubhead: enrichment?.clientInfo?.heroSubhead,
      ctaPrimary: enrichment?.clientInfo?.ctaPrimary,
      features: enrichment?.clientInfo?.features,
      testimonials: enrichment?.clientInfo?.testimonials,
      faq: enrichment?.clientInfo?.faq,
      footerTagline: enrichment?.clientInfo?.footerTagline,
      designSystem: orNull(enrichment?.designSystem),
      componentLogic: orNull(enrichment?.componentLogic),
      figmaMakeDesignIntent: orNull(enrichment?.figmaMakePrompts?.[0]),
      animationSpecs: orNull(enrichment?.animationSpecs),
      responsiveSpecs: orNull(enrichment?.responsiveSpecs),
      dataIntegration: orNull(enrichment?.dataIntegration),
      qaChecklist: orNull(enrichment?.qaChecklist),
      siteMap: orNull(enrichment?.siteMap),
      userFlows: orNull(enrichment?.userFlows),
      tone: enrichment?.clientInfo?.tone ?? "professional, warm, approachable",
      feltProblem: posData?.feltProblem as string | undefined,
      reframedOffer: posData?.reframedOffer as string | undefined,
      blueOceanAngle: posData?.blueOceanAngle as string | undefined,
      languageMap: posData?.languageMap as string | undefined,
      scoreVerdict: lead?.scoreVerdict ?? undefined,
      scoreReason: lead?.scoreReason ?? undefined,
      enrichmentSummary: enrichArtifact?.content?.slice(0, 800),
      trustSensitivity: enrichData?.trustSensitivity as string | undefined,
      safeStartingPoint: enrichData?.safeStartingPoint as string | undefined,
    },
  };

  const ci = genInput.clientInfo as Record<string, unknown>;
  const present = NINE_PHASE_KEYS.filter((k) => ci[k] != null && ci[k] !== "");
  const missing = NINE_PHASE_KEYS.filter((k) => ci[k] == null || ci[k] === "");

  return NextResponse.json({
    genInput,
    ninePhaseAudit: {
      present,
      missing,
      allPresent: missing.length === 0,
    },
  });
}
