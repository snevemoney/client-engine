"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadStatusBadge } from "@/components/intake/LeadStatusBadge";
import { LeadSourceBadge } from "@/components/intake/LeadSourceBadge";
import { LeadScoreBadge } from "@/components/intake/LeadScoreBadge";
import { LeadFormModal } from "@/components/intake/LeadFormModal";
import type { LeadFormData } from "@/components/intake/LeadFormModal";

interface IntakeLead {
  id: string;
  source: string;
  title: string;
  company: string | null;
  status: string;
  score: number | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = ["all", "new", "qualified", "proposal_drafted", "sent", "won", "lost", "archived"];
const SOURCE_OPTIONS = ["all", "upwork", "linkedin", "referral", "inbound", "rss", "other"];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function IntakePage() {
  const [leads, setLeads] = useState<IntakeLead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      const res = await fetch(`/api/intake-leads?${params}`, {
        credentials: "include",
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `Failed to load leads (${res.status})`);
        setLeads([]);
        return;
      }
      setLeads(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sourceFilter]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const handleCreate = async (form: LeadFormData) => {
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
            onChange={(e) => setStatusFilter(e.target.value)}
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

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {loading ? (
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 border border-dashed border-neutral-700 rounded-lg">
          No leads found. Create one with &quot;New Lead&quot;.
        </div>
      ) : (
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
                  <th className="text-left p-3 font-medium text-neutral-400">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors"
                  >
                    <td className="p-3 text-neutral-400">{formatDate(lead.createdAt)}</td>
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
                    <td className="p-3 text-neutral-400 max-w-[150px] truncate">
                      {lead.nextAction ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LeadFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        loading={createLoading}
      />
    </div>
  );
}
