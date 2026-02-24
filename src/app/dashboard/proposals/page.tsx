"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Search } from "lucide-react";

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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

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
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (sourceFilter !== "all") params.set("source", sourceFilter);
        const res = await fetch(`/api/proposals?${params}`, { cache: "no-store" });
        const data = await res.json().catch(() => []);
        setProposals(Array.isArray(data) ? data : []);
      } catch {
        setProposals([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [search, statusFilter, sourceFilter]);

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
          onChange={(e) => setStatusFilter(e.target.value)}
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
          onChange={(e) => setSourceFilter(e.target.value)}
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

      {loading ? (
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      ) : proposals.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 rounded-lg border border-neutral-800">
          No proposals yet. Create one manually or from an intake lead.
        </div>
      ) : (
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
                  <td className="p-3 text-neutral-400">{formatDate(p.updatedAt)}</td>
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
      )}
    </div>
  );
}
