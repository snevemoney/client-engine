"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AsyncState } from "@/components/ui/AsyncState";
import { formatDateTimeSafe } from "@/lib/ui/date-safe";
import Link from "next/link";

type AuditItem = {
  id: string;
  createdAt: string;
  actionKey: string;
  actionLabel: string;
  sourceType: string;
  sourceId: string;
  sourceLabel: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  note: string | null;
  actorId: string | null;
  actorLabel: string | null;
};

type Summary = {
  actionsToday: number;
  promotionsThisWeek: number;
  proposalsSentThisWeek: number;
  acceptsThisWeek: number;
  deliveriesCompletedThisWeek: number;
  proofsPromotedThisWeek: number;
  handoffsCompletedThisWeek: number;
  testimonialsReceivedThisWeek: number;
};

function sourceHref(sourceType: string, sourceId: string): string | null {
  switch (sourceType) {
    case "intake_lead":
      return `/dashboard/intake/${sourceId}`;
    case "proposal":
      return `/dashboard/proposals/${sourceId}`;
    case "delivery_project":
      return `/dashboard/delivery/${sourceId}`;
    case "proof_candidate":
      return `/dashboard/proof-candidates/${sourceId}`;
    default:
      return null;
  }
}

export default function AuditPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState("");
  const [actionKey, setActionKey] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (sourceType) params.set("sourceType", sourceType);
      if (actionKey) params.set("actionKey", actionKey);
      params.set("limit", "50");

      const [sumRes, listRes] = await Promise.all([
        fetch("/api/audit-actions/summary", { credentials: "include", signal: controller.signal }),
        fetch(`/api/audit-actions?${params}`, { credentials: "include", signal: controller.signal }),
      ]);

      if (controller.signal.aborted || runId !== runIdRef.current) return;

      const sumData = await sumRes.json().catch(() => null);
      const listData = await listRes.json().catch(() => null);

      if (!sumRes.ok) {
        setError(typeof sumData?.error === "string" ? sumData.error : "Failed to load");
        return;
      }

      setSummary(sumData);
      setItems(Array.isArray(listData?.items) ? listData.items : []);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [debouncedSearch, sourceType, actionKey]);

  useEffect(() => {
    void fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  const isEmpty = !loading && !error && items.length === 0 && !summary;

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Business action log for intake, proposals, delivery, proof.
        </p>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={isEmpty}
        emptyMessage="No audit actions yet."
        onRetry={fetchData}
      >
        {summary && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Actions today</p>
                <p className="text-xl font-semibold text-neutral-200">{summary.actionsToday ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Promotions (wk)</p>
                <p className="text-xl font-semibold text-neutral-200">{summary.promotionsThisWeek ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Proposals sent (wk)</p>
                <p className="text-xl font-semibold text-neutral-200">{summary.proposalsSentThisWeek ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Accepts (wk)</p>
                <p className="text-xl font-semibold text-neutral-200">{summary.acceptsThisWeek ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Deliveries done (wk)</p>
                <p className="text-xl font-semibold text-neutral-200">{summary.deliveriesCompletedThisWeek ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Proofs promoted (wk)</p>
                <p className="text-xl font-semibold text-neutral-200">{summary.proofsPromotedThisWeek ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Handoffs done (wk)</p>
                <p className="text-xl font-semibold text-neutral-200">{summary.handoffsCompletedThisWeek ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Testimonials (wk)</p>
                <p className="text-xl font-semibold text-neutral-200">{summary.testimonialsReceivedThisWeek ?? 0}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
              >
                <option value="">All sources</option>
                <option value="intake_lead">Intake lead</option>
                <option value="proposal">Proposal</option>
                <option value="delivery_project">Delivery project</option>
                <option value="proof_candidate">Proof candidate</option>
              </select>
              <select
                value={actionKey}
                onChange={(e) => setActionKey(e.target.value)}
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
              >
                <option value="">All actions</option>
                <option value="intake.create">Intake create</option>
                <option value="intake.promote">Intake promote</option>
                <option value="proposal.mark_sent">Proposal mark sent</option>
                <option value="proposal.accept">Proposal accept</option>
                <option value="delivery.complete">Delivery complete</option>
                <option value="proof.promote">Proof promote</option>
                <option value="handoff.complete">Handoff complete</option>
              </select>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm w-40"
              />
            </div>

            <div className="rounded-lg border border-neutral-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-700 bg-neutral-900/50">
                      <th className="text-left p-3 font-medium text-neutral-400">Time</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Action</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Source</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Actor</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) => {
                      const href = sourceHref(a.sourceType, a.sourceId);
                      return (
                        <tr key={a.id} className="border-b border-neutral-800 hover:bg-neutral-800/30">
                          <td className="p-3 text-neutral-400">{formatDateTimeSafe(a.createdAt)}</td>
                          <td className="p-3 text-neutral-200">{a.actionLabel}</td>
                          <td className="p-3">
                            {href ? (
                              <Link href={href} className="text-emerald-400 hover:underline">
                                {a.sourceLabel ?? `${a.sourceType}/${a.sourceId.slice(0, 8)}`}
                              </Link>
                            ) : (
                              <span className="text-neutral-400">
                                {a.sourceLabel ?? `${a.sourceType}/${a.sourceId.slice(0, 8)}`}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-neutral-400">{a.actorLabel ?? a.actorId ?? "—"}</td>
                          <td className="p-3 text-neutral-500 max-w-[200px] truncate" title={a.note ?? undefined}>
                            {a.note ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </AsyncState>
    </div>
  );
}
