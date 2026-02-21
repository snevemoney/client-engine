"use client";

import { useState } from "react";
import { Play } from "lucide-react";

export function WorkdayRunCard({ lastRunAt }: { lastRunAt: string | null }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; at?: string; research?: { created: number }; pipeline?: { runs: number; retries: number } } | null>(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ops/workday-run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      setResult(data);
    } catch (e) {
      setResult({ ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Start Workday Automation</h2>
      <p className="text-xs text-neutral-500 mb-3">
        Research → ingest → enrich → score → position → propose. Safe retries. No auto-send or auto-build.
      </p>
      {lastRunAt && (
        <p className="text-xs text-neutral-400 mb-2">
          Last run: {new Date(lastRunAt).toLocaleString()}
        </p>
      )}
      <button
        onClick={handleRun}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
      >
        <Play className="w-4 h-4" />
        {loading ? "Running…" : "Start Workday Automation"}
      </button>
      {result && (
        <div className="mt-3 text-xs text-neutral-400">
          {result.ok ? (
            <>
              Research created: {result.research?.created ?? 0}. Pipeline runs: {result.pipeline?.runs ?? 0}, retries: {result.pipeline?.retries ?? 0}.
            </>
          ) : (
            <span className="text-amber-400">Run reported errors. Check logs or Metrics.</span>
          )}
        </div>
      )}
    </section>
  );
}
