/**
 * Site Build Pipeline — Zod schemas for each phase output.
 * Reused from enrich-site-brief-9phases; adapted for per-phase validation.
 */

import { z } from "zod";

const defaultScope = ["homepage", "about", "services", "contact"];
const scopeCoerce = z.union([
  z.array(z.string()),
  z.string().transform((s) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)),
  z.record(z.string(), z.unknown()).transform((o) => Object.keys(o)),
  z.any().transform(() => defaultScope),
]).transform((v) => (Array.isArray(v) && v.length > 0 ? v : defaultScope));

function stringOrArray(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v;
  if (Array.isArray(v)) return v.map(String).filter(Boolean).join("\n") || undefined;
  return undefined;
}

export const Phase1Schema = z.object({
  scope: scopeCoerce.optional().default(defaultScope),
  siteMap: z.any().optional().transform(stringOrArray),
  userFlows: z.any().optional().transform(stringOrArray),
});

export const Phase2Schema = z.object({
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
});

export const Phase3Schema = z.object({
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
});

export const Phase4Schema = z.object({ componentLogic: z.string().optional() });
export const Phase5Schema = z.object({ figmaMakePrompts: z.array(z.string()).optional() });
export const Phase6Schema = z.object({ animationSpecs: z.string().optional() });
export const Phase7Schema = z.object({ responsiveSpecs: z.string().optional() });
export const Phase8Schema = z.object({ dataIntegration: z.string().optional() });
export const Phase9Schema = z.object({ qaChecklist: z.string().optional() });

const PHASE_SCHEMAS = [
  Phase1Schema,
  Phase2Schema,
  Phase3Schema,
  Phase4Schema,
  Phase5Schema,
  Phase6Schema,
  Phase7Schema,
  Phase8Schema,
  Phase9Schema,
] as const;

export function getPhaseSchema(phaseNum: number): (typeof PHASE_SCHEMAS)[number] | undefined {
  const idx = phaseNum - 1;
  return idx >= 0 && idx < PHASE_SCHEMAS.length ? PHASE_SCHEMAS[idx] : undefined;
}
