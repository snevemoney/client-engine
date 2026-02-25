/**
 * Phase 2.3: Revenue metrics helpers.
 * Null-safe, zero-safe.
 */

export type RevenueInput = {
  weekStart?: Date;
  weekEnd?: Date;
  proposals?: { finalValue?: number | null; priceMin?: number | null; priceMax?: number | null; acceptedAt?: Date | string | null }[];
  deliveryProjects?: { finalValue?: number | null; completedAt?: Date | string | null; proposal?: { finalValue?: number | null; priceMin?: number | null; priceMax?: number | null } | null }[];
  upsellValueEstimate?: number;
  upsellOpenValue?: number;
  retainerOpenCount?: number;
};

function proposalValue(p: { finalValue?: number | null; priceMin?: number | null; priceMax?: number | null }): number {
  const fv = p.finalValue;
  if (fv != null && Number.isFinite(fv) && fv >= 0) return fv;
  const min = p.priceMin ?? 0;
  const max = p.priceMax ?? 0;
  if (Number.isFinite(min) && Number.isFinite(max) && max > 0) return (min + max) / 2;
  if (Number.isFinite(min) && min > 0) return min;
  if (Number.isFinite(max) && max > 0) return max;
  return 0;
}

function inRange(d: Date | string | null | undefined, start?: Date, end?: Date): boolean {
  if (!d) return false;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return false;
  if (start && x < start) return false;
  if (end && x > end) return false;
  return true;
}

export function computeRevenueMetrics(input: RevenueInput = {}): {
  acceptedValueThisWeek: number;
  wonValueThisWeek: number;
  deliveredValueThisWeek: number;
  avgProposalValue: number;
  avgAcceptedValue: number;
  avgDeliveryValue: number;
  upsellOpenValue: number;
  retainerOpenCount: number;
} {
  const weekStart = input.weekStart;
  const weekEnd = input.weekEnd;
  const proposals = input.proposals ?? [];
  const deliveryProjects = input.deliveryProjects ?? [];

  let acceptedValueThisWeek = 0;
  let wonValueThisWeek = 0;
  let deliveredValueThisWeek = 0;
  const acceptedValues: number[] = [];
  const deliveryValues: number[] = [];

  for (const p of proposals) {
    const v = proposalValue(p);
    if (v > 0) {
      if (inRange(p.acceptedAt, weekStart, weekEnd)) {
        acceptedValueThisWeek += v;
        wonValueThisWeek += v;
        acceptedValues.push(v);
      } else if (p.acceptedAt) {
        acceptedValues.push(v);
      }
    }
  }

  for (const d of deliveryProjects) {
    let v = d.finalValue ?? 0;
    if ((v == null || !Number.isFinite(v) || v <= 0) && d.proposal) {
      v = proposalValue(d.proposal);
    }
    if (v > 0 && Number.isFinite(v)) {
      if (inRange(d.completedAt, weekStart, weekEnd)) {
        deliveredValueThisWeek += v;
      }
      deliveryValues.push(v);
    }
  }

  const sum = (arr: number[]) => arr.reduce((s, x) => s + x, 0);
  const avg = (arr: number[]) => (arr.length > 0 ? sum(arr) / arr.length : 0);

  return {
    acceptedValueThisWeek: Number.isFinite(acceptedValueThisWeek) ? acceptedValueThisWeek : 0,
    wonValueThisWeek: Number.isFinite(wonValueThisWeek) ? wonValueThisWeek : 0,
    deliveredValueThisWeek: Number.isFinite(deliveredValueThisWeek) ? deliveredValueThisWeek : 0,
    avgProposalValue: avg(proposals.map(proposalValue).filter((x) => x > 0)),
    avgAcceptedValue: avg(acceptedValues),
    avgDeliveryValue: avg(deliveryValues),
    upsellOpenValue: input.upsellOpenValue ?? input.upsellValueEstimate ?? 0,
    retainerOpenCount: input.retainerOpenCount ?? 0,
  };
}
