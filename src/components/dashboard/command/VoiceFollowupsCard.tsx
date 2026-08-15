"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import { DegradedBanner } from "@/components/ui/DegradedBanner";

type VoiceMetrics = {
  eligibleCount: number;
  totalCalls: number;
  successRate: number;
  degraded?: boolean;
};

export function VoiceFollowupsCard() {
  const [metrics, setMetrics] = useState<VoiceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/voice/metrics", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Voice follow-ups</h2>
        <p className="text-xs text-neutral-500">Loading…</p>
      </section>
    );
  }

  if (!metrics) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Voice follow-ups</h2>
        <p className="text-xs text-neutral-500">Unable to load metrics</p>
      </section>
    );
  }

  const { eligibleCount, totalCalls, successRate, degraded } = metrics;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Voice follow-ups
        </h2>
        {degraded && (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-900/50 text-amber-200 border border-amber-700/50">
            Stub mode
          </span>
        )}
      </div>
      {degraded && (
        <div className="mb-3">
          <DegradedBanner reason="No VAPI/RETELL API key — calls are logged but not placed." />
        </div>
      )}
      <div className="grid gap-x-4 gap-y-1 grid-cols-2 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Eligible</span>
          <span className="text-neutral-200 font-medium tabular-nums">{eligibleCount}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Total calls</span>
          <span className="text-neutral-200 font-medium tabular-nums">{totalCalls}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Success rate</span>
          <span className="text-neutral-200 font-medium tabular-nums">
            {totalCalls > 0 ? `${Math.round(successRate * 100)}%` : "—"}
          </span>
        </div>
      </div>
      <Link
        href="/dashboard/proposal-followups?bucket=voice_eligible"
        className="mt-3 block text-xs text-amber-300 hover:underline"
      >
        View eligible proposals →
      </Link>
    </section>
  );
}
