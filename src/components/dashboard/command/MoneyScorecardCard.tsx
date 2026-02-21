"use client";

type MoneyScorecard = {
  at: string;
  leadsDiscovered: number;
  leadsQualified: number;
  proposalsDrafted: number;
  proposalsSent: number;
  dealsWon: number;
  dealsLost: number;
  pipelineValueEstimate: number;
  avgDealSizeEstimate: number | null;
  timeToProposalMedianDays: number | null;
  timeToCloseMedianDays: number | null;
  newLeadsToday?: number;
  newLeads7d?: number;
  proposalsSent7d?: number;
  followUpsDueToday?: number;
  callsBooked?: number | null;
  revenueWon30d?: number | null;
  staleOpportunitiesCount?: number;
  primaryBottleneck?: string | null;
  constraintImpactNote?: string | null;
};

export function MoneyScorecardCard({ data }: { data: MoneyScorecard | null }) {
  if (!data) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Money Scorecard</h2>
        <p className="text-xs text-neutral-500">Loading…</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Money Scorecard</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-wider">Leads</p>
          <p className="text-neutral-200 font-medium">
            Today: {data.newLeadsToday ?? 0} · 7d: {data.newLeads7d ?? 0}
          </p>
        </div>
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-wider">Proposals sent</p>
          <p className="text-neutral-200 font-medium">7d: {data.proposalsSent7d ?? 0} · Total: {data.proposalsSent}</p>
        </div>
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-wider">Follow-ups due</p>
          <p className="text-neutral-200 font-medium">{data.followUpsDueToday ?? 0}</p>
        </div>
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-wider">Calls booked</p>
          <p className="text-neutral-200 font-medium">{data.callsBooked ?? "—"}</p>
        </div>
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-wider">Deals won (30d)</p>
          <p className="text-neutral-200 font-medium">{data.dealsWon}</p>
        </div>
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-wider">Revenue won (30d)</p>
          <p className="text-neutral-200 font-medium">
            {data.revenueWon30d != null ? `$${data.revenueWon30d.toLocaleString()}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-wider">Avg deal size</p>
          <p className="text-neutral-200 font-medium">
            {data.avgDealSizeEstimate != null ? `$${data.avgDealSizeEstimate.toLocaleString()}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-wider">Stale opportunities</p>
          <p className="text-neutral-200 font-medium">{data.staleOpportunitiesCount ?? 0}</p>
        </div>
      </div>
      {(data.primaryBottleneck || data.constraintImpactNote) && (
        <div className="mt-3 pt-3 border-t border-neutral-800 text-xs">
          {data.primaryBottleneck && (
            <p className="text-neutral-400">
              <span className="text-neutral-500">Bottleneck:</span> {data.primaryBottleneck}
            </p>
          )}
          {data.constraintImpactNote && (
            <p className="text-neutral-500 mt-1">{data.constraintImpactNote}</p>
          )}
        </div>
      )}
    </section>
  );
}
