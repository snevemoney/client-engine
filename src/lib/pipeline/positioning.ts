import { db } from "@/lib/db";
import { chat, type ChatUsage } from "@/lib/llm";
import { isDryRun } from "@/lib/pipeline/dry-run";
import { PositioningMetaSchema } from "@/lib/pipeline/positioning-schema";
import type { Provenance } from "@/lib/pipeline/provenance";
import { parseLeadIntelligenceFromMeta } from "@/lib/lead-intelligence";

const POSITIONING_PROMPT = `You are a positioning strategist for a freelance full-stack developer. Given this lead, produce two outputs.

Lead:
Title: {title}
Description: {description}
Budget: {budget}
Timeline: {timeline}
Platform: {platform}
{leadIntelligenceBlock}

Output format (exactly):

---METADATA---
<valid JSON only, no markdown fences>
---BRIEF---
<2-4 short paragraphs in markdown>

JSON must match this shape:
{
  "feltProblem": "string (min 10 chars)",
  "languageMap": { "use": ["string"], "avoid": [], "competitorOveruse": [] },
  "reframedOffer": "string (min 10 chars)",
  "blueOceanAngle": "string (min 10 chars)",
  "packaging": { "solutionName": "string", "doNotMention": [], "hookOneLiner": "string (min 10 chars)" }
}

Then write the BRIEF: problem/outcome first, no generic intros.`;

/**
 * Run positioning for a lead; creates artifact type "positioning", title "POSITIONING_BRIEF".
 * Validates meta with Zod; throws on parse failure (VALIDATION).
 */
export async function runPositioning(
  leadId: string,
  provenance?: Provenance
): Promise<{ artifactId: string; usage?: ChatUsage }> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const enrichArtifact = await db.artifact.findFirst({
    where: { leadId, type: "notes", title: "AI Enrichment Report" },
    orderBy: { createdAt: "desc" },
  });
  const leadIntelligence = enrichArtifact?.meta ? parseLeadIntelligenceFromMeta(enrichArtifact.meta) : null;

  const leadIntelligenceBlock = leadIntelligence
    ? `
Lead intelligence (use to make positioning safer and easier to approve):
- Adoption risk: ${leadIntelligence.adoptionRisk?.level ?? "unknown"}. ${(leadIntelligence.adoptionRisk?.reasons ?? []).join("; ") || "—"}
- Tool loyalty risk: ${leadIntelligence.toolLoyaltyRisk?.level ?? "unknown"}. ${leadIntelligence.toolLoyaltyRisk?.notes ?? ""}
- Reversibility: ${leadIntelligence.reversibility?.strategy ?? ""}. Low-risk start: ${leadIntelligence.reversibility?.lowRiskStart ?? "—"}. Rollback: ${leadIntelligence.reversibility?.rollbackPlan ?? "—"}
- Stakeholders: ${(leadIntelligence.stakeholderMap ?? []).map((s) => `${s.role}${s.who ? ` (${s.who})` : ""}: ${(s.caresAbout ?? []).join(", ")}${s.likelyObjection ? `; objection: ${s.likelyObjection}` : ""}`).join(" | ") || "—"}

Positioning rules from lead intelligence: Reduce perceived risk in wording. Emphasize reversible first step if adoption risk is medium/high. Respect tool loyalty (position as augmentation/bridge if needed). Speak to stakeholder concerns directly.
`
    : `
Lead intelligence: not available. Use conservative, low-risk positioning and avoid forcing tool replacement language.
`;

  const dryRunMeta = provenance ? { provenance } : undefined;
  if (isDryRun()) {
    const artifact = await db.artifact.create({
      data: {
        leadId,
        type: "positioning",
        title: "POSITIONING_BRIEF",
        content: "**[DRY RUN]** Placeholder positioning brief.",
        meta: dryRunMeta ?? { provenance: { isDryRun: true, createdBy: "pipeline" as const } },
      },
    });
    return { artifactId: artifact.id };
  }

  const prompt = POSITIONING_PROMPT
    .replace("{title}", lead.title)
    .replace("{description}", lead.description || "No description")
    .replace("{budget}", lead.budget || "Not specified")
    .replace("{timeline}", lead.timeline || "Not specified")
    .replace("{platform}", lead.platform || "Not specified")
    .replace("{leadIntelligenceBlock}", leadIntelligenceBlock);

  const { content: raw, usage } = await chat(
    [
      { role: "system", content: "You output valid JSON then markdown. No extra text." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.4, max_tokens: 1024 }
  );

  const metaMatch = raw.match(/---METADATA---\s*([\s\S]*?)\s*---BRIEF---/);
  const briefMatch = raw.match(/---BRIEF---\s*([\s\S]*)/);
  const briefContent = briefMatch?.[1]?.trim() || raw;
  let parsedMeta: unknown = null;
  if (metaMatch?.[1]) {
    try {
      parsedMeta = JSON.parse(metaMatch[1].trim()) as unknown;
    } catch {
      const err = new Error("VALIDATION: Positioning meta JSON parse failed");
      (err as Error & { code?: string }).code = "VALIDATION";
      throw err;
    }
  }
  const parsed = PositioningMetaSchema.safeParse(parsedMeta);
  if (!parsed.success) {
    const err = new Error(`VALIDATION: Positioning meta invalid: ${parsed.error.message}`);
    (err as Error & { code?: string }).code = "VALIDATION";
    throw err;
  }

  const artifactMeta: Record<string, unknown> = {
    positioning: parsed.data,
    ...(provenance && { provenance }),
    ...(leadIntelligence && { leadIntelligence }),
  };
  const artifact = await db.artifact.create({
    data: {
      leadId,
      type: "positioning",
      title: "POSITIONING_BRIEF",
      content: briefContent,
      meta: artifactMeta as object,
    },
  });

  return { artifactId: artifact.id, usage };
}
