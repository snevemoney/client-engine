/**
 * Phase 2.2: Optional helper to suggest proof snippet from testimonial.
 * Manual-first; does not auto-overwrite.
 */

export type DeliveryProjectLike = {
  testimonialQuote?: string | null;
  testimonialSourceUrl?: string | null;
  proofCandidateId?: string | null;
};

export type ProofUpdateSuggestion = {
  proofCandidateId: string;
  suggestedSnippet: string;
  sourceUrl?: string | null;
};

/**
 * If testimonial quote exists and proof candidate exists, return a safe suggested snippet update.
 * Manual-first; caller must explicitly apply.
 */
export function buildProofUpdateFromTestimonial(
  project: DeliveryProjectLike
): ProofUpdateSuggestion | null {
  const quote = project.testimonialQuote?.trim();
  const proofId = project.proofCandidateId?.trim();

  if (!quote || !proofId) return null;

  return {
    proofCandidateId: proofId,
    suggestedSnippet: quote,
    sourceUrl: project.testimonialSourceUrl ?? undefined,
  };
}
