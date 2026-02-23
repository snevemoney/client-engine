"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Zap, Play } from "lucide-react";

type Rec = {
  id: string;
  entityType: string;
  entityName: string;
  ruleKey: string;
  severity: string;
  confidence: string;
  status: string;
  actionType: string;
  reason: string;
  evidence: Record<string, unknown>;
  createdAt: string;
};

export function MetaAdsRecommendationsPanel({ onRefresh, onData }: { onRefresh?: () => void; onData?: (d: { lastGenerated: string | null }) => void }) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/recommendations");
      const json = await res.json();
      setRecs(json.recommendations ?? []);
      setCounts(json.counts ?? {});
      const lg = json.lastGenerated ?? null;
      setLastGenerated(lg);
      onData?.({ lastGenerated: lg });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  async function generate() {
    setGenLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/recommendations/generate", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        await fetchRecs();
        onRefresh?.();
      } else {
        setError(json.error ?? "Generate failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenLoading(false);
    }
  }

  async function patchRec(id: string, action: "approve" | "dismiss") {
    setActionId(id);
    try {
      const res = await fetch(`/api/meta-ads/recommendations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) await fetchRecs();
      else setError((await res.json()).error ?? "Failed");
    } finally {
      setActionId(null);
    }
  }

  async function apply(id: string) {
    setActionId(id);
    try {
      const res = await fetch(`/api/meta-ads/recommendations/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchRecs();
        onRefresh?.();
      } else {
        setError(json.error ?? "Failed");
      }
    } finally {
      setActionId(null);
    }
  }

  const severityCls = (s: string) => (s === "critical" ? "bg-red-900/40 text-red-200" : s === "warn" ? "bg-amber-900/40 text-amber-200" : "bg-neutral-700 text-neutral-300");
  const statusCls = (s: string) => (s === "approved" ? "bg-emerald-900/40 text-emerald-200" : s === "applied" ? "bg-blue-900/40 text-blue-200" : s === "dismissed" ? "bg-neutral-700 text-neutral-400" : s === "failed" ? "bg-red-900/40 text-red-200" : "bg-amber-900/40 text-amber-200");
  const canApply = (r: Rec) => ["approved", "queued"].includes(r.status) && ["pause", "resume", "increase_budget", "decrease_budget"].includes(r.actionType);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-sm font-medium text-neutral-300">Recommendations</h2>
        <div className="flex gap-2">
          <button onClick={generate} disabled={genLoading} className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-50">
            <Zap className="w-3.5 h-3.5" />
            {genLoading ? "Generating…" : "Generate"}
          </button>
          <button onClick={fetchRecs} disabled={loading} className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {loading ? (
        <div className="h-32 rounded bg-neutral-800 animate-pulse" />
      ) : recs.length === 0 ? (
        <p className="text-neutral-500 text-sm py-6 text-center">No recommendations. Click Generate.</p>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {recs.map((r) => (
            <div key={r.id} className="rounded border border-neutral-700 bg-neutral-800/50 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <span className="text-neutral-200 font-medium">{r.entityName}</span>
                  <span className="text-neutral-500 text-xs ml-2">({r.entityType})</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusCls(r.status)}`}>{r.status}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${severityCls(r.severity)}`}>{r.severity}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">{r.ruleKey}</span>
                  </div>
                  <p className="text-neutral-400 text-xs mt-1">{r.reason}</p>
                  {r.evidence && Object.keys(r.evidence).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(r.evidence).filter(([, v]) => v != null).map(([k, v]) => (
                        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                          {k}: {typeof v === "number" ? (k.includes("spend") || k.includes("cpl") ? `$${Number(v).toFixed(0)}` : String(v)) : String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {["queued", "approved"].includes(r.status) && (
                    <>
                      <button onClick={() => patchRec(r.id, "approve")} disabled={actionId !== null || r.status === "approved"} className="rounded px-2 py-1 text-[10px] text-emerald-200 bg-emerald-900/40 hover:bg-emerald-900/60 disabled:opacity-50">Approve</button>
                      <button onClick={() => patchRec(r.id, "dismiss")} disabled={actionId !== null} className="rounded px-2 py-1 text-[10px] text-neutral-300 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50">Dismiss</button>
                    </>
                  )}
                  {canApply(r) && (
                    <button onClick={() => apply(r.id)} disabled={actionId !== null} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-amber-200 bg-amber-900/40 hover:bg-amber-900/60 disabled:opacity-50">
                      <Play className="w-3 h-3" />
                      Apply
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && recs.length > 0 && <p className="text-neutral-500 text-xs mt-3">Queued: {counts.queued ?? 0} · Approved: {counts.approved ?? 0} · Applied: {counts.applied ?? 0}</p>}
    </section>
  );
}
