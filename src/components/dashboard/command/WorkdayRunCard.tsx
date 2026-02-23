"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

export function WorkdayRunCard({ lastRunAt }: { lastRunAt: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    at?: string;
    research?: { discovered?: number; created: number; errors?: string[] };
    pipeline?: { runs: number; retries: number; errors?: string[] };
    knowledge?: { processed?: number; ingested?: number; errors?: string[] };
  } | null>(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ops/workday-run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      setResult(data);
      if (data.ok) {
        router.refresh();
      }
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
        <div className="mt-3 text-xs text-neutral-400 space-y-1">
          {result.ok ? (
            <>
              <div>Input: Research discovered {result.research?.discovered ?? 0}, created {result.research?.created ?? 0} leads</div>
              <div>Process: Pipeline runs {result.pipeline?.runs ?? 0}, retries {result.pipeline?.retries ?? 0}</div>
              {result.knowledge && (
                <div>Output: Knowledge processed {result.knowledge.processed ?? 0}, ingested {result.knowledge.ingested ?? 0}</div>
              )}
            </>
          ) : (
            <>
              <span className="text-amber-400">Run reported errors.</span>
              {(result.research?.errors?.length || result.pipeline?.errors?.length || result.knowledge?.errors?.length) ? (
                <div className="text-amber-500/90 mt-1">
                  {[
                    ...(result.research?.errors ?? []),
                    ...(result.pipeline?.errors ?? []),
                    ...(result.knowledge?.errors ?? []),
                  ]
                    .slice(0, 3)
                    .map((e, i) => (
                      <div key={i}>{e}</div>
                    ))}
                </div>
              ) : (
                <span> Check logs or Metrics.</span>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
