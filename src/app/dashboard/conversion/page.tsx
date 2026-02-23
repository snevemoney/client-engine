"use client";

import { useState, useEffect } from "react";
import { BarChart3 } from "lucide-react";

interface ConversionData {
  counts: { total: number; proposalSent: number; approved: number; buildStarted: number; buildCompleted: number; won: number; lost: number };
  rates: {
    proposalSentRate: number;
    approvedRate: number;
    buildStartRate: number;
    buildCompleteRate: number;
    winRate: number;
  };
  medianMs: {
    created_to_proposalSent: number | null;
    proposalSent_to_approved: number | null;
    approved_to_buildStarted: number | null;
    buildStarted_to_buildCompleted: number | null;
  };
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3600_000).toFixed(1)}h`;
}

export default function ConversionPage() {
  const [data, setData] = useState<ConversionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/metrics/conversion")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="border border-neutral-800 rounded-lg p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-7 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-40 rounded-lg bg-muted" />
    </div>
  );
  if (!data) return <div className="text-neutral-500 py-12 text-center">Failed to load conversion data.</div>;

  const { counts, rates, medianMs } = data;
  const maxCount = Math.max(counts.total, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> Conversion funnel
        </h1>
        <p className="text-sm text-neutral-400 mt-1">Lead → proposal sent → approved → build → won/lost</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total leads", value: counts.total },
          { label: "Proposal sent", value: counts.proposalSent },
          { label: "Approved", value: counts.approved },
          { label: "Build started", value: counts.buildStarted },
          { label: "Build completed", value: counts.buildCompleted },
          { label: "Won", value: counts.won, color: "text-emerald-400" },
          { label: "Lost", value: counts.lost, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-neutral-800 rounded-lg p-4">
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{label}</div>
            <div className={`text-2xl font-semibold mt-1 ${color ?? ""}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="border border-neutral-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Conversion rates</h2>
        <div className="space-y-2">
          {[
            { label: "Proposal sent / total", rate: rates.proposalSentRate },
            { label: "Approved / proposal sent", rate: rates.approvedRate },
            { label: "Build started / approved", rate: rates.buildStartRate },
            { label: "Build completed / started", rate: rates.buildCompleteRate },
            { label: "Win rate (won / approved)", rate: rates.winRate },
          ].map(({ label, rate }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-48 text-sm text-neutral-400">{label}</div>
              <div className="flex-1 h-5 bg-neutral-900 rounded overflow-hidden">
                <div className="h-full bg-neutral-600 rounded" style={{ width: `${rate * 100}%` }} />
              </div>
              <span className="text-sm font-medium w-12">{(rate * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-neutral-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Median time between stages</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="text-sm">Created → Proposal sent: {formatMs(medianMs.created_to_proposalSent)}</div>
          <div className="text-sm">Proposal sent → Approved: {formatMs(medianMs.proposalSent_to_approved)}</div>
          <div className="text-sm">Approved → Build started: {formatMs(medianMs.approved_to_buildStarted)}</div>
          <div className="text-sm">Build started → Completed: {formatMs(medianMs.buildStarted_to_buildCompleted)}</div>
        </div>
      </div>
    </div>
  );
}
