"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Github, Video, FileText, CheckCircle2, XCircle } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { AsyncState } from "@/components/ui/AsyncState";
import { formatDateSafe } from "@/lib/ui/date-safe";

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
  const url = useUrlQueryState();
  const [search, setSearch] = useState(() => url.getString("search"));
  const debouncedSearch = useDebouncedValue(search, 300);
  const [list, setList] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusFilter = url.getString("status", "all");
  const triggerFilter = url.getString("triggerType", "all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const fetchList = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (triggerFilter !== "all") params.set("triggerType", triggerFilter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const res = await fetch(`/api/proof-candidates?${params}`, { credentials: "include", signal: controller.signal, cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      setList(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setList([]);
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [statusFilter, triggerFilter, debouncedSearch]);

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

  useEffect(() => {
    void fetchList();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchList]);

  const runAction = async (candidateId: string, fn: () => Promise<Response>) => {
    setActionLoading(candidateId);
    try {
      const res = await fn();
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : `Action failed (${res.status})`);
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
          onChange={(e) => url.setFilter("status", e.target.value)}
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
          onChange={(e) => url.setFilter("triggerType", e.target.value)}
          className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
        >
          <option value="all">Trigger: All</option>
          <option value="github">GitHub</option>
          <option value="loom">Loom</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && list.length === 0}
        emptyMessage="No proof candidates. Create one from an intake lead."
        onRetry={fetchList}
      >
        {list.length > 0 ? (
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
                      <td className="p-3 text-neutral-400">{formatDateSafe(c.updatedAt, { month: "short", day: "numeric" })}</td>
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
        ) : null}
      </AsyncState>
    </div>
  );
}
