"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { RefreshCw, Zap, Play, Filter } from "lucide-react";

type Rec = {
  id: string;
  entityType: string;
  entityId: string;
  campaignId?: string | null;
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

type SettingsSummary = {
  protectedCampaignIds?: string[];
};

type LastActionEntry = { createdAt: string; status: string; actionType: string };

const EXECUTABLE_ACTIONS = ["pause", "resume", "increase_budget", "decrease_budget"];

function formatLastAction(createdAt: string, status: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 2) return "1d ago";
  if (days < 7) return `${days}d ago`;
  if (days < 14) return "1w ago";
  return `${Math.floor(days / 7)}w ago`;
}

export function MetaAdsRecommendationsPanel({ onRefresh, onData }: { onRefresh?: () => void; onData?: (d: { lastGenerated: string | null }) => void }) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [settingsSummary, setSettingsSummary] = useState<SettingsSummary | null>(null);
  const [lastActionByEntity, setLastActionByEntity] = useState<Record<string, LastActionEntry>>({});
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterActionability, setFilterActionability] = useState<string>("all");

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/recommendations");
      const json = await res.json();
      setRecs(json.recommendations ?? []);
      setCounts(json.counts ?? {});
      setSettingsSummary(json.settingsSummary ?? null);
      setLastActionByEntity(json.lastActionByEntity ?? {});
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

  async function patchRec(id: string, action: "approve" | "dismiss" | "false_positive" | "reset") {
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

  const protectedIds = settingsSummary?.protectedCampaignIds ?? [];
  const isProtected = (r: Rec) => {
    if (r.entityType === "campaign" && protectedIds.includes(r.entityId)) return true;
    if (r.campaignId && protectedIds.includes(r.campaignId)) return true;
    return false;
  };
  const canApply = (r: Rec) =>
    ["approved", "queued"].includes(r.status) &&
    !isProtected(r) &&
    EXECUTABLE_ACTIONS.includes(r.actionType);

  function getApplyDisabledReason(r: Rec): string | null {
    if (canApply(r)) return null;
    if (isProtected(r)) return "Protected campaign";
    if (r.status === "false_positive") return "False positive";
    if (r.status === "applied") return "Already applied";
    if (r.status === "dismissed") return "Dismissed";
    if (r.status === "failed") return "Failed";
    if (["queued", "approved"].includes(r.status) && !EXECUTABLE_ACTIONS.includes(r.actionType))
      return "No executable action";
    if (r.status === "queued") return "Approve first";
    return "Approve first";
  }

  const filteredRecs = useMemo(() => {
    let out = recs;
    if (filterStatus !== "all") out = out.filter((r) => r.status === filterStatus);
    if (filterSeverity !== "all") out = out.filter((r) => r.severity === filterSeverity);
    if (filterActionability === "applyable")
      out = out.filter((r) => EXECUTABLE_ACTIONS.includes(r.actionType));
    if (filterActionability === "non-applyable")
      out = out.filter((r) => !EXECUTABLE_ACTIONS.includes(r.actionType));
    return out;
  }, [recs, filterStatus, filterSeverity, filterActionability]);

  const severityCls = (s: string) =>
    s === "critical" ? "bg-red-900/40 text-red-200" : s === "warn" ? "bg-amber-900/40 text-amber-200" : "bg-neutral-700 text-neutral-300";
  const statusCls = (s: string) =>
    s === "approved"
      ? "bg-emerald-900/40 text-emerald-200"
      : s === "applied"
        ? "bg-blue-900/40 text-blue-200"
        : s === "dismissed"
          ? "bg-neutral-700 text-neutral-400"
          : s === "failed"
            ? "bg-red-900/40 text-red-200"
            : s === "false_positive"
              ? "bg-purple-900/40 text-purple-200"
              : "bg-amber-900/40 text-amber-200";

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-sm font-medium text-neutral-300">Recommendations</h2>
        <div className="flex gap-2">
          <button
            onClick={generate}
            disabled={genLoading}
            className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            {genLoading ? "Generating…" : "Generate"}
          </button>
          <button
            onClick={fetchRecs}
            disabled={loading}
            className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {!loading && recs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Filter className="w-3.5 h-3.5 text-neutral-500" />
          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300"
            >
              <option value="all">All status</option>
              <option value="queued">Queued ({counts.queued ?? 0})</option>
              <option value="approved">Approved ({counts.approved ?? 0})</option>
              <option value="false_positive">False + ({counts.false_positive ?? 0})</option>
              <option value="applied">Applied ({counts.applied ?? 0})</option>
              <option value="dismissed">Dismissed ({counts.dismissed ?? 0})</option>
              <option value="failed">Failed ({counts.failed ?? 0})</option>
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300"
            >
              <option value="all">All severity</option>
              <option value="critical">Critical</option>
              <option value="warn">Warn</option>
              <option value="info">Info</option>
            </select>
            <button
              type="button"
              onClick={() => setFilterSeverity(filterSeverity === "critical" ? "all" : "critical")}
              className={`rounded px-2 py-1 text-[10px] ${filterSeverity === "critical" ? "bg-red-900/50 text-red-200" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}
            >
              Critical only
            </button>
            <select
              value={filterActionability}
              onChange={(e) => setFilterActionability(e.target.value)}
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300"
            >
              <option value="all">All actions</option>
              <option value="applyable">Applyable only</option>
              <option value="non-applyable">Non-applyable</option>
            </select>
          </div>
          {recs.length !== filteredRecs.length && (
            <span className="text-[10px] text-neutral-500">
              Showing {filteredRecs.length} of {recs.length}
            </span>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {loading ? (
        <div className="h-32 rounded bg-neutral-800 animate-pulse" />
      ) : recs.length === 0 ? (
        <p className="text-neutral-500 text-sm py-6 text-center">No recommendations. Click Generate.</p>
      ) : filteredRecs.length === 0 ? (
        <p className="text-neutral-500 text-sm py-6 text-center">No recommendations match filters.</p>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {filteredRecs.map((r) => {
            const disabledReason = getApplyDisabledReason(r);
            const entityKey = `${r.entityType}:${r.entityId}`;
            const lastAction = lastActionByEntity[entityKey];
            return (
              <div key={r.id} className="rounded border border-neutral-700 bg-neutral-800/50 p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="text-neutral-200 font-medium">{r.entityName}</span>
                    <span className="text-neutral-500 text-xs ml-2">({r.entityType})</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusCls(r.status)}`}>{r.status}</span>
                      {isProtected(r) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200">Protected</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${severityCls(r.severity)}`}>{r.severity}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">{r.ruleKey}</span>
                    </div>
                    <p className="text-neutral-400 text-xs mt-1">{r.reason}</p>
                    {lastAction ? (
                      <p className="text-[10px] text-neutral-500 mt-0.5">
                        Last action: {formatLastAction(lastAction.createdAt, lastAction.status)} ({lastAction.status})
                      </p>
                    ) : (
                      <p className="text-[10px] text-neutral-500 mt-0.5">No prior action</p>
                    )}
                    {r.evidence && Object.keys(r.evidence).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(r.evidence)
                          .filter(([, v]) => v != null)
                          .map(([k, v]) => (
                            <span
                              key={k}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500"
                            >
                              {k}: {typeof v === "number" ? (k.toLowerCase().includes("deltapct") ? `${v >= 0 ? "+" : ""}${Number(v).toFixed(0)}%` : k.includes("spend") || (k.includes("cpl") && !k.includes("Delta")) ? `$${Number(v).toFixed(0)}` : String(v)) : String(v)}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 flex-wrap items-start">
                    {["queued", "approved"].includes(r.status) && (
                      <>
                        <button
                          onClick={() => patchRec(r.id, "approve")}
                          disabled={actionId !== null || r.status === "approved"}
                          className="rounded px-2 py-1 text-[10px] text-emerald-200 bg-emerald-900/40 hover:bg-emerald-900/60 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => patchRec(r.id, "dismiss")}
                          disabled={actionId !== null}
                          className="rounded px-2 py-1 text-[10px] text-neutral-300 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => patchRec(r.id, "false_positive")}
                          disabled={actionId !== null}
                          className="rounded px-2 py-1 text-[10px] text-purple-200 bg-purple-900/40 hover:bg-purple-900/60 disabled:opacity-50"
                        >
                          False +
                        </button>
                      </>
                    )}
                    {["approved", "dismissed", "false_positive"].includes(r.status) && (
                      <button
                        onClick={() => patchRec(r.id, "reset")}
                        disabled={actionId !== null}
                        className="rounded px-2 py-1 text-[10px] text-neutral-300 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50"
                      >
                        Reset
                      </button>
                    )}
                    {canApply(r) ? (
                      <button
                        onClick={() => apply(r.id)}
                        disabled={actionId !== null}
                        className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-amber-200 bg-amber-900/40 hover:bg-amber-900/60 disabled:opacity-50"
                      >
                        <Play className="w-3 h-3" />
                        Apply
                      </button>
                    ) : (
                      disabledReason && (
                        <span className="text-[10px] text-neutral-500 px-2 py-1 italic" title={disabledReason}>
                          {disabledReason}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && recs.length > 0 && (
        <p className="text-neutral-500 text-xs mt-3">
          Queued: {counts.queued ?? 0} · Approved: {counts.approved ?? 0} · Applied: {counts.applied ?? 0} · False +: {counts.false_positive ?? 0}
        </p>
      )}
    </section>
  );
}
