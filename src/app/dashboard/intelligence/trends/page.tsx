"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const METRIC_OPTIONS = [
  { key: "won_value", label: "Accepted value" },
  { key: "delivered_value", label: "Delivered value" },
  { key: "accepted_count", label: "Accepted count" },
  { key: "proposals_sent", label: "Proposals sent" },
  { key: "delivery_completed", label: "Delivery completed" },
  { key: "proof_created", label: "Proof created" },
  { key: "handoffs_completed", label: "Handoffs completed" },
  { key: "testimonials_received", label: "Testimonials received" },
  { key: "intake_count", label: "Intake count" },
];

export default function IntelligenceTrendsPage() {
  const [metricKey, setMetricKey] = useState("won_value");
  const [weeks, setWeeks] = useState(8);
  const [data, setData] = useState<{ points: Array<{ weekStart: string; weekLabel: string; value: number; count?: number | null }> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- fetch-on-mount pattern
    fetch(`/api/metrics/trends?metricKey=${metricKey}&weeks=${weeks}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d && typeof d === "object" ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [metricKey, weeks]);

  const points = data?.points ?? [];

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <Link href="/dashboard/intelligence" className="text-sm text-neutral-400 hover:text-neutral-200">← Intelligence</Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Weekly Trends</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Historical snapshots. Capture a snapshot on the main Intelligence page to build history.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Metric</label>
          <select
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value)}
            className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Weeks</label>
          <select
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value, 10))}
            className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
          >
            {[4, 8, 12, 24].map((w) => (
              <option key={w} value={w}>{w} weeks</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      ) : points.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 rounded-lg border border-neutral-800">
          No trend data yet. Capture a weekly snapshot on the Intelligence page to build history.
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left p-3 font-medium">Week</th>
                <th className="text-right p-3 font-medium">Value</th>
                <th className="text-right p-3 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.weekStart} className="border-b border-neutral-800/50">
                  <td className="p-3">{p.weekLabel}</td>
                  <td className="p-3 text-right">
                    {METRIC_OPTIONS.find((o) => o.key === metricKey)?.key.startsWith("won") || metricKey.includes("value")
                      ? `$${p.value.toLocaleString("en-US")}`
                      : p.value}
                  </td>
                  <td className="p-3 text-right text-neutral-500">{p.count ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
