"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2 } from "lucide-react";

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

const statusColors: Record<string, "default" | "success" | "warning" | "destructive"> = {
  NEW: "default",
  ENRICHED: "default",
  SCORED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  BUILDING: "warning",
  SHIPPED: "success",
};

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchLeads() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchLeads();
  }, []);

  async function deleteLead(id: string) {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchLeads();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">Search</Button>
        </form>
        <Link href="/dashboard/leads/new">
          <Button size="sm"><Plus className="w-4 h-4" /> Add Lead</Button>
        </Link>
      </div>

      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/50">
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Title</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Source</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Score</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Budget</th>
              <th className="text-right px-4 py-3 font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Loading...</td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No leads yet. Add your first lead to get started.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/leads/${lead.id}`} className="text-neutral-100 hover:underline font-medium">
                      {lead.title}
                    </Link>
                    {lead.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {lead.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] py-0">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{lead.source}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusColors[lead.status] || "default"}>{lead.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{lead.score ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-400">{lead.budget || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteLead(lead.id)}
                      className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
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
