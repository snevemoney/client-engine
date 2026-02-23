/**
 * Website/Project monetization mapping. Artifact-driven; no new DB tables.
 * Maps project slug -> [trust, lead_capture, conversion, delivery, proof, upsell].
 */

import { db } from "@/lib/db";
import { getOrCreateSystemLead } from "./systemLead";

/** Shared with client; do not add server-only imports to this constant. */
export const MONETIZATION_ROLES = [
  "trust",
  "lead_capture",
  "conversion",
  "delivery",
  "proof",
  "upsell",
] as const;

export type MonetizationRole = (typeof MONETIZATION_ROLES)[number];

const ARTIFACT_TYPE = "project_monetization";
const ARTIFACT_TITLE = "MONETIZATION_MAP";

export type ProjectMonetizationMap = Record<string, MonetizationRole[]>;

export async function getMonetizationMap(): Promise<ProjectMonetizationMap> {
  const leadId = await getOrCreateSystemLead();
  const artifact = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPE, title: ARTIFACT_TITLE },
    orderBy: { createdAt: "desc" },
    select: { meta: true },
  });
  if (!artifact?.meta || typeof artifact.meta !== "object") return {};
  const projectRoles = (artifact.meta as { projectRoles?: Record<string, string[]> }).projectRoles;
  if (!projectRoles || typeof projectRoles !== "object") return {};
  const out: ProjectMonetizationMap = {};
  for (const [slug, roles] of Object.entries(projectRoles)) {
    if (Array.isArray(roles))
      out[slug] = roles.filter((r): r is MonetizationRole => typeof r === "string" && MONETIZATION_ROLES.includes(r as MonetizationRole));
  }
  return out;
}

export async function updateMonetizationMap(projectRoles: ProjectMonetizationMap): Promise<void> {
  const leadId = await getOrCreateSystemLead();
  const existing = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPE, title: ARTIFACT_TITLE },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const content = [
    "# Project monetization map",
    "",
    "Which projects/pages serve which monetization role: trust, lead_capture, conversion, delivery, proof, upsell.",
    "",
    "| Project | Roles |",
    "|---------|-------|",
    ...Object.entries(projectRoles).map(([slug, roles]) => `| ${slug} | ${roles.join(", ") || "—"} |`),
  ].join("\n");

  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content, meta: { projectRoles } },
    });
  } else {
    await db.artifact.create({
      data: {
        leadId,
        type: ARTIFACT_TYPE,
        title: ARTIFACT_TITLE,
        content,
        meta: { projectRoles },
      },
    });
  }
}
