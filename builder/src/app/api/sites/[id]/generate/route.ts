/**
 * POST /api/sites/[id]/generate — Generate content with LLM.
 * CRITICAL: Uses brandColors for theme (never green default).
 * Injects designSystem, animationSpecs, etc. into prompt for stylish output.
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { requireBuilderApiKey } from "@/lib/require-api-key";
import { getTheme } from "@/lib/themes";

function requireAuth(req: NextRequest): boolean {
  return requireBuilderApiKey(req);
}

type SectionProps = Record<string, unknown>;

function buildContextBlocks(ci: Record<string, unknown>): string[] {
  const blocks: string[] = [];
  if (ci.siteMap) blocks.push(`[Phase 1] Site map: ${ci.siteMap}`);
  if (ci.userFlows) blocks.push(`[Phase 1] User flows: ${ci.userFlows}`);
  const ds = ci.designSystem as Record<string, string> | undefined;
  if (ds) {
    if (ds.typographyScale) blocks.push(`[Phase 2] Typography: ${ds.typographyScale}`);
    if (ds.spacingSystem) blocks.push(`[Phase 2] Spacing: ${ds.spacingSystem}`);
    if (ds.layoutPatterns) blocks.push(`[Phase 2] Layout: ${ds.layoutPatterns}`);
    if (ds.animationGuidelines) blocks.push(`[Phase 2] Animation: ${ds.animationGuidelines}`);
    if (ds.wcagNotes) blocks.push(`[Phase 2] WCAG: ${ds.wcagNotes}`);
  }
  if (ci.figmaMakeDesignIntent) blocks.push(`[Phase 5] Design intent: ${ci.figmaMakeDesignIntent}`);
  if (ci.animationSpecs) blocks.push(`[Phase 6] Animation specs: ${ci.animationSpecs}`);
  if (ci.responsiveSpecs) blocks.push(`[Phase 7] Responsive: ${ci.responsiveSpecs}`);
  if (ci.dataIntegration) blocks.push(`[Phase 8] Data: ${ci.dataIntegration}`);
  if (ci.componentLogic) blocks.push(`[Phase 4] Component logic: ${ci.componentLogic}`);
  if (ci.qaChecklist) blocks.push(`[Phase 9] QA: ${ci.qaChecklist}`);
  return blocks;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let site = await prisma.site.findUnique({ where: { id } });

  const body = await req.json();
  const clientInfo = (body.clientInfo ?? {}) as Record<string, unknown>;
  const sections: string[] = body.sections ?? ["hero", "about", "services", "contact"];

  // Create site if missing (e.g. migrated from another builder)
  if (!site) {
    const baseUrl = process.env.BUILDER_PUBLIC_URL ?? "http://localhost:3001";
    site = await prisma.site.create({
      data: {
        id,
        clientName: (clientInfo.name as string) ?? "Client",
        industry: "custom",
        status: "draft",
        pages: JSON.stringify(sections),
        sections: JSON.stringify(sections.map((s) => ({ type: s, props: {} }))),
        previewUrl: `${baseUrl}/preview/${id}`,
      },
    });
  }

  const brandColors: string[] | undefined = body.brandColors;

  // Store themeColorsJson from brandColors — MUST be used in preview
  const themeColorsJson = brandColors?.length ? JSON.stringify(brandColors) : site.themeColorsJson;
  const storedColors = themeColorsJson ? (JSON.parse(themeColorsJson) as string[]) : null;

  const theme = getTheme(site.industry, storedColors ?? brandColors);
  const designSpec = {
    themeColors: theme,
    designSystem: clientInfo.designSystem,
    animationSpecs: clientInfo.animationSpecs,
    responsiveSpecs: clientInfo.responsiveSpecs,
  };

  const contextBlocks = buildContextBlocks(clientInfo);
  const contextSection = contextBlocks.length
    ? `\n\n9-PHASE DESIGN SPEC — layout/design guidance only. Do NOT output this text as section body content:\n${contextBlocks.map((b) => `- ${b}`).join("\n")}`
    : "";

  const bio = (clientInfo.bio as string) ?? site.contentHints ?? "";
  const heroHeadline = (clientInfo.heroHeadline as string) ?? "Welcome";
  const heroSubhead = (clientInfo.heroSubhead as string) ?? "";
  const ctaPrimary = (clientInfo.ctaPrimary as string) ?? "Get Started";

  const prompt = `Generate website section content. Client: ${clientInfo.name ?? site.clientName}.
Bio/context: ${bio.slice(0, 1500)}
${contextSection}

CRITICAL RULES:
- Section content (title, body) MUST be client-facing marketing copy — About us, Services, benefits, value props. NOT proposal text, internal analysis, design specs, or typography/ spacing rules.
- The design spec above is for layout guidance only. Do NOT include typography, spacing, or WCAG text as section body copy.
- Use the provided design spec for styling. Do NOT use generic green (#22c55e, #10b981, #059669).
- Theme colors: primary=${theme.primary}, hero gradient ${theme.heroFrom}→${theme.heroTo}, accent=${theme.accent}.
- Output distinctive, client-specific copy. No stock phrases like "transform your life" or "science-backed".

Sections to generate: ${sections.join(", ")}.

For each section, output JSON: { "type": "sectionType", "props": { "title": "...", "body": "..." } }.
Hero MUST use: headline="${heroHeadline}", subhead="${heroSubhead}", ctaText="${ctaPrimary}".
Return a JSON array of section objects.`;

  let generatedSections: { type: string; props: SectionProps }[] = [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.find((c) => c.type === "text")?.type === "text"
      ? (msg.content.find((c) => c.type === "text") as { type: "text"; text: string }).text
      : "";
    try {
      const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
      generatedSections = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      generatedSections = sections.map((type) => ({
        type,
        props: {
          headline: heroHeadline,
          subhead: heroSubhead,
          ctaText: ctaPrimary,
          ctaLink: "#about",
        },
      }));
    }
  } else {
    generatedSections = sections.map((type) => ({
      type,
      props: {
        headline: heroHeadline,
        subhead: heroSubhead,
        ctaText: ctaPrimary,
        ctaLink: "#about",
      },
    }));
  }

  // Ensure hero has our content
  const heroIdx = generatedSections.findIndex((s) => s.type === "hero" || s.type === "homepage");
  if (heroIdx >= 0) {
    generatedSections[heroIdx]!.props = {
      ...generatedSections[heroIdx]!.props,
      headline: heroHeadline,
      subhead: heroSubhead,
      ctaText: ctaPrimary,
      ctaLink: "#about",
    };
  }

  await prisma.site.update({
    where: { id },
    data: {
      sections: JSON.stringify(generatedSections),
      themeColorsJson: themeColorsJson ?? site.themeColorsJson,
      designSpecJson: JSON.stringify(designSpec),
      status: "draft",
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    siteId: id,
    status: "draft",
    previewUrl: site.previewUrl,
    liveUrl: site.liveUrl,
    pages: JSON.parse(site.pages || "[]"),
    createdAt: site.createdAt.toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
