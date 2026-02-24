/**
 * Phase 1.4: Build a ProofCandidate draft from an IntakeLead.
 * Deterministic, safe, no hype.
 */

import type { ProofCandidateTriggerType, ProofCandidateSourceType } from "@prisma/client";

export type IntakeLeadLike = {
  id: string;
  title: string;
  company?: string | null;
  summary?: string | null;
  githubUrl?: string | null;
  loomUrl?: string | null;
  deliverySummary?: string | null;
};

export type BuildOptions = {
  title?: string;
  proofSnippet?: string;
  beforeState?: string | null;
  afterState?: string | null;
  metricLabel?: string | null;
  metricValue?: string | null;
};

const TRIM = (s: unknown) => (typeof s === "string" ? s.trim() : "");

function pickTrigger(lead: IntakeLeadLike): ProofCandidateTriggerType {
  if (TRIM(lead.githubUrl)) return "github";
  if (TRIM(lead.loomUrl)) return "loom";
  return "manual";
}

function buildProofSnippet(lead: IntakeLeadLike, overrides?: BuildOptions): string {
  if (overrides?.proofSnippet?.trim()) return overrides.proofSnippet.trim();
  const company = TRIM(lead.company) || "client";
  const summary = TRIM(lead.deliverySummary) || TRIM(lead.summary) || "";
  return `Delivered work for ${company}. ${summary ? summary : "Delivery completed."}`.trim();
}

/**
 * Build a proof candidate draft from an intake lead.
 */
export function buildProofCandidateFromIntakeLead(
  lead: IntakeLeadLike,
  options?: BuildOptions
): {
  title: string;
  company: string | null;
  sourceType: ProofCandidateSourceType;
  sourceId: string;
  triggerType: ProofCandidateTriggerType;
  githubUrl: string | null;
  loomUrl: string | null;
  deliverySummary: string | null;
  proofSnippet: string;
  beforeState: string | null;
  afterState: string | null;
  metricLabel: string | null;
  metricValue: string | null;
} {
  const title =
    options?.title?.trim() ||
    `Delivery proof — ${TRIM(lead.title) || "Untitled"}`;
  const company = TRIM(lead.company) || null;
  const githubUrl = TRIM(lead.githubUrl) || null;
  const loomUrl = TRIM(lead.loomUrl) || null;
  const deliverySummary = TRIM(lead.deliverySummary) || null;

  return {
    title,
    company,
    sourceType: "intake_lead",
    sourceId: lead.id,
    triggerType: pickTrigger(lead),
    githubUrl,
    loomUrl,
    deliverySummary,
    proofSnippet: buildProofSnippet(lead, options),
    beforeState: options?.beforeState?.trim() || null,
    afterState: options?.afterState?.trim() || null,
    metricLabel: options?.metricLabel?.trim() || null,
    metricValue: options?.metricValue?.trim() || null,
  };
}
