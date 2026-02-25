"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type RetentionWeeklyStats = {
  retentionFollowupsCompletedThisWeek?: number;
  testimonialRequestsThisWeek?: number;
  testimonialsReceivedThisWeek?: number;
  reviewRequestsThisWeek?: number;
  reviewsReceivedThisWeek?: number;
  referralRequestsThisWeek?: number;
  referralsReceivedThisWeek?: number;
  upsellOpenedThisWeek?: number;
  retentionOverdue?: number;
  stalePostDelivery?: number;
};

export function RetentionWeeklyStats() {
  const [stats, setStats] = useState<RetentionWeeklyStats | null>(null);

  useEffect(() => {
    fetch("/api/delivery-projects/retention-weekly")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStats(d && typeof d === "object" ? d : null))
      .catch(() => setStats(null));
  }, []);

  const hasAny =
    (stats?.retentionFollowupsCompletedThisWeek ?? 0) > 0 ||
    (stats?.testimonialRequestsThisWeek ?? 0) > 0 ||
    (stats?.testimonialsReceivedThisWeek ?? 0) > 0 ||
    (stats?.reviewRequestsThisWeek ?? 0) > 0 ||
    (stats?.reviewsReceivedThisWeek ?? 0) > 0 ||
    (stats?.referralRequestsThisWeek ?? 0) > 0 ||
    (stats?.referralsReceivedThisWeek ?? 0) > 0 ||
    (stats?.upsellOpenedThisWeek ?? 0) > 0 ||
    (stats?.retentionOverdue ?? 0) > 0 ||
    (stats?.stalePostDelivery ?? 0) > 0;

  if (!stats || !hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Retention this week</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(stats.retentionFollowupsCompletedThisWeek ?? 0) > 0 && (
          <span><strong>{stats.retentionFollowupsCompletedThisWeek}</strong> follow-ups done</span>
        )}
        {(stats.testimonialRequestsThisWeek ?? 0) > 0 && (
          <span><strong>{stats.testimonialRequestsThisWeek}</strong> testimonial requests</span>
        )}
        {(stats.testimonialsReceivedThisWeek ?? 0) > 0 && (
          <span className="text-emerald-400"><strong>{stats.testimonialsReceivedThisWeek}</strong> testimonials received</span>
        )}
        {(stats.reviewRequestsThisWeek ?? 0) > 0 && (
          <span><strong>{stats.reviewRequestsThisWeek}</strong> review requests</span>
        )}
        {(stats.reviewsReceivedThisWeek ?? 0) > 0 && (
          <span className="text-emerald-400"><strong>{stats.reviewsReceivedThisWeek}</strong> reviews received</span>
        )}
        {(stats.referralRequestsThisWeek ?? 0) > 0 && (
          <span><strong>{stats.referralRequestsThisWeek}</strong> referral requests</span>
        )}
        {(stats.referralsReceivedThisWeek ?? 0) > 0 && (
          <span className="text-emerald-400"><strong>{stats.referralsReceivedThisWeek}</strong> referrals received</span>
        )}
        {(stats.upsellOpenedThisWeek ?? 0) > 0 && (
          <span className="text-emerald-400"><strong>{stats.upsellOpenedThisWeek}</strong> upsell logged</span>
        )}
        {(stats.retentionOverdue ?? 0) > 0 && (
          <Link href="/dashboard/retention?bucket=overdue" className="text-red-400 hover:underline">
            <strong>{stats.retentionOverdue}</strong> overdue
          </Link>
        )}
        {(stats.stalePostDelivery ?? 0) > 0 && (
          <Link href="/dashboard/retention" className="text-amber-400 hover:underline">
            <strong>{stats.stalePostDelivery}</strong> stale post-delivery
          </Link>
        )}
      </div>
    </div>
  );
}
