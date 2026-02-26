"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";

type Run = {
  id: string;
  accountId: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  trigger: string;
  dryRun: boolean;
  summary: Record<string, unknown>;
  error: string | null;
};

export function MetaAdsSchedulerRunsPanel({ className = "", refreshKey = 0 }: { className?: string; refreshKey?: number }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meta-ads/scheduler/runs?limit=20");
      const json = await res.json();
      setRuns(json.runs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns, refreshKey]);

  const statusCls = (s: string) =>
    s === "success" ? "bg-emerald-900/40 text-emerald-200" : s === "partial" ? "bg-amber-900/40 text-amber-200" : s === "skipped" ? "bg-neutral-700 text-neutral-400" : "bg-red-900/40 text-red-200";

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Scheduler run history</h3>
        <button onClick={fetchRuns} disabled={loading} className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-50 flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="h-24 rounded bg-neutral-800 animate-pulse" />
      ) : runs.length === 0 ? (
        <p className="text-neutral-500 text-sm py-4">No scheduler runs yet.</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {runs.map((r) => (
            <div key={r.id} className="rounded border border-neutral-700 bg-neutral-800/50 p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded text-neutral-500">
                  {new Date(r.startedAt).toLocaleString("en-US")}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusCls(r.status)}`}>{r.status}</span>
                <span className="text-[10px] text-neutral-500">{r.trigger}</span>
                {r.dryRun && <span className="text-[10px] text-amber-400">dry-run</span>}
              </div>
              {r.summary && typeof r.summary === "object" && Object.keys(r.summary).length > 0 && (
                <div className="text-[10px] text-neutral-500 mt-1">
                  {[
                    r.summary.generated != null && `gen: ${r.summary.generated}`,
                    r.summary.autoApproved != null && `auto-approved: ${r.summary.autoApproved}`,
                    r.summary.applied != null && `applied: ${r.summary.applied}`,
                    r.summary.simulated != null && `simulated: ${r.summary.simulated}`,
                    r.summary.blocked != null && `blocked: ${r.summary.blocked}`,
                    r.summary.failed != null && `failed: ${r.summary.failed}`,
                    (typeof r.summary.alertsSent === "number" && r.summary.alertsSent > 0) && `alerts: ${r.summary.alertsSent}`,
                    r.summary.trendDataAvailable === true && "trends ✓",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
              {r.error && <p className="text-[10px] text-red-400 mt-0.5">{r.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
