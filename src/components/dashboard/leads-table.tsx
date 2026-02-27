"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2, Filter, X, Zap } from "lucide-react";

interface Lead {
  id: string;
  title: string;
  source: string;
  status: string;
  budget: string | null;
  score: number | null;
  createdAt: string;
  tags: string[];
  _count?: { artifacts: number };
}

const STATUS_OPTIONS = ["ALL", "NEW", "ENRICHED", "SCORED", "APPROVED", "REJECTED", "BUILDING", "SHIPPED"];
const SOURCE_OPTIONS = ["ALL", "manual", "upwork", "capture", "email", "facebook", "rss"];

const statusColors: Record<string, "default" | "success" | "warning" | "destructive"> = {
  NEW: "default", ENRICHED: "default", SCORED: "warning",
  APPROVED: "success", REJECTED: "destructive", BUILDING: "warning", SHIPPED: "success",
};

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (sourceFilter !== "ALL") params.set("source", sourceFilter);
      const res = await fetch(`/api/leads?${params}`, {
        credentials: "include",
        signal: controller.signal,
        cache: "no-store",
      });
      if (timeout) clearTimeout(timeout);
      timeout = null;
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `Failed to load leads (${res.status})`);
        setLeads([]);
        return;
      }
      setLeads(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e instanceof Error && e.name === "AbortError"
        ? "Request timed out. Check your connection and retry."
        : e instanceof Error ? e.message : "Failed to load leads";
      setError(msg);
      setLeads([]);
    } finally {
      if (timeout) clearTimeout(timeout);
      setLoading(false);
    }
  }, [search, statusFilter, sourceFilter]);

  useEffect(() => {
    // Intentional: fetch on mount/filter change; setState happens in async callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch pattern
    void fetchLeads();
  }, [fetchLeads]);

  async function runBulkPipeline() {
    if (pipelineRunning) return;
    setPipelineRunning(true);
    try {
      const res = await fetch("/api/leads/bulk-pipeline-run", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "Failed to run pipeline");
        return;
      }
      if ((data?.ran ?? 0) > 0) void fetchLeads();
    } finally {
      setPipelineRunning(false);
    }
  }

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  const activeFilters = (statusFilter !== "ALL" ? 1 : 0) + (sourceFilter !== "ALL" ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchLeads()}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="relative">
          <Filter className="w-3.5 h-3.5" /> Filters
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white text-neutral-900 text-[10px] rounded-full flex items-center justify-center font-bold">
              {activeFilters}
            </span>
          )}
        </Button>
        {(() => {
          const needsPipeline = leads.filter((l) => l.status === "NEW" || l.status === "ENRICHED").length;
          return needsPipeline > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={runBulkPipeline}
              disabled={pipelineRunning}
              className="border-amber-700 text-amber-400 hover:bg-amber-900/30"
            >
              <Zap className="w-3.5 h-3.5" />
              {pipelineRunning ? "Running…" : `Run pipeline (${needsPipeline})`}
            </Button>
          ) : null;
        })()}
        <Link href="/dashboard/leads/new">
          <Button size="sm"><Plus className="w-4 h-4" /> Add Lead</Button>
        </Link>
      </div>

      {/* Filters row */}
      {showFilters && (
        <div className="flex items-center gap-4 p-3 border border-neutral-800 rounded-lg bg-neutral-900/30 flex-wrap">
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Status</span>
            <div className="flex gap-1 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${statusFilter === s ? "bg-neutral-700 border-neutral-600 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-700"}`}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Source</span>
            <div className="flex gap-1 flex-wrap">
              {SOURCE_OPTIONS.map((s) => (
                <button key={s} onClick={() => setSourceFilter(s)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${sourceFilter === s ? "bg-neutral-700 border-neutral-600 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-700"}`}
                >{s}</button>
              ))}
            </div>
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-neutral-400" onClick={() => { setStatusFilter("ALL"); setSourceFilter("ALL"); }}>
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>
      )}

      {/* Stats bar */}
      {(() => {
        const newCount = leads.filter((l) => l.status === "NEW").length;
        const approvedCount = leads.filter((l) => l.status === "APPROVED").length;
        return (
          <div className="flex gap-4 text-xs text-neutral-500">
            <span>{leads.length} lead{leads.length !== 1 ? "s" : ""}</span>
            {newCount > 0 && <span>{newCount} new</span>}
            {approvedCount > 0 && <span className="text-emerald-500">{approvedCount} approved</span>}
          </div>
        );
      })()}

      {/* Table */}
      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/50">
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Title</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 hidden sm:table-cell">Source</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 hidden md:table-cell">Score</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 hidden lg:table-cell">Budget</th>
              <th className="text-right px-4 py-3 font-medium text-neutral-400 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-neutral-800/50 animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-48 rounded bg-muted" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 w-16 rounded bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-20 rounded bg-muted" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-8 rounded bg-muted" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-16 rounded bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-muted ml-auto" /></td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <p className="text-amber-400">{error}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchLeads()}>Retry</Button>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No leads found.</td></tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/leads/${lead.id}`} className="text-neutral-100 hover:underline font-medium block truncate max-w-[300px]">
                      {lead.title}
                    </Link>
                    {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {lead.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] py-0">{tag}</Badge>
                        ))}
                        {lead.tags.length > 3 && <span className="text-[10px] text-neutral-500">+{lead.tags.length - 3}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-400 hidden sm:table-cell">{lead.source}</td>
                  <td className="px-4 py-3"><Badge variant={statusColors[lead.status] || "default"}>{lead.status}</Badge></td>
                  <td className="px-4 py-3 text-neutral-400 hidden md:table-cell">
                    {lead.score != null ? (
                      <span className={lead.score >= 70 ? "text-emerald-400" : lead.score >= 40 ? "text-amber-400" : "text-neutral-500"}>
                        {lead.score}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-400 hidden lg:table-cell">{lead.budget || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteLead(lead.id)} className="text-neutral-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
