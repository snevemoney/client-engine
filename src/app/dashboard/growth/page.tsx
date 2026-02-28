"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { AsyncState } from "@/components/ui/AsyncState";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { IntelligenceBanner } from "@/components/dashboard/IntelligenceBanner";
import type { IntelligenceContext } from "@/hooks/useIntelligenceContext";

type GrowthSummary = {
  countsByStage: Record<string, number>;
  overdueFollowUps: Array<{ id: string; prospectName: string; stage: string; nextFollowUpAt: string }>;
  next7DaysFollowUps: Array<{ id: string; prospectName: string; stage: string; nextFollowUpAt: string }>;
  lastActivityAt: string | null;
};

type Deal = {
  id: string;
  stage: string;
  nextFollowUpAt: string | null;
  prospect: { id: string; name: string; handle: string | null; platform: string; opportunityScore: number | null };
};

const STAGES = ["new", "contacted", "replied", "call_scheduled", "proposal_sent", "won", "lost"];

export default function GrowthPage() {
  const [summary, setSummary] = useState<GrowthSummary | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [addProspectOpen, setAddProspectOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPlatform, setAddPlatform] = useState("instagram");
  const [addHandle, setAddHandle] = useState("");
  const [addScore, setAddScore] = useState("");
  const [filterStage, setFilterStage] = useState<string>("");
  const [filterDue, setFilterDue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedStage = useDebouncedValue(filterStage, 300);
  const debouncedDue = useDebouncedValue(filterDue, 300);
  const [risk, setRisk] = useState<IntelligenceContext["risk"] | null>(null);
  const [nba, setNba] = useState<IntelligenceContext["nba"] | null>(null);

  const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const [contextRes, dealsRes] = await Promise.all([
        fetch("/api/internal/growth/context", { credentials: "include", cache: "no-store", signal: controller.signal }),
        fetch(
          `/api/internal/growth/deals?${new URLSearchParams({
            ...(debouncedStage && { stage: debouncedStage }),
            ...(debouncedDue && { due: debouncedDue }),
          }).toString()}`,
          { credentials: "include", cache: "no-store", signal: controller.signal }
        ),
      ]);
      if (controller.signal.aborted) return;
      if (!contextRes.ok || !dealsRes.ok) {
        setError("Failed to load growth data");
        return;
      }
      const ctx = await contextRes.json();
      setSummary(ctx?.summary ?? null);
      setRisk(ctx?.risk ?? null);
      setNba(ctx?.nba ?? null);
      const d = await dealsRes.json();
      setDeals(d.items ?? []);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setRisk(null);
      setNba(null);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [debouncedStage, debouncedDue]);

  useEffect(() => {
    void fetchData();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchData]);

  const { execute: handleRunGrowthNBA, pending: runNBALoading } = useAsyncAction(
    async () => fetchJsonThrow("/api/next-actions/run?entityType=founder_growth&entityId=founder_growth", { method: "POST" }),
    { toast: toastFn, successMessage: "Growth NBA executed", onSuccess: () => void fetchData() },
  );

  const { execute: handleAddProspect, pending: saving } = useAsyncAction(
    async () => {
      if (!addName.trim()) throw new Error("Name is required");
      return fetchJsonThrow("/api/internal/growth/prospects", {
        method: "POST",
        body: JSON.stringify({
          name: addName.trim(),
          platform: addPlatform,
          handle: addHandle.trim() || undefined,
          opportunityScore: addScore ? parseInt(addScore, 10) : undefined,
        }),
      });
    },
    {
      toast: toastFn,
      successMessage: "Prospect added",
      onSuccess: () => {
        setAddProspectOpen(false);
        setAddName("");
        setAddHandle("");
        setAddScore("");
        void fetchData();
      },
    },
  );

  return (
    <div className="space-y-6" data-testid="growth-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Growth Pipeline</h1>
          <p className="text-sm text-neutral-400 mt-1">Prospects → Outreach → Follow-up → Close</p>
        </div>
        <IntelligenceBanner risk={risk} nba={nba} score={null} loading={loading} />
        <button
          type="button"
          onClick={() => void handleRunGrowthNBA()}
          disabled={runNBALoading}
          className="rounded bg-amber-600 hover:bg-amber-500 text-black px-3 py-1.5 text-sm disabled:opacity-50"
          data-testid="run-growth-nba"
        >
          {runNBALoading ? "Running…" : "Run Growth NBA"}
        </button>
      </div>

      <AsyncState loading={loading} error={error} empty={!loading && !error && !summary && deals.length === 0} emptyMessage="No growth data yet. Add a prospect to get started." onRetry={fetchData}>

      {/* Pipeline Follow-ups card */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="growth-followups">
        <h2 className="text-sm font-medium text-amber-400/90 mb-3">Follow-ups</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-neutral-500 mb-1">Overdue</p>
            <ul className="text-sm space-y-1">
              {(summary?.overdueFollowUps ?? []).slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link href={`/dashboard/growth/deals/${d.id}`} className="text-amber-400 hover:underline">
                    {d.prospectName}
                  </Link>
                  <span className="text-neutral-500 ml-1">— {d.stage}</span>
                </li>
              ))}
              {(!summary?.overdueFollowUps || summary.overdueFollowUps.length === 0) && (
                <li className="text-neutral-500">None</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-xs text-neutral-500 mb-1">Next 7 days</p>
            <ul className="text-sm space-y-1">
              {(summary?.next7DaysFollowUps ?? []).slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link href={`/dashboard/growth/deals/${d.id}`} className="text-amber-400 hover:underline">
                    {d.prospectName}
                  </Link>
                  <span className="text-neutral-500 ml-1">— {d.stage}</span>
                </li>
              ))}
              {(!summary?.next7DaysFollowUps || summary.next7DaysFollowUps.length === 0) && (
                <li className="text-neutral-500">None</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Stage counts */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-amber-400/90 mb-3">Pipeline by stage</h2>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStage(filterStage === s ? "" : s)}
              className={`px-2 py-1 rounded text-xs ${
                filterStage === s ? "bg-amber-500/30 text-amber-400" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              {s} ({summary?.countsByStage?.[s] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={filterDue}
          onChange={(e) => setFilterDue(e.target.value)}
          className="rounded bg-neutral-800 border border-neutral-700 text-sm px-2 py-1"
        >
          <option value="">All</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
        </select>
        <button
          type="button"
          onClick={() => setAddProspectOpen(true)}
          className="rounded bg-amber-600 hover:bg-amber-500 text-black px-3 py-1 text-sm"
        >
          Add prospect
        </button>
      </div>

      {/* Deal list */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-amber-400/90 mb-3">Deals</h2>
        <ul className="space-y-2">
          {deals.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
              <div>
                <Link href={`/dashboard/growth/deals/${d.id}`} className="text-amber-400 hover:underline font-medium">
                  {d.prospect.name}
                </Link>
                {d.prospect.handle && (
                  <span className="text-neutral-500 ml-2 text-xs">@{d.prospect.handle}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-700">{d.stage}</span>
                {d.nextFollowUpAt && (
                  <span className="text-xs text-neutral-500">
                    Follow-up: {new Date(d.nextFollowUpAt).toLocaleDateString()}
                  </span>
                )}
                <Link
                  href={`/dashboard/growth/deals/${d.id}`}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Open →
                </Link>
              </div>
            </li>
          ))}
          {deals.length === 0 && <p className="text-sm text-neutral-500">No deals. Add a prospect to get started.</p>}
        </ul>
      </div>

      {/* Add prospect modal */}
      {addProspectOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 w-full max-w-md">
            <h3 className="text-sm font-medium mb-3">Add prospect</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
              />
              <input
                type="text"
                placeholder="Handle (e.g. @tommy_oc91)"
                value={addHandle}
                onChange={(e) => setAddHandle(e.target.value)}
                className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
              />
              <select
                value={addPlatform}
                onChange={(e) => setAddPlatform(e.target.value)}
                className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
              >
                <option value="instagram">Instagram</option>
                <option value="twitter">Twitter</option>
                <option value="upwork">Upwork</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="other">Other</option>
              </select>
              <input
                type="number"
                placeholder="Opportunity score (1-10)"
                min={1}
                max={10}
                value={addScore}
                onChange={(e) => setAddScore(e.target.value)}
                className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => void handleAddProspect()}
                disabled={saving}
                className="rounded bg-amber-600 hover:bg-amber-500 text-black px-3 py-1 text-sm disabled:opacity-50"
              >
                {saving ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setAddProspectOpen(false)}
                className="rounded border border-neutral-600 px-3 py-1 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      </AsyncState>

      <Link href="/dashboard/founder" className="text-sm text-amber-400 hover:underline">
        ← Founder
      </Link>
    </div>
  );
}
