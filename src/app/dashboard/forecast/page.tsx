"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ChevronRight, AlertTriangle } from "lucide-react";

type ForecastMetric = {
  key: string;
  label: string;
  actual: number;
  projected: number;
  target: number | null;
  status: string;
  confidence: string;
  unit: string;
};

type ForecastPeriod = {
  periodType: string;
  periodStart: string;
  periodEnd: string;
  elapsedDays: number;
  totalDays: number;
  metrics: ForecastMetric[];
  warnings: string[];
};

type ForecastData = {
  weekly: ForecastPeriod;
  monthly: ForecastPeriod;
  warnings: string[];
  behindPaceCount: number;
};

function statusColor(s: string): string {
  if (s === "ahead") return "text-emerald-400";
  if (s === "behind") return "text-red-400";
  return "text-neutral-400";
}

function confidenceColor(c: string): string {
  if (c === "high") return "text-emerald-400";
  if (c === "medium") return "text-yellow-400";
  return "text-neutral-500";
}

function formatValue(v: number, unit: string): string {
  if (unit === "value") return `$${v.toLocaleString("en-US")}`;
  return String(v);
}

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/forecast/current")
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
      const res = await fetch("/api/forecast/snapshot", { method: "POST" });
      if (res.ok) fetchData();
      else {
        const d = await res.json();
        toast.error(d?.error ?? "Snapshot failed");
      }
    } finally {
      setSnapshotLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Forecast</h1>
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      </div>
    );
  }

  const weekly = data?.weekly ?? { metrics: [], warnings: [], periodStart: "", periodEnd: "", elapsedDays: 0, totalDays: 7 };
  const monthly = data?.monthly ?? { metrics: [], warnings: [], periodStart: "", periodEnd: "", elapsedDays: 0, totalDays: 30 };
  const warnings = data?.warnings ?? [];

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pace Forecast</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Projected outcomes based on current pace. Week: {weekly.periodStart} → {weekly.periodEnd} (day {Math.round(weekly.elapsedDays)}/{weekly.totalDays}).
          </p>
        </div>
        <Button size="sm" onClick={handleSnapshot} disabled={snapshotLoading}>
          {snapshotLoading ? "Capturing…" : "Capture Forecast Snapshot"}
        </Button>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-4">
          <h2 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Warnings
          </h2>
          <ul className="space-y-1 text-sm text-amber-200/90">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Weekly forecast table */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Weekly Forecast</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-800">
                <th className="py-2 pr-4">Metric</th>
                <th className="py-2 pr-4">Actual</th>
                <th className="py-2 pr-4">Projected</th>
                <th className="py-2 pr-4">Target</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {(weekly.metrics ?? []).map((m) => (
                <tr key={m.key} className="border-b border-neutral-800/50">
                  <td className="py-2 pr-4">{m.label}</td>
                  <td className="py-2 pr-4">{formatValue(m.actual, m.unit)}</td>
                  <td className="py-2 pr-4 font-medium">{formatValue(m.projected, m.unit)}</td>
                  <td className="py-2 pr-4">{m.target != null ? formatValue(m.target, m.unit) : "—"}</td>
                  <td className="py-2 pr-4">
                    <Badge variant="outline" className={statusColor(m.status)}>
                      {m.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className={`py-2 ${confidenceColor(m.confidence)}`}>{m.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly forecast table */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Monthly Forecast</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-800">
                <th className="py-2 pr-4">Metric</th>
                <th className="py-2 pr-4">Actual</th>
                <th className="py-2 pr-4">Projected</th>
                <th className="py-2 pr-4">Target</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {(monthly.metrics ?? []).map((m) => (
                <tr key={m.key} className="border-b border-neutral-800/50">
                  <td className="py-2 pr-4">{m.label}</td>
                  <td className="py-2 pr-4">{formatValue(m.actual, m.unit)}</td>
                  <td className="py-2 pr-4 font-medium">{formatValue(m.projected, m.unit)}</td>
                  <td className="py-2 pr-4">{m.target != null ? formatValue(m.target, m.unit) : "—"}</td>
                  <td className="py-2 pr-4">
                    <Badge variant="outline" className={statusColor(m.status)}>
                      {m.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className={`py-2 ${confidenceColor(m.confidence)}`}>{m.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
        <Link href="/dashboard/operator">
          <Button variant="outline" size="sm">
            Operator Score
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
