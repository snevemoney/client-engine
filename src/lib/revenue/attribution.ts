/**
 * Revenue Attribution Layer — deterministic revenue signals for every actionable entity.
 * No AI calls. Pure math on existing tables.
 *
 * Used by: NBA ranking (revenueBoost), Risk scoring (exposedRevenue),
 * Founder OS (expected impact), Portfolio health.
 */

import { db } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────

export type RevenueSignal = {
  entityType: "lead" | "proposal" | "delivery_project";
  entityId: string;
  /** Best estimate of the dollar value at stake */
  value: number;
  currency: string;
  /** How confident we are: 1.0 = accepted deal, 0.3 = early lead */
  confidence: number;
  /** Human-readable label */
  label: string;
};

export type ConversionRates = {
  bySource: Record<string, { total: number; won: number; rate: number }>;
  overall: { total: number; won: number; rate: number };
};

// ── Baseline / Conversion Rates ────────────────────────────────────────

/**
 * Compute historical conversion rates from Lead → Won, grouped by source.
 * Uses all-time data for statistical significance.
 */
export async function getConversionRates(): Promise<ConversionRates> {
  const leads = await db.lead.findMany({
    where: { dealOutcome: { in: ["won", "lost"] } },
    select: { source: true, dealOutcome: true },
  });

  const bySource: Record<string, { total: number; won: number; rate: number }> = {};
  let totalAll = 0;
  let wonAll = 0;

  for (const l of leads) {
    const src = l.source || "unknown";
    if (!bySource[src]) bySource[src] = { total: 0, won: 0, rate: 0 };
    bySource[src].total++;
    totalAll++;
    if (l.dealOutcome === "won") {
      bySource[src].won++;
      wonAll++;
    }
  }

  for (const s of Object.values(bySource)) {
    s.rate = s.total > 0 ? s.won / s.total : 0;
  }

  return {
    bySource,
    overall: {
      total: totalAll,
      won: wonAll,
      rate: totalAll > 0 ? wonAll / totalAll : 0.5, // Default 50% if no history
    },
  };
}

/**
 * Compute baseline deal value (median of accepted proposals).
 * Returns a sensible default when no history exists.
 */
export async function getBaselineDealValue(): Promise<{ median: number; currency: string }> {
  const accepted = await db.proposal.findMany({
    where: { acceptedAt: { not: null }, priceMin: { not: null } },
    select: { priceMin: true, priceCurrency: true },
    orderBy: { priceMin: "asc" },
  });

  if (accepted.length === 0) return { median: 3000, currency: "CAD" };

  const prices = accepted.map((p) => p.priceMin!).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const currency = accepted[0].priceCurrency || "CAD";

  return { median, currency };
}

// ── Entity Revenue Signals ─────────────────────────────────────────────

/** Revenue signal for a Lead based on linked proposal price × conversion probability. */
export async function getLeadRevenue(
  leadId: string,
  rates?: ConversionRates
): Promise<RevenueSignal | null> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      title: true,
      source: true,
      status: true,
      dealOutcome: true,
      proposals: {
        select: { priceMin: true, priceMax: true, priceCurrency: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!lead) return null;

  // Already won or lost — no revenue at risk
  if (lead.dealOutcome === "won" || lead.dealOutcome === "lost") return null;

  const proposal = lead.proposals[0];
  const price = proposal?.priceMin ?? proposal?.priceMax ?? 0;
  if (price === 0) return null;

  const conversionRates = rates ?? await getConversionRates();
  const sourceRate = conversionRates.bySource[lead.source]?.rate ?? conversionRates.overall.rate;

  // Adjust confidence by stage
  const stageMultiplier = lead.status === "SCORED" ? 0.6
    : lead.status === "APPROVED" ? 0.8
    : lead.status === "BUILDING" ? 0.9
    : 0.4; // NEW, ENRICHED, etc.

  const confidence = Math.min(1, sourceRate * stageMultiplier);

  return {
    entityType: "lead",
    entityId: lead.id,
    value: Math.round(price * confidence),
    currency: proposal?.priceCurrency ?? "CAD",
    confidence: Math.round(confidence * 100) / 100,
    label: `${lead.title}: $${price.toLocaleString()} × ${Math.round(confidence * 100)}%`,
  };
}

/** Revenue signal for a Proposal — full deal value at risk if sent/viewed but not accepted. */
export async function getProposalRevenue(proposalId: string): Promise<RevenueSignal | null> {
  const p = await db.proposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      title: true,
      status: true,
      priceMin: true,
      priceMax: true,
      priceCurrency: true,
      sentAt: true,
    },
  });

  if (!p) return null;

  // Only active proposals have revenue at risk
  const activeStatuses = ["sent", "viewed", "ready"];
  if (!activeStatuses.includes(p.status)) return null;

  const price = p.priceMin ?? p.priceMax ?? 0;
  if (price === 0) return null;

  // Confidence based on status
  const confidence = p.status === "viewed" ? 0.7
    : p.status === "sent" ? 0.5
    : 0.3; // ready but not sent

  return {
    entityType: "proposal",
    entityId: p.id,
    value: price,
    currency: p.priceCurrency ?? "CAD",
    confidence,
    label: `${p.title}: $${price.toLocaleString()} ${p.status}`,
  };
}

/** Revenue signal for a DeliveryProject — retention value at stake. */
export async function getDeliveryRevenue(projectId: string): Promise<RevenueSignal | null> {
  const dp = await db.deliveryProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      status: true,
      proposalId: true,
      proposal: {
        select: { priceMin: true, priceMax: true, priceCurrency: true },
      },
    },
  });

  if (!dp) return null;
  if (dp.status === "completed" || dp.status === "archived") return null;

  const price = dp.proposal?.priceMin ?? dp.proposal?.priceMax ?? 0;
  if (price === 0) return null;

  // Active delivery = full value at stake (reputation + referral potential)
  const confidence = dp.status === "in_progress" ? 0.9 : 0.7;

  return {
    entityType: "delivery_project",
    entityId: dp.id,
    value: price,
    currency: dp.proposal?.priceCurrency ?? "CAD",
    confidence,
    label: `${dp.title}: $${price.toLocaleString()} in delivery`,
  };
}

// ── Batch Computation (for NBA/Risk enrichment) ────────────────────────

/**
 * Compute revenue signal for any entity reference.
 * Used by NBA ranking and Risk scoring to attach dollar values.
 */
export async function getRevenueForEntity(
  entityType: string,
  entityId: string,
  rates?: ConversionRates
): Promise<RevenueSignal | null> {
  switch (entityType) {
    case "lead":
      return getLeadRevenue(entityId, rates);
    case "proposal":
      return getProposalRevenue(entityId);
    case "delivery_project":
      return getDeliveryRevenue(entityId);
    default:
      return null;
  }
}

/**
 * Batch-compute revenue signals for NBA candidates.
 * Returns a map: sourceId → RevenueSignal.
 * Pre-fetches conversion rates once for efficiency.
 */
export async function batchRevenueSignals(
  items: Array<{ sourceType: string; sourceId?: string | null }>
): Promise<Map<string, RevenueSignal>> {
  const rates = await getConversionRates();
  const results = new Map<string, RevenueSignal>();

  const uniqueItems = new Map<string, { type: string; id: string }>();
  for (const item of items) {
    if (item.sourceId) {
      uniqueItems.set(item.sourceId, { type: item.sourceType, id: item.sourceId });
    }
  }

  const promises = [...uniqueItems.entries()].map(async ([id, { type }]) => {
    const signal = await getRevenueForEntity(type, id, rates);
    if (signal) results.set(id, signal);
  });

  await Promise.all(promises);
  return results;
}
