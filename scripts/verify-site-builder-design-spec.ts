/**
 * Verify site-builder design spec flow:
 * 1. Regenerate content for a delivery project (enrichment + generate)
 * 2. Check that designSpecJson is persisted on the site
 *
 * Run: npx tsx scripts/verify-site-builder-design-spec.ts [deliveryProjectId]
 */
import { db } from "../src/lib/db";
import { enrichSiteBrief, packContentHintsForBuilder } from "../src/lib/builder/enrich-site-brief";
import { generateContent, getSiteWithSections } from "../src/lib/builder/client";

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    const projects = await db.deliveryProject.findMany({
      where: { builderSiteId: { not: null } },
      select: { id: true, clientName: true, builderSiteId: true },
      take: 5,
    });
    console.log("Usage: npx tsx scripts/verify-site-builder-design-spec.ts <deliveryProjectId>");
    console.log("Available projects with builder sites:");
    projects.forEach((p) => console.log(`  ${p.id}  ${p.clientName}`));
    process.exit(1);
  }

  const project = await db.deliveryProject.findUnique({
    where: { id: projectId },
    include: { pipelineLead: true, proposal: true },
  });
  if (!project) {
    console.error("Project not found:", projectId);
    process.exit(1);
  }
  if (!project.builderSiteId) {
    console.error("Project has no builder site");
    process.exit(1);
  }

  console.log("Running enrichment...");
  const enrichment = await enrichSiteBrief(projectId);
  if (!enrichment) {
    console.error("Enrichment failed");
    process.exit(1);
  }

  const site = await getSiteWithSections(project.builderSiteId);
  const sections = site.sections.map((s) => ({ type: s.type, props: s.props }));

  const genInput = {
    sections: sections.map((s) => s.type),
    brandColors: enrichment.brandColors,
    clientInfo: {
      name: project.clientName ?? project.title,
      niche: (project.pipelineLead as { description?: string })?.description ?? site.contentHints ?? undefined,
      bio: packContentHintsForBuilder(site.contentHints ?? undefined, enrichment.clientInfo),
      heroHeadline: enrichment.clientInfo?.heroHeadline,
      heroSubhead: enrichment.clientInfo?.heroSubhead,
      ctaPrimary: enrichment.clientInfo?.ctaPrimary,
      features: enrichment.clientInfo?.features,
      testimonials: enrichment.clientInfo?.testimonials,
      faq: enrichment.clientInfo?.faq,
      footerTagline: enrichment.clientInfo?.footerTagline,
      designSystem: enrichment.designSystem,
      componentLogic: enrichment.componentLogic,
      figmaMakeDesignIntent: enrichment.figmaMakePrompts?.[0],
      animationSpecs: enrichment.animationSpecs,
      responsiveSpecs: enrichment.responsiveSpecs,
      dataIntegration: enrichment.dataIntegration,
      qaChecklist: enrichment.qaChecklist,
      siteMap: enrichment.siteMap,
      userFlows: enrichment.userFlows,
      tone: enrichment.clientInfo?.tone ?? "professional, warm, approachable",
    },
  };

  console.log("Calling generateContent...");
  await generateContent(project.builderSiteId, genInput);

  // Verify designSpecJson via site-builder API (site-builder has its own DB)
  const builderUrl = process.env.BUILDER_API_URL ?? "http://localhost:3001";
  const builderKey = process.env.BUILDER_API_KEY ?? "";
  const res = await fetch(`${builderUrl}/api/sites/${project.builderSiteId}`, {
    headers: builderKey ? { Authorization: `Bearer ${builderKey}` } : {},
  });
  if (res.ok) {
    const site = (await res.json()) as { designSpecJson?: string };
    if (site.designSpecJson) {
      console.log("✓ designSpecJson persisted");
    } else {
      console.log("✗ designSpecJson not in response (check site-builder schema)");
    }
  } else {
    console.log("Could not verify (site-builder returned", res.status, ")");
  }

  console.log("\nPreview URL:", project.builderPreviewUrl ?? `http://localhost:3001/preview/${project.builderSiteId}`);
  console.log("Admin:", `http://localhost:3001/sites/${project.builderSiteId}/admin`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
