/**
 * Lead intelligence: human-risk dimensions for sales-engineering decisions.
 * Stored in Artifact.meta (artifact type "lead_intelligence" or in enrichment/positioning meta).
 * See docs/CLIENT_ENGINE_AXIOMS.md §6 and docs/LEAD_INTELLIGENCE_SCHEMA.md.
 * No new DB tables—use existing Artifact.meta.
 */

import { z } from "zod";

/** Structured schema for pipeline-produced lead intelligence (enrich step). Tolerant of "unknown" and partial data. */
export const RiskLevelSchema = z.enum(["low", "medium", "high", "unknown"]);
export const AdoptionRiskLevelSchema = z.enum(["low", "medium", "high"]);
export const ToolLoyaltyRiskLevelSchema = z.enum(["low", "medium", "high"]);
export const ReversibilityLevelSchema = z.enum(["easy", "moderate", "hard"]);
export const InfluenceSchema = z.enum(["low", "medium", "high"]);
export const StanceSchema = z.enum(["supportive", "neutral", "skeptical", "unknown"]);
export const TrustSensitivitySchema = z.enum(["low", "medium", "high"]);

export const StakeholderSchema = z.object({
  role: z.string(),
  who: z.string().optional(),
  caresAbout: z.array(z.string()).default([]),
  likelyObjection: z.string().optional(),
  likelyConcern: z.string().optional(),
  whatMakesThemFeelSafe: z.string().optional(),
  needsToFeelSafeAbout: z.array(z.string()).default([]),
  influence: InfluenceSchema.optional(),
  stance: StanceSchema.optional(),
  notes: z.string().optional(),
});

export const LeadIntelligenceSchema = z.object({
  adoptionRisk: z
    .object({
      level: RiskLevelSchema.default("unknown"),
      reasons: z.array(z.string()).default([]),
      trustFriction: z.array(z.string()).default([]),
      confidence: z.enum(["low", "medium", "high", "unknown"]).optional(),
    })
    .default({ level: "unknown", reasons: [], trustFriction: [] }),
  toolLoyaltyRisk: z
    .object({
      level: RiskLevelSchema.default("unknown"),
      currentTools: z.array(z.string()).default([]),
      notes: z.string().optional(),
      reasons: z.array(z.string()).default([]),
      lockInConcerns: z.array(z.string()).default([]),
      migrationSensitivity: z.enum(["low", "medium", "high"]).optional(),
      confidence: z.enum(["low", "medium", "high", "unknown"]).optional(),
    })
    .default({ level: "unknown", currentTools: [], reasons: [], lockInConcerns: [] }),
  reversibility: z
    .object({
      strategy: z.string().default(""),
      lowRiskStart: z.string().optional(),
      rollbackPlan: z.string().optional(),
      firstStep: z.string().optional(),
      blastRadius: RiskLevelSchema.optional(),
      level: ReversibilityLevelSchema.optional(),
      pilotFirst: z.boolean().optional(),
    })
    .default({ strategy: "" }),
  stakeholderMap: z.array(StakeholderSchema).default([]),
  trustSensitivity: TrustSensitivitySchema.optional(),
  changeSurface: z.array(z.string()).default([]),
  safeStartingPoint: z.string().optional(),
  rolloutNotes: z.string().optional(),
});

export type LeadIntelligence = z.infer<typeof LeadIntelligenceSchema>;

/** Legacy flat meta shape (still supported for reading). */
export type LeadIntelligenceMeta = {
  /** What will they resist emotionally or politically? */
  adoptionRisk?: string | null;
  /** Are they defending past decisions or tool choices? */
  toolLoyaltyRisk?: string | null;
  /** Can changes be rolled back safely? Propose small, reversible steps when false or unknown. */
  reversibility?: string | null;
  /** Who must say yes, quietly? Who needs to feel safe? */
  stakeholderMap?: string | null;
  /** Optional: when this intelligence was produced (ISO string). */
  producedAt?: string | null;
};

/** Artifact type for standalone lead-intelligence artifacts. */
export const LEAD_INTELLIGENCE_ARTIFACT_TYPE = "lead_intelligence";

/** Title for the lead-intelligence artifact. */
export const LEAD_INTELLIGENCE_ARTIFACT_TITLE = "LEAD_INTELLIGENCE";

/**
 * Keys that may appear in Artifact.meta when the artifact carries lead intelligence.
 * Enrichment or positioning steps may write these into their artifact meta instead of a separate artifact.
 */
export const LEAD_INTELLIGENCE_META_KEYS: (keyof LeadIntelligenceMeta)[] = [
  "adoptionRisk",
  "toolLoyaltyRisk",
  "reversibility",
  "stakeholderMap",
  "producedAt",
];

export function isLeadIntelligenceMeta(
  meta: unknown
): meta is LeadIntelligenceMeta {
  if (meta == null || typeof meta !== "object") return false;
  const o = meta as Record<string, unknown>;
  return (
    (o.leadIntelligence != null && typeof o.leadIntelligence === "object") ||
    LEAD_INTELLIGENCE_META_KEYS.some((k) => k in o && o[k] != null) ||
    o.adoptionRisk !== undefined ||
    o.toolLoyaltyRisk !== undefined ||
    o.reversibility !== undefined ||
    o.stakeholderMap !== undefined
  );
}

/** Extract structured LeadIntelligence from artifact meta (enrich artifact meta.leadIntelligence). */
export function getLeadIntelligenceFromMeta(meta: unknown): LeadIntelligence | null {
  if (meta == null || typeof meta !== "object") return null;
  const o = meta as Record<string, unknown>;
  const li = o.leadIntelligence;
  if (li == null || typeof li !== "object") return null;
  const parsed = LeadIntelligenceSchema.safeParse(li);
  return parsed.success ? parsed.data : null;
}
