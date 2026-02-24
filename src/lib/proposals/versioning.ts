/**
 * Phase 2.0: Proposal versioning helpers.
 */

export type ProposalSnapshotPayload = {
  title: string;
  clientName?: string | null;
  clientEmail?: string | null;
  company?: string | null;
  summary?: string | null;
  scopeOfWork?: string | null;
  deliverables?: unknown;
  timelineDays?: number | null;
  priceType?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  priceCurrency?: string | null;
  terms?: string | null;
  cta?: string | null;
  expiresAt?: string | null;
  version?: number;
  lastEditedAt?: string | null;
};

/**
 * Build a JSON-serializable snapshot of proposal content for version history.
 */
export function buildProposalSnapshot(proposal: ProposalSnapshotPayload): Record<string, unknown> {
  return {
    title: proposal.title ?? "",
    clientName: proposal.clientName ?? null,
    clientEmail: proposal.clientEmail ?? null,
    company: proposal.company ?? null,
    summary: proposal.summary ?? null,
    scopeOfWork: proposal.scopeOfWork ?? null,
    deliverables: proposal.deliverables ?? null,
    timelineDays: proposal.timelineDays ?? null,
    priceType: proposal.priceType ?? null,
    priceMin: proposal.priceMin ?? null,
    priceMax: proposal.priceMax ?? null,
    priceCurrency: proposal.priceCurrency ?? "CAD",
    terms: proposal.terms ?? null,
    cta: proposal.cta ?? null,
    expiresAt: proposal.expiresAt ?? null,
    version: proposal.version ?? 1,
    lastEditedAt: proposal.lastEditedAt ?? null,
  };
}

/**
 * Return next version number.
 */
export function nextProposalVersion(currentVersion: number): number {
  return Math.max(1, (currentVersion ?? 0) + 1);
}
