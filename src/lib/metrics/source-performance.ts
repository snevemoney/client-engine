/**
 * Phase 2.3: Source performance metrics.
 * Aggregates by IntakeLead source.
 */

export type SourceRow = {
  source: string;
  intakeCount: number;
  promotedCount: number;
  proposalCount: number;
  sentCount: number;
  acceptedCount: number;
  deliveredCount: number;
  intakeToWinRate: number;
  proposalToAcceptedRate: number;
  revenue: number;
};

export type SourcePerformanceInput = {
  rows: Array<{
    source: string;
    intakeCount: number;
    promotedCount: number;
    proposalCount: number;
    sentCount: number;
    acceptedCount: number;
    deliveredCount: number;
    revenue: number;
  }>;
};

function safeRate(num: number, denom: number): number {
  if (denom <= 0 || !Number.isFinite(denom)) return 0;
  const r = num / denom;
  return Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0;
}

export function computeSourcePerformance(input: Partial<SourcePerformanceInput> = {}): {
  sourceRows: SourceRow[];
  topSourceByWins: string | null;
  topSourceByRevenue: string | null;
} {
  const rows = input.rows ?? [];
  const sourceRows: SourceRow[] = rows.map((r) => ({
    source: r.source ?? "unknown",
    intakeCount: r.intakeCount ?? 0,
    promotedCount: r.promotedCount ?? 0,
    proposalCount: r.proposalCount ?? 0,
    sentCount: r.sentCount ?? 0,
    acceptedCount: r.acceptedCount ?? 0,
    deliveredCount: r.deliveredCount ?? 0,
    intakeToWinRate: safeRate(r.acceptedCount ?? 0, r.intakeCount ?? 0),
    proposalToAcceptedRate: safeRate(r.acceptedCount ?? 0, r.sentCount ?? 0),
    revenue: r.revenue ?? 0,
  }));

  const byWins = [...sourceRows].sort((a, b) => b.acceptedCount - a.acceptedCount);
  const byRevenue = [...sourceRows].sort((a, b) => b.revenue - a.revenue);

  return {
    sourceRows,
    topSourceByWins: byWins[0]?.acceptedCount > 0 ? byWins[0].source : null,
    topSourceByRevenue: byRevenue[0]?.revenue > 0 ? byRevenue[0].source : null,
  };
}
