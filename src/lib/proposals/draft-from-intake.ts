/**
 * Phase 2.0: Generate proposal draft from IntakeLead.
 * Manual-first, axiom-compliant (clear, no hype, reversible).
 */

export type IntakeLeadLike = {
  title: string;
  company?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  summary?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
};

export type ProposalDraftPayload = {
  title: string;
  clientName: string | null;
  clientEmail: string | null;
  company: string | null;
  summary: string;
  scopeOfWork: string;
  deliverables: string[];
  cta: string;
  priceType: "range";
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;
};

const TRIM = (s: unknown) => (typeof s === "string" ? s.trim() : "");

/**
 * Generate a proposal draft from intake lead.
 * Style: clear, no hype, reversible. Price placeholders from budget if available.
 */
export function buildProposalDraftFromIntake(intake: IntakeLeadLike): ProposalDraftPayload {
  const title = TRIM(intake.title) || "Proposal";
  const company = TRIM(intake.company) ?? null;
  const contactName = TRIM(intake.contactName) ?? null;
  const contactEmail = TRIM(intake.contactEmail) ?? null;
  const summary = TRIM(intake.summary) || "Scope to be confirmed on kickoff.";

  const clientName = contactName || company || null;
  const clientEmail = contactEmail ?? null;

  const scopeSkeleton = summary.length > 100
    ? `Problem: ${summary.slice(0, 200)}${summary.length > 200 ? "…" : ""}\n\nScope to be refined on kickoff call.`
    : `Problem: ${summary}\n\nScope to be refined on kickoff call.`;

  const deliverables: string[] = [];
  if (summary.toLowerCase().includes("automation") || summary.toLowerCase().includes("funnel")) {
    deliverables.push("Discovery and scope confirmation");
    deliverables.push("Initial deliverable (per agreed scope)");
    deliverables.push("Handoff and documentation");
  } else {
    deliverables.push("Discovery and scope confirmation");
    deliverables.push("First deliverable");
    deliverables.push("Handoff");
  }

  const cta =
    "If this direction works, reply with a time for a short kickoff call (15–20 min) to confirm scope and timeline.";

  const budgetMin = intake.budgetMin ?? null;
  const budgetMax = intake.budgetMax ?? null;

  return {
    title,
    clientName,
    clientEmail,
    company,
    summary,
    scopeOfWork: scopeSkeleton,
    deliverables,
    cta,
    priceType: "range",
    priceMin: budgetMin,
    priceMax: budgetMax,
    priceCurrency: "CAD",
  };
}
