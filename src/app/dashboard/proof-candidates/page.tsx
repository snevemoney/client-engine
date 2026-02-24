"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Github, Video, FileText, CheckCircle2, XCircle } from "lucide-react";

type Candidate = {
  id: string;
  title: string;
  company: string | null;
  triggerType: string;
  sourceType: string;
  status: string;
  githubUrl: string | null;
  loomUrl: string | null;
  updatedAt: string;
  promotedProofRecordId?: string | null;
  readiness?: { isReady: boolean; reasons: string[] };
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  const v = status?.toLowerCase() ?? "draft";
  const map: Record<string, "default" | "success" | "warning" | "destructive"> = {
    draft: "default",
    ready: "warning",
    promoted: "success",
    rejected: "destructive",
  };
  return <Badge variant={map[v] ?? "default"}>{v}</Badge>;
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const t = trigger?.toLowerCase() ?? "manual";
  const icons: Record<string, React.ReactNode> = {
    github: <Github className="h-3 w-3" />,
    loom: <Video className="h-3 w-3" />,
    manual: <FileText className="h-3 w-3" />,
    result_note: <FileText className="h-3 w-3" />,
  };
  return (
    <Badge variant="outline" className="gap-1">
      {icons[t] ?? null}
      {t}
    </Badge>
  );
}

export default function ProofCandidatesPage() {
  const searchParams = useSearchParams();
  const [list, setList] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (triggerFilter !== "all") params.set("triggerType", triggerFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/proof-candidates?${params}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => []);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, triggerFilter, search]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const runAction = async (candidateId: string, fn: () => Promise<Response>) => {
    setActionLoading(candidateId);
    try {
      const res = await fn();
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : `Action failed (${res.status})`);
        return;
      }
      void fetchList();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proof Candidates</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Review delivery evidence, mark ready, and promote to proof records.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm w-48"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
        >
          <option value="all">Status: All</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="promoted">Promoted</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={triggerFilter}
          onChange={(e) => setTriggerFilter(e.target.value)}
          className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
        >
          <option value="all">Trigger: All</option>
          <option value="github">GitHub</option>
          <option value="loom">Loom</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      ) : list.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 border border-dashed border-neutral-700 rounded-lg">
          No proof candidates. Create one from an intake lead.
        </div>
      ) : (
        <div className="border border-neutral-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-700 bg-neutral-900/50">
                  <th className="text-left p-3 font-medium text-neutral-400">Title</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Company</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Trigger</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Evidence</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Readiness</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Status</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Updated</th>
                  <th className="text-left p-3 font-medium text-neutral-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const loading = actionLoading === c.id;
                  return (
                    <tr key={c.id} className="border-b border-neutral-800 hover:bg-neutral-800/30">
                      <td className="p-3">
                        <Link
                          href={`/dashboard/proof-candidates/${c.id}`}
                          className="font-medium text-neutral-100 hover:text-white hover:underline"
                        >
                          {c.title || "—"}
                        </Link>
                      </td>
                      <td className="p-3 text-neutral-300">{c.company ?? "—"}</td>
                      <td className="p-3">
                        <TriggerBadge trigger={c.triggerType} />
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {c.githubUrl && (
                            <a href={c.githubUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline" title="GitHub">
                              <Github className="h-4 w-4" />
                            </a>
                          )}
                          {c.loomUrl && (
                            <a href={c.loomUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline" title="Loom">
                              <Video className="h-4 w-4" />
                            </a>
                          )}
                          {!c.githubUrl && !c.loomUrl && <span className="text-neutral-500">—</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        {c.readiness?.isReady ? (
                          <Badge variant="success" className="text-xs">Ready</Badge>
                        ) : (
                          <span className="text-xs text-amber-400">Needs info</span>
                        )}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="p-3 text-neutral-400">{formatDate(c.updatedAt)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          <Link href={`/dashboard/proof-candidates/${c.id}`}>
                            <Button variant="ghost" size="sm">Edit</Button>
                          </Link>
                          {c.status !== "promoted" && c.status !== "rejected" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={loading}
                                onClick={() =>
                                  runAction(c.id, () =>
                                    fetch(`/api/proof-candidates/${c.id}/mark-ready`, { method: "POST", credentials: "include" })
                                  )
                                }
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={loading}
                                onClick={() =>
                                  runAction(c.id, () =>
                                    fetch(`/api/proof-candidates/${c.id}/promote`, { method: "POST", credentials: "include" })
                                  )
                                }
                              >
                                Promote
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400"
                                disabled={loading}
                                onClick={() =>
                                  runAction(c.id, () =>
                                    fetch(`/api/proof-candidates/${c.id}/reject`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      credentials: "include",
                                      body: JSON.stringify({}),
                                    })
                                  )
                                }
                              >
                                <XCircle className="h-3 w-3 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                          {c.status === "promoted" && c.promotedProofRecordId && (
                            <Link href="/dashboard/proof">
                              <Button variant="ghost" size="sm">View Proof</Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
