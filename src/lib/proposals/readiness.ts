/**
 * Phase 2.0: Proposal readiness.
 * Computes whether a proposal is ready to send.
 */

export type ProposalLike = {
  title?: string | null;
  clientName?: string | null;
  company?: string | null;
  summary?: string | null;
  scopeOfWork?: string | null;
  deliverables?: unknown;
  priceType?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  cta?: string | null;
  expiresAt?: Date | string | null;
  terms?: string | null;
  timelineDays?: number | null;
};

export type ProposalReadinessResult = {
  isReady: boolean;
  reasons: string[];
  warnings: string[];
};

const TRIM = (s: unknown) => (typeof s === "string" ? s.trim() : "");

function hasDeliverable(deliverables: unknown): boolean {
  if (!deliverables) return false;
  if (Array.isArray(deliverables)) {
    const items = deliverables.filter((x) => typeof x === "string" && x.trim().length > 0);
    if (items.length > 0) return true;
    const struct = deliverables.filter(
      (x) => typeof x === "object" && x !== null && ("label" in x || "title" in x || "name" in x)
    );
    return struct.length > 0;
  }
  if (typeof deliverables === "object" && deliverables !== null && "items" in deliverables) {
    const arr = (deliverables as { items?: unknown[] }).items;
    return Array.isArray(arr) && arr.length > 0;
  }
  return false;
}

function hasPriceInfo(p: ProposalLike): boolean {
  const pt = (p.priceType ?? "").toLowerCase();
  if (!pt) return false;
  if (pt === "fixed") return p.priceMin != null || p.priceMax != null;
  if (pt === "range") return p.priceMin != null && p.priceMax != null;
  if (pt === "hourly") return p.priceMin != null || p.priceMax != null;
  if (pt === "custom") return true;
  return false;
}

/**
 * Compute whether a proposal is ready to send.
 * Minimum required: title, clientName OR company, summary, scopeOfWork, at least one deliverable, price info, cta.
 * Warnings: no expiry, no terms, no timelineDays.
 */
export function computeProposalReadiness(proposal: ProposalLike): ProposalReadinessResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const title = TRIM(proposal.title);
  const clientName = TRIM(proposal.clientName);
  const company = TRIM(proposal.company);
  const summary = TRIM(proposal.summary);
  const scopeOfWork = TRIM(proposal.scopeOfWork);
  const cta = TRIM(proposal.cta);

  if (!title) reasons.push("Missing title");
  if (!clientName && !company) reasons.push("Missing client name or company");
  if (!summary) reasons.push("Missing summary");
  if (!scopeOfWork) reasons.push("Missing scope of work");
  if (!hasDeliverable(proposal.deliverables)) reasons.push("At least one deliverable required");
  if (!hasPriceInfo(proposal)) reasons.push("Price info required (priceType + corresponding fields)");
  if (!cta) reasons.push("Missing CTA (next step)");

  if (!proposal.expiresAt) {
    warnings.push("No expiry date");
  }
  if (!TRIM(proposal.terms)) {
    warnings.push("No terms");
  }
  if (proposal.timelineDays == null || proposal.timelineDays === undefined) {
    warnings.push("No timeline (days)");
  }

  const isReady =
    !!title &&
    !!summary &&
    !!scopeOfWork &&
    (!!clientName || !!company) &&
    hasDeliverable(proposal.deliverables) &&
    hasPriceInfo(proposal) &&
    !!cta;

  return { isReady, reasons, warnings };
}
