"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, Search, Target, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadStatusBadge } from "@/components/intake/LeadStatusBadge";
import { LeadSourceBadge } from "@/components/intake/LeadSourceBadge";
import { LeadScoreBadge } from "@/components/intake/LeadScoreBadge";
import { LeadFormModal } from "@/components/intake/LeadFormModal";
import type { LeadFormData } from "@/components/intake/LeadFormModal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { AsyncState } from "@/components/ui/AsyncState";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { formatDateSafe } from "@/lib/ui/date-safe";
import { normalizePagination } from "@/lib/ui/pagination-safe";

interface IntakeLead {
  id: string;
  source: string;
  title: string;
  company: string | null;
  status: string;
  score: number | null;
  promotedLeadId?: string | null;
  nextAction?: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = ["all", "new", "qualified", "proposal_drafted", "sent", "won", "lost", "archived"];
const SOURCE_OPTIONS = ["all", "upwork", "linkedin", "referral", "inbound", "rss", "other"];

const QUICK_FILTERS = [
  { key: "all", label: "All" },
  { key: "needs-score", label: "Needs score" },
  { key: "ready", label: "Ready to promote" },
  { key: "followup-overdue", label: "Follow-up overdue" },
  { key: "won-missing-proof", label: "Won missing proof" },
] as const;

export default function IntakePage() {
  const url = useUrlQueryState();
  const [search, setSearch] = useState(() => url.getString("search"));
  const debouncedSearch = useDebouncedValue(search, 300);
  const [leads, setLeads] = useState<IntakeLead[]>([]);
  const [pagination, setPagination] = useState(() => normalizePagination(null, 0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [bulkScoreLoading, setBulkScoreLoading] = useState(false);
  const [bulkPromoteLoading, setBulkPromoteLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const trackEvent = useTrackEvent();

  const quickFilter = url.getString("filter", "all");
  const statusFilter = url.getString("status", "all");
  const sourceFilter = url.getString("source", "all");
  const page = url.getPage();
  const pageSize = url.getPageSize();

  useEffect(() => {
    setSearch((prev) => {
      const u = url.getString("search");
      return u !== prev ? u : prev;
    });
  }, [url.searchParams]);

  useEffect(() => {
    if (debouncedSearch !== url.getString("search")) {
      url.setSearch(debouncedSearch);
    }
  }, [debouncedSearch]);

  const fetchLeads = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (quickFilter !== "all") params.set("filter", quickFilter);
      else if (statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/intake-leads?${params}`, {
        credentials: "include",
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `Failed to load leads (${res.status})`);
        setLeads([]);
        setPagination(normalizePagination(null, 0));
        return;
      }
      setLeads(Array.isArray(data?.items) ? data.items : []);
      setPagination(normalizePagination(data?.pagination, data?.items?.length ?? 0));
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load leads");
      setLeads([]);
      setPagination(normalizePagination(null, 0));
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [debouncedSearch, quickFilter, statusFilter, sourceFilter, page, pageSize]);

  useEffect(() => {
    void fetchLeads();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchLeads]);

  const setQuickFilter = (v: string) => {
    url.update({
      filter: v === "all" ? null : v,
      status: null,
    }, true);
  };
  const setStatusFilter = (v: string) => {
    url.update({
      status: v === "all" ? null : v,
      filter: null,
    }, true);
  };
  const setSourceFilter = (v: string) => url.setFilter("source", v);

  const handleBulkScore = async () => {
    if (bulkScoreLoading) return;
    setBulkScoreLoading(true);
    try {
      const res = await fetch("/api/intake-leads/bulk-score", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "Failed to score leads");
        return;
      }
      trackEvent("bulk_score_triggered", { count: pagination.total });
      void fetchLeads();
    } finally {
      setBulkScoreLoading(false);
    }
  };

  const handleBulkPromote = async () => {
    if (bulkPromoteLoading) return;
    setBulkPromoteLoading(true);
    try {
      const res = await fetch("/api/intake-leads/bulk-promote", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "Failed to promote leads");
        return;
      }
      trackEvent("bulk_promote_triggered", { count: pagination.total });
      void fetchLeads();
    } finally {
      setBulkPromoteLoading(false);
    }
  };

  const handleCreate = async (form: LeadFormData) => {
    if (createLoading) return;
    setCreateLoading(true);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/intake-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          source: form.source,
          title: form.title,
          company: form.company || null,
          contactName: form.contactName || null,
          contactEmail: form.contactEmail || null,
          link: form.link || null,
          summary: form.summary,
          budgetMin: form.budgetMin ? parseInt(form.budgetMin, 10) : null,
          budgetMax: form.budgetMax ? parseInt(form.budgetMax, 10) : null,
          urgency: form.urgency,
          tags,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "Failed to create lead");
        return;
      }
      setModalOpen(false);
      void fetchLeads();
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead Intake</h1>
          <p className="text-sm text-neutral-400 mt-1">Capture and score opportunities manually.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Lead
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setQuickFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              quickFilter === f.key
                ? "bg-amber-600/30 text-amber-400 border border-amber-700"
                : "bg-neutral-800/50 text-neutral-400 border border-neutral-700 hover:bg-neutral-700/50"
            }`}
          >
            {f.label}
          </button>
        ))}
        {quickFilter === "needs-score" && pagination.total > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkScore}
            disabled={bulkScoreLoading}
            className="border-emerald-700 text-emerald-400 hover:bg-emerald-900/30"
          >
            <Target className="h-4 w-4" />
            {bulkScoreLoading ? "Scoring…" : `Score all (${pagination.total})`}
          </Button>
        )}
        {quickFilter === "ready" && pagination.total > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkPromote}
            disabled={bulkPromoteLoading}
            className="border-emerald-700 text-emerald-400 hover:bg-emerald-900/30"
          >
            <Rocket className="h-4 w-4" />
            {bulkPromoteLoading ? "Promoting…" : `Promote all (${pagination.total})`}
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            placeholder="Search title, company, summary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-neutral-900 border-neutral-700"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setQuickFilter("all");
            }}
            className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Status: All" : s}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Source: All" : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && leads.length === 0}
        emptyMessage='No leads found. Create one with "New Lead".'
        onRetry={fetchLeads}
      >
        <div className="border border-neutral-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-700 bg-neutral-900/50">
                  <th className="text-left p-3 font-medium text-neutral-400">Created</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Source</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Title</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Company</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Score</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Status</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Pipeline</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors"
                  >
                    <td className="p-3 text-neutral-400">{formatDateSafe(lead.createdAt)}</td>
                    <td className="p-3">
                      <LeadSourceBadge source={lead.source} />
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/dashboard/intake/${lead.id}`}
                        className="font-medium text-neutral-100 hover:text-white hover:underline"
                      >
                        {lead.title || "—"}
                      </Link>
                    </td>
                    <td className="p-3 text-neutral-300">{lead.company ?? "—"}</td>
                    <td className="p-3">
                      <LeadScoreBadge score={lead.score} />
                    </td>
                    <td className="p-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="p-3">
                      {lead.promotedLeadId ? (
                        <span className="text-xs text-emerald-400">Promoted</span>
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="p-3 text-neutral-400 max-w-[150px] truncate">
                      {lead.nextAction ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {pagination.totalPages > 1 || pagination.total > pagination.pageSize ? (
          <div className="mt-3 px-3 pb-3">
            <PaginationControls
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              totalPages={pagination.totalPages}
              hasNext={pagination.hasNext}
              hasPrev={pagination.hasPrev}
              onPageChange={url.setPage}
              onPageSizeChange={url.setPageSize}
              isLoading={loading}
            />
          </div>
        ) : null}
      </AsyncState>

      <LeadFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        loading={createLoading}
      />
    </div>
  );
}
