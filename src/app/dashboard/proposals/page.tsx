"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { AsyncState } from "@/components/ui/AsyncState";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { formatDateSafe } from "@/lib/ui/date-safe";
import { normalizePagination } from "@/lib/ui/pagination-safe";

type Proposal = {
  id: string;
  status: string;
  title: string;
  clientName: string | null;
  company: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;
  intakeLead: { id: string; title: string; status: string } | null;
  pipelineLead: { id: string; title: string; status: string } | null;
  updatedAt: string;
};

function formatPrice(p: Proposal): string {
  if (p.priceMin != null && p.priceMax != null && p.priceMin !== p.priceMax) {
    return `${p.priceCurrency} ${p.priceMin.toLocaleString()} – ${p.priceMax.toLocaleString()}`;
  }
  if (p.priceMin != null) return `${p.priceCurrency} ${p.priceMin.toLocaleString()}`;
  if (p.priceMax != null) return `${p.priceCurrency} ${p.priceMax.toLocaleString()}`;
  return "—";
}

function StatusBadge({ status }: { status: string }) {
  const v = (status ?? "").replace(/_/g, " ");
  return <Badge variant="outline" className="capitalize">{v}</Badge>;
}

export default function ProposalsPage() {
  const url = useUrlQueryState();
  const [search, setSearch] = useState(() => url.getString("search"));
  const debouncedSearch = useDebouncedValue(search, 300);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [pagination, setPagination] = useState(() => normalizePagination(null, 0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

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

  const load = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/proposals?${params}`, {
        credentials: "include",
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `Failed to load (${res.status})`);
        setProposals([]);
        setPagination(normalizePagination(null, 0));
        return;
      }
      setProposals(Array.isArray(data?.items) ? data.items : []);
      setPagination(normalizePagination(data?.pagination, data?.items?.length ?? 0));
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setProposals([]);
      setPagination(normalizePagination(null, 0));
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [debouncedSearch, statusFilter, sourceFilter, page, pageSize]);

  useEffect(() => {
    void load();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [load]);

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proposals</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Create and track proposals. Mark ready, send, accept, or reject.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search proposals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => url.setFilter("status", e.target.value)}
          className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="sent">Sent</option>
          <option value="viewed">Viewed</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => url.setFilter("source", e.target.value)}
          className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
        >
          <option value="all">All sources</option>
          <option value="intake">From intake</option>
          <option value="pipeline">From pipeline</option>
        </select>
        <Link href="/dashboard/proposals/new">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" />
            New Proposal
          </Button>
        </Link>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && proposals.length === 0}
        emptyMessage="No proposals yet. Create one manually or from an intake lead."
        onRetry={load}
      >
        {proposals.length > 0 ? (
        <div className="rounded-lg border border-neutral-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Client / Company</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Price</th>
                <th className="text-left p-3 font-medium">Source</th>
                <th className="text-left p-3 font-medium">Updated</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                  <td className="p-3">
                    <Link href={`/dashboard/proposals/${p.id}`} className="text-emerald-400 hover:underline">
                      {p.title ?? "—"}
                    </Link>
                  </td>
                  <td className="p-3 text-neutral-400">{p.clientName ?? p.company ?? "—"}</td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3 text-neutral-400">{formatPrice(p)}</td>
                  <td className="p-3 text-neutral-500 text-xs">
                    {p.intakeLead ? "Intake" : p.pipelineLead ? "Pipeline" : "—"}
                  </td>
                  <td className="p-3 text-neutral-400">{formatDateSafe(p.updatedAt, { month: "short", day: "numeric" })}</td>
                  <td className="p-3 text-right">
                    <Link href={`/dashboard/proposals/${p.id}`}>
                      <Button variant="ghost" size="sm">Open</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : null}
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
    </div>
  );
}
