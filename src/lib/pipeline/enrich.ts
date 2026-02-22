import { db } from "@/lib/db";
import { chat, type ChatUsage } from "@/lib/llm";
import { isDryRun } from "@/lib/pipeline/dry-run";
import type { Provenance } from "@/lib/pipeline/provenance";
import { LeadIntelligenceSchema, type LeadIntelligence } from "@/lib/lead-intelligence/schema";

const ENRICH_PROMPT = `You are a lead analyst for a freelance software developer. Analyze this lead and extract structured information.

Lead title: {title}
Source: {source}
Description: {description}

Extract and return a JSON object with these fields:

**Core:** budget (string), timeline (string), platform (string), techStack (array of strings), requirements (array of 3-5 strings), riskFlags (array of strings), category (one of "marketplace", "dashboard", "automation", "ai-integration", "mobile-app", "saas", "landing-page", "other").

**Lead intelligence (human risk — required for proposal safety). Be conservative; use "unknown" when unclear:**
- adoptionRisk: { level: "low"|"medium"|"high"|"unknown", reasons: string[], trustFriction?: string[] } — What will they resist? Why? trustFriction: what could make them hesitate (complexity, reliability, ownership).
- toolLoyaltyRisk: { level, currentTools?, notes?, lockInConcerns?: string[], migrationSensitivity?: "low"|"medium"|"high" } — What tools might they resist replacing? lockInConcerns: concerns about switching.
- reversibility: { strategy, lowRiskStart?, rollbackPlan?, level?: "easy"|"moderate"|"hard", pilotFirst?: boolean } — What can be phased/rolled back? pilotFirst: true = recommend pilot first.
- stakeholderMap: array of { role, who?, caresAbout[], likelyObjection?, influence?, stance?, needsToFeelSafeAbout?: string[], notes? } — Who is the buyer, who approves, who might block; what do they need to feel safe about?
- trustSensitivity, changeSurface, safeStartingPoint, rolloutNotes (as before).

Rules: Prefer reversible, pilot-first. If uncertain, use medium risk and stance "unknown". Stakeholders: owner, ops manager, approvers, likely blockers.

Return ONLY valid JSON, no markdown fences.`;

export async function runEnrich(leadId: string, provenance?: Provenance): Promise<{ artifactId: string; usage?: ChatUsage }> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const meta = provenance ? { provenance } : undefined;
  if (isDryRun()) {
    await db.lead.update({
      where: { id: leadId },
      data: {
        budget: lead.budget || "Not specified",
        timeline: lead.timeline || "Not specified",
        platform: lead.platform || "web",
        techStack: lead.techStack?.length ? lead.techStack : ["React", "Node.js"],
        status: "ENRICHED",
        enrichedAt: new Date(),
      },
    });
    const artifact = await db.artifact.create({
      data: {
        leadId,
        type: "notes",
        title: "AI Enrichment Report",
        content: "**[DRY RUN]** Placeholder enrichment. Set PIPELINE_DRY_RUN=0 and OPENAI_API_KEY for real run.",
        ...(meta ? { meta } : {}),
      },
    });
    return { artifactId: artifact.id };
  }

  const prompt = ENRICH_PROMPT
    .replace("{title}", lead.title)
    .replace("{source}", lead.source)
    .replace("{description}", lead.description || "No description provided");

  const { content, usage } = await chat(
    [
      { role: "system", content: "You are a precise lead analyst. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3, max_tokens: 1024 }
  );

  const enriched = JSON.parse(content);

  let leadIntelligence: LeadIntelligence | null = null;
  const liInput: Record<string, unknown> = {
    adoptionRisk: {
      ...(enriched.adoptionRisk && typeof enriched.adoptionRisk === "object" ? enriched.adoptionRisk : {}),
      reasons: Array.isArray(enriched.adoptionRisk?.reasons) ? enriched.adoptionRisk.reasons : [],
      trustFriction: Array.isArray((enriched.adoptionRisk as { trustFriction?: string[] })?.trustFriction) ? (enriched.adoptionRisk as { trustFriction: string[] }).trustFriction : [],
    },
    toolLoyaltyRisk: {
      ...(enriched.toolLoyaltyRisk && typeof enriched.toolLoyaltyRisk === "object" ? enriched.toolLoyaltyRisk : {}),
      lockInConcerns: Array.isArray((enriched.toolLoyaltyRisk as { lockInConcerns?: string[] })?.lockInConcerns) ? (enriched.toolLoyaltyRisk as { lockInConcerns: string[] }).lockInConcerns : [],
      migrationSensitivity: (enriched.toolLoyaltyRisk as { migrationSensitivity?: string })?.migrationSensitivity,
    },
    reversibility: {
      ...(enriched.reversibility && typeof enriched.reversibility === "object" ? enriched.reversibility : {}),
      pilotFirst: typeof (enriched.reversibility as { pilotFirst?: boolean })?.pilotFirst === "boolean" ? (enriched.reversibility as { pilotFirst: boolean }).pilotFirst : undefined,
    },
    stakeholderMap: Array.isArray(enriched.stakeholderMap) ? enriched.stakeholderMap : [],
  };
  if (enriched.trustSensitivity != null) liInput.trustSensitivity = enriched.trustSensitivity;
  if (Array.isArray(enriched.changeSurface)) liInput.changeSurface = enriched.changeSurface;
  if (enriched.safeStartingPoint != null) liInput.safeStartingPoint = enriched.safeStartingPoint;
  if (enriched.rolloutNotes != null) liInput.rolloutNotes = enriched.rolloutNotes;
  const parsed = LeadIntelligenceSchema.safeParse(liInput);
  if (parsed.success) leadIntelligence = parsed.data;

  await db.lead.update({
    where: { id: leadId },
    data: {
      budget: enriched.budget || lead.budget,
      timeline: enriched.timeline || lead.timeline,
      platform: enriched.platform || lead.platform,
      techStack: enriched.techStack || lead.techStack,
      status: "ENRICHED",
      enrichedAt: new Date(),
    },
  });

  const artifactMeta: Record<string, unknown> = { ...(provenance ? { provenance } : {}) };
  if (leadIntelligence) artifactMeta.leadIntelligence = leadIntelligence;

  const artifact = await db.artifact.create({
    data: {
      leadId,
      type: "notes",
      title: "AI Enrichment Report",
      meta: Object.keys(artifactMeta).length ? (artifactMeta as object) : undefined,
      content: [
        `**Category:** ${enriched.category}`,
        `**Budget:** ${enriched.budget}`,
        `**Timeline:** ${enriched.timeline}`,
        `**Platform:** ${enriched.platform}`,
        `**Tech Stack:** ${(enriched.techStack || []).join(", ")}`,
        "",
        "**Requirements:**",
        ...(enriched.requirements || []).map((r: string) => `- ${r}`),
        "",
        "**Risk Flags:**",
        ...(enriched.riskFlags || []).map((r: string) => `- ⚠️ ${r}`),
        ...(leadIntelligence
          ? [
              "",
              "**Lead intelligence (risk & stakeholders):**",
              `- Adoption risk: ${leadIntelligence.adoptionRisk.level} — ${leadIntelligence.adoptionRisk.reasons.join("; ") || "—"}${(leadIntelligence.adoptionRisk as { trustFriction?: string[] }).trustFriction?.length ? `; trust friction: ${(leadIntelligence.adoptionRisk as { trustFriction: string[] }).trustFriction.join("; ")}` : ""}`,
              `- Tool loyalty risk: ${leadIntelligence.toolLoyaltyRisk.level}${leadIntelligence.toolLoyaltyRisk.currentTools?.length ? ` (${leadIntelligence.toolLoyaltyRisk.currentTools.join(", ")})` : ""}${(leadIntelligence.toolLoyaltyRisk as { lockInConcerns?: string[] }).lockInConcerns?.length ? `; lock-in: ${(leadIntelligence.toolLoyaltyRisk as { lockInConcerns: string[] }).lockInConcerns.join("; ")}` : ""}${(leadIntelligence.toolLoyaltyRisk as { migrationSensitivity?: string }).migrationSensitivity ? `; migration sensitivity: ${(leadIntelligence.toolLoyaltyRisk as { migrationSensitivity: string }).migrationSensitivity}` : ""}${leadIntelligence.toolLoyaltyRisk.notes ? ` — ${leadIntelligence.toolLoyaltyRisk.notes}` : ""}`,
              `- Reversibility: ${leadIntelligence.reversibility.strategy}${leadIntelligence.reversibility.lowRiskStart ? `; low-risk start: ${leadIntelligence.reversibility.lowRiskStart}` : ""}${(leadIntelligence.reversibility as { pilotFirst?: boolean }).pilotFirst === true ? "; pilot first" : ""}`,
              ...(leadIntelligence.trustSensitivity ? [`- Trust sensitivity: ${leadIntelligence.trustSensitivity}`] : []),
              ...(leadIntelligence.changeSurface?.length ? [`- Change surface: ${leadIntelligence.changeSurface.join(", ")}`] : []),
              ...(leadIntelligence.safeStartingPoint ? [`- Safe starting point: ${leadIntelligence.safeStartingPoint}`] : []),
              ...(leadIntelligence.rolloutNotes ? [`- Rollout notes: ${leadIntelligence.rolloutNotes}`] : []),
              ...leadIntelligence.stakeholderMap.map(
                (s) => `- ${s.role}${s.who ? ` (${s.who})` : ""}${s.influence ? ` [${s.influence}]` : ""}${s.stance ? ` ${s.stance}` : ""}: ${s.caresAbout.join(", ")}${s.likelyObjection ? `; objection: ${s.likelyObjection}` : ""}${s.notes ? ` — ${s.notes}` : ""}`
              ),
            ]
          : []),
      ].join("\n"),
    },
  });

  return { artifactId: artifact.id, usage };
}
