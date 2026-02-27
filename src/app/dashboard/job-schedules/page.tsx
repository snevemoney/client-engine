"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";
import { formatDateTimeSafe } from "@/lib/ui/date-safe";

type Schedule = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  jobType: string;
  isEnabled: boolean;
  cadenceType: string;
  intervalMinutes: number | null;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number | null;
  minute: number | null;
  nextRunAt: string | null;
  lastEnqueuedAt: string | null;
  lastRunJobId: string | null;
};

function formatCadence(s: Schedule): string {
  switch (s.cadenceType) {
    case "interval":
      return `Every ${s.intervalMinutes ?? 60} min`;
    case "daily":
      const h = String(s.hour ?? 0).padStart(2, "0");
      const m = String(s.minute ?? 0).padStart(2, "0");
      return `Daily at ${h}:${m}`;
    case "weekly": {
      const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.dayOfWeek ?? 0] ?? "?";
      const hw = String(s.hour ?? 0).padStart(2, "0");
      const mw = String(s.minute ?? 0).padStart(2, "0");
      return `Weekly ${dow} ${hw}:${mw}`;
    }
    case "monthly": {
      const dom = s.dayOfMonth ?? 1;
      const hm = String(s.hour ?? 0).padStart(2, "0");
      const mm = String(s.minute ?? 0).padStart(2, "0");
      return `Monthly day ${dom} at ${hm}:${mm}`;
    }
    default:
      return s.cadenceType;
  }
}

export default function JobSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/job-schedules", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");
      setSchedules(data?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleToggle = async (id: string, isEnabled: boolean) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/job-schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !isEnabled }),
      });
      if (res.ok) void fetchData();
      else { const d = await res.json(); toast.error(d?.error ?? "Update failed"); }
    } finally {
      setActioningId(null);
    }
  };

  const handleRunNow = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/job-schedules/${id}/run-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.created) toast.success(`Job enqueued: ${data.jobId}`);
        else toast("Job already queued (dedupe)");
        void fetchData();
      } else toast.error(data?.error ?? "Run failed");
    } finally {
      setActioningId(null);
    }
  };

  const enabledCount = schedules.filter((s) => s.isEnabled).length;
  const disabledCount = schedules.filter((s) => !s.isEnabled).length;
  const dueCount = schedules.filter((s) => s.isEnabled && s.nextRunAt && new Date(s.nextRunAt) <= new Date()).length;

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job Schedules</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Recurring job schedules. Use Tick on Jobs page or cron to /api/jobs/tick.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-semibold text-emerald-400">{enabledCount}</div>
          <div className="text-xs text-neutral-500">Enabled</div>
        </section>
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-semibold text-amber-400">{dueCount}</div>
          <div className="text-xs text-neutral-500">Due now</div>
        </section>
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-semibold text-neutral-500">{disabledCount}</div>
          <div className="text-xs text-neutral-500">Disabled</div>
        </section>
      </div>

      <div className="flex gap-2">
        <Link href="/dashboard/jobs">
          <Button variant="outline" size="sm" className="gap-2">
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Jobs
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={() => void fetchData()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      ) : error ? (
        <div className="py-12 text-center text-red-400">{error}</div>
      ) : schedules.length === 0 ? (
        <div className="py-12 text-center text-neutral-500">
          No schedules. Run <code className="rounded bg-neutral-800 px-1">npm run db:seed-job-schedules</code> to create defaults.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/80">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Title</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Job type</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Cadence</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Enabled</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Next run</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Last enqueued</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                  <td className="px-4 py-3">
                    <span className="font-medium">{s.title}</span>
                    <div className="text-xs text-neutral-500 font-mono">{s.key}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.jobType}</td>
                  <td className="px-4 py-3 text-neutral-400">{formatCadence(s)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(s.id, s.isEnabled)}
                      disabled={actioningId === s.id}
                      className="text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
                      title={s.isEnabled ? "Disable" : "Enable"}
                    >
                      {s.isEnabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{formatDateTimeSafe(s.nextRunAt)}</td>
                  <td className="px-4 py-3 text-neutral-400">{formatDateTimeSafe(s.lastEnqueuedAt)}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRunNow(s.id)}
                      disabled={actioningId === s.id}
                      className="gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Run now
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
