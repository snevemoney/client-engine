"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, Check, X, ExternalLink, ChevronDown, ChevronRight, HelpCircle, MoreHorizontal, BookOpen } from "lucide-react";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { AsyncState } from "@/components/ui/AsyncState";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { formatDateSafe } from "@/lib/ui/date-safe";
import { normalizePagination } from "@/lib/ui/pagination-safe";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type NextActionTemplate = {
  ruleKey: string;
  title: string;
  outcome: string;
  why: string;
  checklist: Array<{ id: string; text: string; optional?: boolean }>;
  links?: Array<{ label: string; href: string }>;
  suggestedActions?: Array<{ actionKey: string; label: string; confirm?: { title: string; body: string } }>;
};

type NextAction = {
  id: string;
  title: string;
  reason: string | null;
  priority: string;
  score: number;
  status: string;
  sourceType: string;
  sourceId: string | null;
  actionUrl: string | null;
  createdByRule?: string;
  explanationJson?: { ruleKey?: string; summary?: string; evidence?: Array<{ label: string; value: string | number; source: string }>; recommendedSteps?: string[]; links?: Array<{ label: string; href: string }> } | null;
  createdAt: string;
};

type Preference = {
  id: string;
  ruleKey: string | null;
  dedupeKey: string | null;
  suppressedUntil: string | null;
  reason: string | null;
  createdAt: string;
};

type NBASummary = {
  top5: Array<{ id: string; title: string; reason: string | null; priority: string; score: number; actionUrl: string | null; sourceType: string }>;
  queuedByPriority: { low: number; medium: number; high: number; critical: number };
  lastRunAt: string | null;
};

function priorityColor(p: string): string {
  if (p === "critical") return "bg-red-500/20 text-red-400";
  if (p === "high") return "bg-amber-500/20 text-amber-400";
  if (p === "medium") return "bg-neutral-500/20 text-neutral-300";
  return "bg-neutral-600/20 text-neutral-500";
}

export default function NextActionsPage() {
  const url = useUrlQueryState();
  const [items, setItems] = useState<NextAction[]>([]);
  const [pagination, setPagination] = useState(() => normalizePagination(null, 0));
  const [summary, setSummary] = useState<NBASummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [expandedWhyId, setExpandedWhyId] = useState<string | null>(null);
  const [expandedPlaybookId, setExpandedPlaybookId] = useState<string | null>(null);
  const [templateCache, setTemplateCache] = useState<Record<string, NextActionTemplate | null>>({});
  const [templateLoadingId, setTemplateLoadingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const statusFilter = url.getString("status", "");
  const priorityFilter = url.getString("priority", "");
  const scopeFilter = url.getString("scope", "command_center");
  const entityType = scopeFilter === "review_stream" ? "review_stream" : "command_center";
  const entityId = entityType;
  const searchRaw = url.getString("search", "");
  const searchDebounced = useDebouncedValue(searchRaw, 300);
  const page = url.getPage();
  const pageSize = url.getPageSize();

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("entityType", entityType);
    params.set("entityId", entityId);
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (searchDebounced) params.set("search", searchDebounced);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    try {
      const [data, sum, prefs] = await Promise.all([
        fetch(`/api/next-actions?${params}`, { credentials: "include", signal: controller.signal, cache: "no-store" }).then(
          (r) => (r.ok ? r.json() : null)
        ),
        fetch(`/api/next-actions/summary?entityType=${entityType}&entityId=${entityId}`, { credentials: "include", signal: controller.signal, cache: "no-store" }).then(
          (r) => (r.ok ? r.json() : null)
        ),
        fetch(`/api/next-actions/preferences?entityType=${entityType}&entityId=${entityId}`, { credentials: "include", signal: controller.signal, cache: "no-store" }).then(
          (r) => (r.ok ? r.json() : { items: [] })
        ),
      ]);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      const list = data?.items ?? [];
      setItems(Array.isArray(list) ? list : []);
      setPagination(normalizePagination(data?.pagination, list?.length ?? 0));
      setSummary(sum ?? null);
      setPreferences(prefs?.items ?? []);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
      setPagination(normalizePagination(null, 0));
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [entityType, entityId, statusFilter, priorityFilter, searchDebounced, page, pageSize]);

  useEffect(() => {
    void fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  const handleRun = async () => {
    setRunLoading(true);
    try {
      const res = await fetch(`/api/next-actions/run?entityType=${entityType}&entityId=${entityId}`, { method: "POST" });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        toast.error(d?.error ?? "Run failed");
      }
    } finally {
      setRunLoading(false);
    }
  };

  const fetchedTemplateIdsRef = useRef<Set<string>>(new Set());
  const fetchTemplate = useCallback(async (id: string) => {
    if (fetchedTemplateIdsRef.current.has(id)) return;
    fetchedTemplateIdsRef.current.add(id);
    setTemplateLoadingId(id);
    try {
      const res = await fetch(`/api/next-actions/${id}/template`, { credentials: "include", cache: "no-store" });
      const data = res.ok ? await res.json() : null;
      setTemplateCache((prev) => ({ ...prev, [id]: data?.template ?? null }));
    } catch {
      setTemplateCache((prev) => ({ ...prev, [id]: null }));
    } finally {
      setTemplateLoadingId((prev) => (prev === id ? null : prev));
    }
  }, []);

  const handlePlaybookToggle = useCallback((id: string) => {
    const next = expandedPlaybookId === id ? null : id;
    setExpandedPlaybookId(next);
    if (next && !fetchedTemplateIdsRef.current.has(id)) void fetchTemplate(next);
  }, [expandedPlaybookId, fetchTemplate]);

  const handleExecute = async (id: string, actionKey: string) => {
    if (actioningId) return;
    setMenuOpenId(null);
    setActioningId(id);
    try {
      const res = await fetch(`/api/next-actions/${id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionKey }),
      });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        toast.error(d?.error ?? "Action failed");
      }
    } finally {
      setActioningId(null);
    }
  };

  const handleReEnable = async (prefId: string) => {
    try {
      const res = await fetch(`/api/next-actions/preferences/${prefId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "suppressed" }),
      });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        toast.error(d?.error ?? "Re-enable failed");
      }
    } catch {
      toast.error("Re-enable failed");
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Next Best Actions</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Ranked recommendations. Run to refresh from current app state.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRun} disabled={runLoading}>
          <Play className="w-4 h-4 mr-1" />
          {runLoading ? "Running…" : "Run Next Actions"}
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Critical</p>
            <p className="text-xl font-semibold text-red-400">{summary.queuedByPriority.critical ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">High</p>
            <p className="text-xl font-semibold text-amber-400">{summary.queuedByPriority.high ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Medium</p>
            <p className="text-xl font-semibold">{summary.queuedByPriority.medium ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Queued</p>
            <p className="text-xl font-semibold">
              {(summary.queuedByPriority.low ?? 0) + (summary.queuedByPriority.medium ?? 0) + (summary.queuedByPriority.high ?? 0) + (summary.queuedByPriority.critical ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Last run</p>
            <p className="text-sm text-neutral-400 truncate">
              {summary.lastRunAt ? formatDateSafe(summary.lastRunAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500">Scope:</span>
          <select
            value={scopeFilter}
            onChange={(e) => url.setFilter("scope", e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
            data-testid="nba-scope-select"
          >
            <option value="command_center">Command Center</option>
            <option value="review_stream">Review Stream</option>
          </select>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => url.setFilter("status", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="done">Done</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => url.setFilter("priority", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          type="search"
          placeholder="Search…"
          value={searchRaw}
          onChange={(e) => url.setFilter("search", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm w-40"
        />
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {preferences.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="nba-preferences-section">
          <h3 className="text-sm font-medium text-neutral-300 mb-2">Suppressed (Don&apos;t suggest again)</h3>
          <ul className="space-y-2">
            {preferences.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-400 truncate">
                  {p.ruleKey ?? p.dedupeKey ?? "—"}
                  {p.suppressedUntil && (
                    <span className="text-neutral-500 ml-1">
                      until {formatDateSafe(p.suppressedUntil, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleReEnable(p.id)} data-testid="nba-pref-reenable">
                  Re-enable
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyMessage="No next actions"
        onRetry={fetchData}
      >
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
          {items.length > 0 ? (
            <div className="divide-y divide-neutral-800">
              {items.map((a) => {
                const expl = a.explanationJson;
                const isExpanded = expandedWhyId === a.id;
                const isPlaybookExpanded = expandedPlaybookId === a.id;
                const template = templateCache[a.id];
                const templateLoading = templateLoadingId === a.id;
                return (
                  <div key={a.id} className="p-4 hover:bg-neutral-800/30">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className={priorityColor(a.priority)}>{a.priority}</Badge>
                      <span className="text-xs text-neutral-500 w-8">{a.score}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{a.title}</p>
                        {a.reason && <p className="text-xs text-neutral-500 truncate">{a.reason}</p>}
                        <div className="flex gap-3 mt-1 text-xs text-neutral-400">
                          <span>{a.sourceType}</span>
                          <span>{a.status}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePlaybookToggle(a.id)}
                          className="text-neutral-400"
                          title="Open playbook"
                          data-testid="next-action-playbook-toggle"
                        >
                          <BookOpen className="w-4 h-4" />
                        </Button>
                        {expl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedWhyId(isExpanded ? null : a.id)}
                            className="text-neutral-400"
                            data-testid="next-action-why-toggle"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            <HelpCircle className="w-3.5 h-3.5 ml-0.5" />
                          </Button>
                        )}
                        {a.actionUrl && (
                          <Link href={a.actionUrl}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        {a.status === "queued" && (
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="sm" onClick={() => handleExecute(a.id, "mark_done")} disabled={!!actioningId} className="text-emerald-400" title="Mark done" data-testid="next-action-mark-done">
                              <Check className="w-4 h-4" />
                            </Button>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMenuOpenId(menuOpenId === a.id ? null : a.id)}
                                disabled={!!actioningId}
                                className="text-neutral-400"
                                data-testid="next-action-menu"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                              {menuOpenId === a.id && (
                                <div className="absolute right-0 top-full mt-0.5 z-10 rounded-md border border-neutral-700 bg-neutral-900 py-1 shadow-lg min-w-[160px]">
                                  <button
                                    className="block w-full px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-800"
                                    onClick={() => handleExecute(a.id, "snooze_1d")}
                                  >
                                    Snooze 1 day
                                  </button>
                                  <button
                                    className="block w-full px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-800"
                                    onClick={() => handleExecute(a.id, "dismiss")}
                                    data-testid="next-action-dismiss"
                                  >
                                    Dismiss
                                  </button>
                                  <button
                                    className="block w-full px-3 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800"
                                    onClick={() => handleExecute(a.id, "don_t_suggest_again_30d")}
                                  >
                                    Don&apos;t suggest again (30d)
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {isPlaybookExpanded && (
                      <div className="mt-3 pl-4 border-l-2 border-amber-500/30 space-y-3 text-sm" data-testid="next-action-playbook-panel">
                        {templateLoading ? (
                          <p className="text-neutral-500">Loading playbook…</p>
                        ) : !template ? (
                          <p className="text-neutral-500">No playbook for this action.</p>
                        ) : (
                          <>
                        <h4 className="font-medium text-amber-400/90">{template.title}</h4>
                        <p className="text-neutral-400">{template.why}</p>
                        <div>
                          <p className="text-xs text-neutral-500 uppercase mb-1">What good looks like</p>
                          <p className="text-neutral-300">{template.outcome}</p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500 uppercase mb-1">Checklist</p>
                          <ol className="list-decimal list-inside text-neutral-400 space-y-0.5">
                            {template.checklist.map((c) => (
                              <li key={c.id}>{c.text}{c.optional ? " (optional)" : ""}</li>
                            ))}
                          </ol>
                        </div>
                        {template.links && template.links.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {template.links.map((l, i) => (
                              <Link key={i} href={l.href} className="text-xs text-amber-400 hover:underline">
                                {l.label} →
                              </Link>
                            ))}
                          </div>
                        )}
                        {template.suggestedActions && template.suggestedActions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {template.suggestedActions.map((sa, i) => (
                              <Button
                                key={i}
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (sa.confirm && !window.confirm(`${sa.confirm.title}\n\n${sa.confirm.body}`)) return;
                                  handleExecute(a.id, sa.actionKey);
                                  setExpandedPlaybookId(null);
                                }}
                                disabled={!!actioningId || a.status !== "queued"}
                              >
                                {sa.label}
                              </Button>
                            ))}
                          </div>
                        )}
                          </>
                        )}
                      </div>
                    )}
                    {isExpanded && expl && (
                      <div className="mt-3 pl-4 border-l-2 border-neutral-700 space-y-2 text-sm" data-testid="next-action-why-panel">
                        {expl.summary && <p className="text-neutral-300">{expl.summary}</p>}
                        {Array.isArray(expl.evidence) && expl.evidence.length > 0 && (
                          <ul className="text-neutral-400 space-y-0.5">
                            {expl.evidence.map((e: { label: string; value: string | number; source: string }, i: number) => (
                              <li key={i}>
                                <span className="text-neutral-500">{e.label}:</span> {String(e.value)} <span className="text-neutral-600">({e.source})</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {Array.isArray(expl.recommendedSteps) && expl.recommendedSteps.length > 0 && (
                          <div>
                            <p className="text-neutral-500 text-xs uppercase mb-1">Steps</p>
                            <ol className="list-decimal list-inside text-neutral-400 space-y-0.5">
                              {expl.recommendedSteps.map((s: string, i: number) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {Array.isArray(expl.links) && expl.links.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {expl.links.map((l: { label: string; href: string }, i: number) => (
                              <Link key={i} href={l.href} className="text-xs text-amber-400 hover:underline">
                                {l.label} →
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-neutral-500">No next actions</div>
          )}
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
    </div>
  );
}
