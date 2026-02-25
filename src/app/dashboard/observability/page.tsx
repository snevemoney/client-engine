"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AsyncState } from "@/components/ui/AsyncState";
import { formatDateTimeSafe } from "@/lib/ui/date-safe";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type OpsEvent = {
  id: string;
  createdAt: string;
  level: string;
  category: string;
  status: string;
  eventKey: string;
  eventLabel: string | null;
  sourceType: string | null;
  sourceId: string | null;
  route: string | null;
  method: string | null;
  durationMs: number | null;
  errorMessage: string | null;
};

type Summary = {
  eventsToday: number;
  errorsToday: number;
  slowEventsToday: number;
  lastErrorAt: string | null;
  topEventKeys: { eventKey: string; count: number }[];
  topErrors: { eventKey: string; count: number }[];
  byCategory: Record<string, number>;
  byLevel: Record<string, number>;
};

type SlowEvent = OpsEvent;

export default function ObservabilityPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [slowEvents, setSlowEvents] = useState<SlowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [slowOnly, setSlowOnly] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (category) params.set("category", category);
      if (level) params.set("level", level);
      if (status) params.set("status", status);
      params.set("limit", "50");

      const [sumRes, listRes, slowRes] = await Promise.all([
        fetch("/api/ops-events/summary", { credentials: "include", signal: controller.signal }),
        fetch(`/api/ops-events?${params}`, { credentials: "include", signal: controller.signal }),
        fetch("/api/ops-events/slow?threshold=1500", { credentials: "include", signal: controller.signal }),
      ]);

      if (controller.signal.aborted || runId !== runIdRef.current) return;

      const sumData = await sumRes.json().catch(() => null);
      const listData = await listRes.json().catch(() => null);
      const slowData = await slowRes.json().catch(() => null);

      if (!sumRes.ok) {
        setError(typeof sumData?.error === "string" ? sumData.error : "Failed to load");
        return;
      }

      setSummary(sumData);
      setEvents(Array.isArray(listData?.items) ? listData.items : []);
      setSlowEvents(Array.isArray(slowData?.items) ? slowData.items : []);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [debouncedSearch, category, level, status]);

  useEffect(() => {
    void fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  const displayEvents = slowOnly ? slowEvents : events;
  const isEmpty = !loading && !error && displayEvents.length === 0;

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Observability</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Telemetry, errors, and slow events for operator health.
        </p>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={isEmpty && !summary}
        emptyMessage="No events yet."
        onRetry={fetchData}
      >
        {summary && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Events today</p>
                <p className="text-xl font-semibold text-neutral-200">{summary.eventsToday ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Errors today</p>
                <p className="text-xl font-semibold text-red-400">{summary.errorsToday ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Slow events</p>
                <p className="text-xl font-semibold text-amber-400">{summary.slowEventsToday ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Last error</p>
                <p className="text-sm text-neutral-400">{formatDateTimeSafe(summary.lastErrorAt ?? null)}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Top event</p>
                <p className="text-sm text-neutral-300 truncate">
                  {summary.topEventKeys?.[0]?.eventKey ?? "—"}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                <p className="text-xs text-neutral-500 uppercase">Top error</p>
                <p className="text-sm text-red-400 truncate">
                  {summary.topErrors?.[0]?.eventKey ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
              >
                <option value="">All categories</option>
                <option value="api_action">API action</option>
                <option value="ui_action">UI action</option>
                <option value="page_view">Page view</option>
                <option value="system">System</option>
                <option value="audit">Audit</option>
              </select>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
              >
                <option value="">All levels</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm w-40"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={slowOnly}
                  onChange={(e) => setSlowOnly(e.target.checked)}
                  className="rounded"
                />
                Slow only
              </label>
              <Button variant="outline" size="sm" onClick={() => void fetchData()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            <div className="rounded-lg border border-neutral-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-700 bg-neutral-900/50">
                      <th className="text-left p-3 font-medium text-neutral-400">Time</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Level</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Category</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Event</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Source</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Status</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Duration</th>
                      <th className="text-left p-3 font-medium text-neutral-400">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayEvents.map((e) => (
                      <tr key={e.id} className="border-b border-neutral-800 hover:bg-neutral-800/30">
                        <td className="p-3 text-neutral-400">{formatDateTimeSafe(e.createdAt)}</td>
                        <td className="p-3">
                          <Badge
                            variant={e.level === "error" ? "destructive" : "outline"}
                            className={e.level === "warn" ? "border-amber-600 text-amber-400" : ""}
                          >
                            {e.level}
                          </Badge>
                        </td>
                        <td className="p-3 text-neutral-400">{e.category}</td>
                        <td className="p-3">
                          <span title={e.eventKey}>{e.eventLabel ?? e.eventKey}</span>
                        </td>
                        <td className="p-3 text-neutral-400">
                          {e.sourceType && e.sourceId ? `${e.sourceType}/${e.sourceId.slice(0, 8)}` : "—"}
                        </td>
                        <td className="p-3 text-neutral-400">{e.status}</td>
                        <td className="p-3 text-neutral-400">
                          {e.durationMs != null ? `${e.durationMs}ms` : "—"}
                        </td>
                        <td className="p-3 text-red-400 max-w-[200px] truncate" title={e.errorMessage ?? undefined}>
                          {e.errorMessage ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {summary.topEventKeys && summary.topEventKeys.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-neutral-700 p-4">
                  <h3 className="text-sm font-medium text-neutral-400 mb-2">Top events</h3>
                  <ul className="space-y-1 text-sm">
                    {summary.topEventKeys.map((t) => (
                      <li key={t.eventKey} className="flex justify-between">
                        <span className="truncate">{t.eventKey}</span>
                        <span className="text-neutral-500">{t.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-neutral-700 p-4">
                  <h3 className="text-sm font-medium text-neutral-400 mb-2">Top errors</h3>
                  <ul className="space-y-1 text-sm">
                    {summary.topErrors?.map((t) => (
                      <li key={t.eventKey} className="flex justify-between">
                        <span className="truncate text-red-400">{t.eventKey}</span>
                        <span className="text-neutral-500">{t.count}</span>
                      </li>
                    ))}
                    {(!summary.topErrors || summary.topErrors.length === 0) && (
                      <li className="text-neutral-500">None</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </AsyncState>
    </div>
  );
}
