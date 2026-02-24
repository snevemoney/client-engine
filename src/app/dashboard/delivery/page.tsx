"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Search } from "lucide-react";

type DeliveryProject = {
  id: string;
  status: string;
  title: string;
  clientName: string | null;
  company: string | null;
  dueDate: string | null;
  health: string;
  proofCandidateId: string | null;
  createdAt: string;
};

type Summary = {
  inProgress: number;
  dueSoon: number;
  overdue: number;
  completedThisWeek: number;
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

function HealthBadge({ health }: { health: string }) {
  const v = health ?? "on_track";
  const map: Record<string, { label: string; className: string }> = {
    on_track: { label: "On track", className: "bg-emerald-500/20 text-emerald-400" },
    due_soon: { label: "Due soon", className: "bg-amber-500/20 text-amber-400" },
    overdue: { label: "Overdue", className: "bg-red-500/20 text-red-400" },
    blocked: { label: "Blocked", className: "bg-neutral-500/20 text-neutral-400" },
  };
  const { label, className } = map[v] ?? map.on_track;
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const v = (status ?? "").replace(/_/g, " ");
  return <Badge variant="outline" className="capitalize">{v}</Badge>;
}

export default function DeliveryPage() {
  const searchParams = useSearchParams();
  const dueParam = searchParams.get("due");
  const [projects, setProjects] = useState<DeliveryProject[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (dueParam === "soon" || dueParam === "overdue") params.set("due", dueParam);
        const [listRes, summaryRes] = await Promise.all([
          fetch(`/api/delivery-projects?${params}`, { cache: "no-store" }),
          fetch("/api/delivery-projects/summary", { cache: "no-store" }),
        ]);
        const list = await listRes.json().catch(() => []);
        const sum = await summaryRes.json().catch(() => null);
        setProjects(Array.isArray(list) ? list : []);
        setSummary(sum && typeof sum === "object" ? sum : null);
      } catch {
        setProjects([]);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [search, statusFilter, dueParam]);

  const s = summary ?? { inProgress: 0, dueSoon: 0, overdue: 0, completedThisWeek: 0 };

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Delivery</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Track projects from kickoff to completion. Request proof after delivery.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <p className="text-xs text-neutral-500 uppercase">In progress</p>
          <p className="text-xl font-semibold">{s.inProgress}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <p className="text-xs text-neutral-500 uppercase">Due soon</p>
          <p className="text-xl font-semibold text-amber-400">{s.dueSoon}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <p className="text-xs text-neutral-500 uppercase">Overdue</p>
          <p className="text-xl font-semibold text-red-400">{s.overdue}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <p className="text-xs text-neutral-500 uppercase">Completed this week</p>
          <p className="text-xl font-semibold text-emerald-400">{s.completedThisWeek}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search projects..."
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
          <option value="not_started">Not started</option>
          <option value="kickoff">Kickoff</option>
          <option value="in_progress">In progress</option>
          <option value="qa">QA</option>
          <option value="blocked">Blocked</option>
          <option value="completed">Completed</option>
        </select>
        <Link href="/dashboard/delivery/new">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" />
            New project
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 rounded-lg border border-neutral-800">
          No delivery projects yet. Create one from an accepted proposal or manually.
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left p-3 font-medium">Project</th>
                <th className="text-left p-3 font-medium">Client / Company</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Health</th>
                <th className="text-left p-3 font-medium">Due</th>
                <th className="text-left p-3 font-medium">Proof</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                  <td className="p-3">
                    <Link href={`/dashboard/delivery/${p.id}`} className="text-emerald-400 hover:underline">
                      {p.title ?? "—"}
                    </Link>
                  </td>
                  <td className="p-3 text-neutral-400">
                    {p.clientName ?? p.company ?? "—"}
                  </td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3"><HealthBadge health={p.health} /></td>
                  <td className="p-3 text-neutral-400">{formatDate(p.dueDate)}</td>
                  <td className="p-3">
                    {p.proofCandidateId ? (
                      <span className="text-emerald-400 text-xs">Linked</span>
                    ) : (
                      <span className="text-neutral-500 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/dashboard/delivery/${p.id}`}>
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
