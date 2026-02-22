"use client";

import type { ReferralEngineMetrics } from "@/lib/ops/types";

export function ReferralEngineCard({ data }: { data: ReferralEngineMetrics | null }) {
  if (!data) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Referral engine</h2>
        <p className="text-xs text-neutral-500">Loading…</p>
      </section>
    );
  }

  const {
    referralAsksThisWeek,
    referralsReceivedThisMonth,
    referralToQualifiedPct,
    referralToWonPct,
    topReferralSourceCount,
    eligibleForReferralAskCount,
  } = data;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Referral engine</h2>
      <div className="grid gap-x-4 gap-y-1 grid-cols-2 text-sm mb-3">
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Referral asks this week</span>
          <span className="text-neutral-200 font-medium tabular-nums">{referralAsksThisWeek}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Referrals received (month)</span>
          <span className="text-neutral-200 font-medium tabular-nums">{referralsReceivedThisMonth}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Referral → qualified %</span>
          <span className="text-neutral-200 font-medium tabular-nums">
            {referralToQualifiedPct != null ? `${referralToQualifiedPct}%` : "—"}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Referral → won %</span>
          <span className="text-neutral-200 font-medium tabular-nums">
            {referralToWonPct != null ? `${referralToWonPct}%` : "—"}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Top source count</span>
          <span className="text-neutral-200 font-medium tabular-nums">{topReferralSourceCount}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Eligible for ask</span>
          <span className="text-emerald-400 font-medium tabular-nums">{eligibleForReferralAskCount}</span>
        </div>
      </div>
      <p className="text-xs text-neutral-500 mt-2">
        Eligible = shipped + won, referral not yet asked. Queue referral asks from lead detail. When you mark “Asked”, the date is set automatically for weekly counts.
      </p>
    </section>
  );
}
