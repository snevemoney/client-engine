/**
 * Lead intelligence: shared type, schema, and parser for pipeline and UI.
 * Use parseLeadIntelligenceFromMeta(artifact.meta) to read from enrich or positioning artifacts.
 */

import { LeadIntelligenceSchema } from "./schema";
import type { LeadIntelligence } from "./schema";

export {
  LeadIntelligenceSchema,
  RiskLevelSchema,
  StakeholderSchema,
  getLeadIntelligenceFromMeta,
  isLeadIntelligenceMeta,
  LEAD_INTELLIGENCE_ARTIFACT_TITLE,
  LEAD_INTELLIGENCE_ARTIFACT_TYPE,
  LEAD_INTELLIGENCE_META_KEYS,
} from "./schema";
export type { LeadIntelligence, LeadIntelligenceMeta } from "./schema";

/** Parse lead intelligence from artifact meta. Supports meta.leadIntelligence or (for legacy) top-level keys. */
export function parseLeadIntelligenceFromMeta(meta: unknown): LeadIntelligence | null {
  if (meta == null || typeof meta !== "object") return null;
  const obj = meta as Record<string, unknown>;
  const candidate =
    obj.leadIntelligence != null && typeof obj.leadIntelligence === "object"
      ? obj.leadIntelligence
      : obj;
  const parsed = LeadIntelligenceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
