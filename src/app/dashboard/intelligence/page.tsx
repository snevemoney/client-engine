"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ChevronRight, RefreshCw } from "lucide-react";

type MetricsSummary = {
  conversion?: {
    proposalSentToAcceptedRate: number;
    acceptedToDeliveryStartedRate: number;
    deliveryCompletedToProofRate: number;
    counts: Record<string, number>;
  };
  cycleTimes?: {
    proposalCreateToSentAvgDays: number;
    proposalSentToAcceptedAvgDays: number;
    acceptedToDeliveryStartAvgDays: number;
    deliveryStartToCompleteAvgDays: number;
    completeToHandoffAvgDays: number;
    handoffToClientConfirmAvgDays: number;
    completeToProofCandidateAvgDays: number;
    counts: Record<string, number>;
  };
  revenue?: {
    acceptedValueThisWeek: number;
    deliveredValueThisWeek: number;
    avgAcceptedValue: number;
    avgDeliveryValue: number;
    upsellOpenValue: number;
    retainerOpenCount: number;
  };
  sourcePerformance?: {
    sourceRows: Array<{
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
    }>;
    topSourceByWins: string | null;
    topSourceByRevenue: string | null;
  };
  bottlenecks?: Array<{ key: string; label: string; count: number; severity: string; href: string }>;
  weekStart?: string;
};

function MetricCard({
  label,
  value,
  delta,
  href,
}: {
  label: string;
  value: string | number;
  delta?: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <p className="text-xs text-neutral-500 uppercase mb-1">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {delta != null && delta !== "" && (
        <p className="text-xs text-neutral-400 mt-1">{delta}</p>
      )}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function IntelligencePage() {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/metrics/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d && typeof d === "object" ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      const res = await fetch("/api/metrics/snapshot", { method: "POST" });
      if (res.ok) fetchData();
      else {
        const d = await res.json();
        alert(d?.error ?? "Snapshot failed");
      }
    } finally {
      setSnapshotLoading(false);
    }
  };

  const emptyConv = {
    proposalSentToAcceptedRate: 0,
    acceptedToDeliveryStartedRate: 0,
    deliveryCompletedToProofRate: 0,
    counts: {} as Record<string, number>,
  };
  const emptyCycle = {
    proposalCreateToSentAvgDays: 0,
    proposalSentToAcceptedAvgDays: 0,
    acceptedToDeliveryStartAvgDays: 0,
    deliveryStartToCompleteAvgDays: 0,
    completeToHandoffAvgDays: 0,
    handoffToClientConfirmAvgDays: 0,
    completeToProofCandidateAvgDays: 0,
    counts: {} as Record<string, number>,
  };
  const emptyRev = {
    acceptedValueThisWeek: 0,
    deliveredValueThisWeek: 0,
    avgAcceptedValue: 0,
    avgDeliveryValue: 0,
    upsellOpenValue: 0,
    retainerOpenCount: 0,
  };
  const c = data?.conversion ?? emptyConv;
  const ct = data?.cycleTimes ?? emptyCycle;
  const r = data?.revenue ?? emptyRev;
  const bottlenecks = data?.bottlenecks ?? [];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Revenue Intelligence</h1>
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Revenue Intelligence</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Conversion rates, cycle times, revenue metrics, and bottlenecks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleSnapshot} disabled={snapshotLoading}>
            {snapshotLoading ? "Capturing…" : "Capture Weekly Snapshot"}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Proposal → Accepted %"
          value={`${((c.proposalSentToAcceptedRate ?? 0) * 100).toFixed(1)}%`}
          delta={`${c.counts?.proposalSent ?? 0} sent`}
        />
        <MetricCard
          label="Accepted → Delivery %"
          value={`${((c.acceptedToDeliveryStartedRate ?? 0) * 100).toFixed(1)}%`}
          delta={`${c.counts?.accepted ?? 0} accepted`}
        />
        <MetricCard
          label="Delivery → Proof %"
          value={`${((c.deliveryCompletedToProofRate ?? 0) * 100).toFixed(1)}%`}
          delta={`${c.counts?.deliveryCompleted ?? 0} completed`}
        />
        <MetricCard
          label="Avg Sent → Accepted days"
          value={`${(ct.proposalSentToAcceptedAvgDays ?? 0).toFixed(1)}`}
          delta={`n=${ct.counts?.proposalSentToAccepted ?? 0}`}
        />
        <MetricCard
          label="Delivered value (wk)"
          value={`$${(r.deliveredValueThisWeek ?? 0).toLocaleString("en-US")}`}
        />
        <MetricCard
          label="Upsell open value"
          value={`$${(r.upsellOpenValue ?? 0).toLocaleString("en-US")}`}
          href="/dashboard/retention?status=upsell_open"
        />
      </div>

      {/* Conversion funnel */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Conversion Funnel</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Intake: <strong>{c.counts?.intake ?? 0}</strong></span>
          <span>Promoted: <strong>{c.counts?.promoted ?? 0}</strong></span>
          <span>Proposal created: <strong>{c.counts?.proposalCreated ?? 0}</strong></span>
          <span>Sent: <strong>{c.counts?.proposalSent ?? 0}</strong></span>
          <span>Accepted: <strong>{c.counts?.accepted ?? 0}</strong></span>
          <span>Delivery started: <strong>{c.counts?.deliveryStarted ?? 0}</strong></span>
          <span>Delivery completed: <strong>{c.counts?.deliveryCompleted ?? 0}</strong></span>
          <span>Proof created: <strong>{c.counts?.proofCreated ?? 0}</strong></span>
        </div>
      </div>

      {/* Cycle times */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Cycle Times (avg days)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-neutral-500">Create → Sent:</span> {(ct.proposalCreateToSentAvgDays ?? 0).toFixed(1)} <span className="text-neutral-500">(n={ct.counts?.proposalCreateToSent ?? 0})</span></div>
          <div><span className="text-neutral-500">Sent → Accepted:</span> {(ct.proposalSentToAcceptedAvgDays ?? 0).toFixed(1)} <span className="text-neutral-500">(n={ct.counts?.proposalSentToAccepted ?? 0})</span></div>
          <div><span className="text-neutral-500">Accepted → Delivery start:</span> {(ct.acceptedToDeliveryStartAvgDays ?? 0).toFixed(1)} <span className="text-neutral-500">(n={ct.counts?.acceptedToDeliveryStart ?? 0})</span></div>
          <div><span className="text-neutral-500">Start → Complete:</span> {(ct.deliveryStartToCompleteAvgDays ?? 0).toFixed(1)} <span className="text-neutral-500">(n={ct.counts?.deliveryStartToComplete ?? 0})</span></div>
          <div><span className="text-neutral-500">Complete → Handoff:</span> {(ct.completeToHandoffAvgDays ?? 0).toFixed(1)} <span className="text-neutral-500">(n={ct.counts?.completeToHandoff ?? 0})</span></div>
          <div><span className="text-neutral-500">Handoff → Client confirm:</span> {(ct.handoffToClientConfirmAvgDays ?? 0).toFixed(1)} <span className="text-neutral-500">(n={ct.counts?.handoffToClientConfirm ?? 0})</span></div>
          <div><span className="text-neutral-500">Complete → Proof:</span> {(ct.completeToProofCandidateAvgDays ?? 0).toFixed(1)} <span className="text-neutral-500">(n={ct.counts?.completeToProofCandidate ?? 0})</span></div>
        </div>
      </div>

      {/* Revenue panel */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Revenue</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-neutral-500">Accepted value (wk)</p>
            <p className="font-semibold text-emerald-400">${(r.acceptedValueThisWeek ?? 0).toLocaleString("en-US")}</p>
          </div>
          <div>
            <p className="text-neutral-500">Delivered value (wk)</p>
            <p className="font-semibold text-emerald-400">${(r.deliveredValueThisWeek ?? 0).toLocaleString("en-US")}</p>
          </div>
          <div>
            <p className="text-neutral-500">Avg accepted value</p>
            <p className="font-semibold">${(r.avgAcceptedValue ?? 0).toLocaleString("en-US")}</p>
          </div>
          <div>
            <p className="text-neutral-500">Upsell open</p>
            <p className="font-semibold">${(r.upsellOpenValue ?? 0).toLocaleString("en-US")}</p>
          </div>
        </div>
      </div>

      {/* Source performance */}
      {(data?.sourcePerformance?.sourceRows?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 overflow-x-auto">
          <h2 className="text-sm font-medium text-neutral-300 mb-3">Source Performance</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="text-left p-2 font-medium">Source</th>
                <th className="text-left p-2 font-medium">Intake</th>
                <th className="text-left p-2 font-medium">Promoted</th>
                <th className="text-left p-2 font-medium">Proposals</th>
                <th className="text-left p-2 font-medium">Sent</th>
                <th className="text-left p-2 font-medium">Accepted</th>
                <th className="text-left p-2 font-medium">Delivered</th>
                <th className="text-left p-2 font-medium">Intake→Win %</th>
                <th className="text-left p-2 font-medium">Prop→Accepted %</th>
                <th className="text-left p-2 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data?.sourcePerformance?.sourceRows?.map((r) => (
                <tr key={r.source} className="border-b border-neutral-800/50">
                  <td className="p-2">{r.source}</td>
                  <td className="p-2">{r.intakeCount}</td>
                  <td className="p-2">{r.promotedCount}</td>
                  <td className="p-2">{r.proposalCount}</td>
                  <td className="p-2">{r.sentCount}</td>
                  <td className="p-2">{r.acceptedCount}</td>
                  <td className="p-2">{r.deliveredCount}</td>
                  <td className="p-2">{(r.intakeToWinRate * 100).toFixed(1)}%</td>
                  <td className="p-2">{(r.proposalToAcceptedRate * 100).toFixed(1)}%</td>
                  <td className="p-2">${r.revenue.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.sourcePerformance?.topSourceByWins ?? data?.sourcePerformance?.topSourceByRevenue) && (
            <p className="text-xs text-neutral-500 mt-2">
              Top by wins: {data?.sourcePerformance?.topSourceByWins ?? "—"} · Top by revenue: {data?.sourcePerformance?.topSourceByRevenue ?? "—"}
            </p>
          )}
        </div>
      )}

      {/* Bottlenecks */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Bottlenecks</h2>
        {bottlenecks.length === 0 ? (
          <p className="text-sm text-neutral-500">No bottlenecks</p>
        ) : (
          <ul className="space-y-2">
            {bottlenecks.map((b) => (
              <li key={b.key} className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    b.severity === "high"
                      ? "text-red-400"
                      : b.severity === "medium"
                        ? "text-amber-400"
                        : "text-neutral-400"
                  }
                >
                  {b.severity}
                </Badge>
                <Link href={b.href} className="text-emerald-400 hover:underline">
                  {b.label}: {b.count}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Trends link */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Weekly Trends</h2>
        <p className="text-sm text-neutral-500 mb-3">
          Capture a snapshot to build trend history. View snapshots for the last 8 weeks.
        </p>
        <Link href="/dashboard/intelligence/trends">
          <Button variant="outline" size="sm">
            View trends <ChevronRight className="w-4 h-3 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
