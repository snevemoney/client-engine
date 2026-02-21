/**
 * Lead intelligence: human-risk dimensions for sales-engineering decisions.
 * Stored in Artifact.meta (artifact type "lead_intelligence" or in enrichment/positioning meta).
 * See docs/CLIENT_ENGINE_AXIOMS.md §6 and docs/LEAD_INTELLIGENCE_SCHEMA.md.
 * No new DB tables—use existing Artifact.meta.
 */

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
    LEAD_INTELLIGENCE_META_KEYS.some((k) => k in o && o[k] != null) ||
    o.adoptionRisk !== undefined ||
    o.toolLoyaltyRisk !== undefined ||
    o.reversibility !== undefined ||
    o.stakeholderMap !== undefined
  );
}
