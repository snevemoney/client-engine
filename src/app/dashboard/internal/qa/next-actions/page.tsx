"use client";
import { apiPath } from "@/lib/base-path";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, X, Circle, RefreshCw } from "lucide-react";

type CheckStatus = "not_run" | "passed" | "failed";

type ChecklistItem = {
  id: string;
  label: string;
  status: CheckStatus;
};

const STORAGE_KEY = "qa-next-actions-checklist";

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: "run", label: "Run next actions", status: "not_run" },
  { id: "list_filters", label: "List + filters work", status: "not_run" },
  { id: "done_dismiss", label: "Done / Dismiss", status: "not_run" },
  { id: "ranking", label: "Ranking by score", status: "not_run" },
];

const STORAGE_EVENT = "qa-next-actions-checklist-change";

let cachedRaw: string | null | undefined;
let cachedItems: ChecklistItem[] = DEFAULT_ITEMS;

function parseStoredItems(raw: string | null): ChecklistItem[] {
  if (!raw) return DEFAULT_ITEMS;
  try {
    const parsed = JSON.parse(raw) as ChecklistItem[];
    return parsed.length > 0 ? parsed : DEFAULT_ITEMS;
  } catch {
    return DEFAULT_ITEMS;
  }
}

function subscribeItems(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
}

function getItemsSnapshot(): ChecklistItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedItems;
  cachedRaw = raw;
  cachedItems = parseStoredItems(raw);
  return cachedItems;
}

function persistItems(next: ChecklistItem[]) {
  try {
    const raw = JSON.stringify(next);
    localStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
    cachedItems = next;
    window.dispatchEvent(new Event(STORAGE_EVENT));
  } catch {
    /* ignore quota / private mode */
  }
}

export default function NextActionsQAPage() {
  const items = useSyncExternalStore(subscribeItems, getItemsSnapshot, () => DEFAULT_ITEMS);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(apiPath("/api/next-actions/summary"), { credentials: "include", cache: "no-store" });
      setSummary(res.ok ? await res.json() : null);
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiPath("/api/next-actions/summary"), { credentials: "include", cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!controller.signal.aborted) setSummary(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSummary(null);
      });
    return () => controller.abort();
  }, []);

  const setItemStatus = (id: string, status: CheckStatus) => {
    persistItems(items.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const statusIcon = (s: CheckStatus) => {
    if (s === "passed") return <Check className="w-4 h-4 text-emerald-400" />;
    if (s === "failed") return <X className="w-4 h-4 text-red-400" />;
    return <Circle className="w-4 h-4 text-neutral-500" />;
  };

  const queuedByPriority = (summary?.queuedByPriority as Record<string, number>) ?? {};
  const lastRunAt = summary?.lastRunAt as string | null;
  const top5 = (summary?.top5 as Array<{ title: string }>) ?? [];

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Next Actions QA Checklist</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Internal checklist for next-best-action flow. State persists in localStorage.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void fetchData()}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
        <Link href="/dashboard/next-actions">
          <Button variant="outline" size="sm">Next Actions page</Button>
        </Link>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h3 className="font-medium text-neutral-200 mb-2">System readiness</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-neutral-500">Critical queued</p>
            <p className="font-medium text-red-400">{queuedByPriority.critical ?? 0}</p>
          </div>
          <div>
            <p className="text-neutral-500">High queued</p>
            <p className="font-medium text-amber-400">{queuedByPriority.high ?? 0}</p>
          </div>
          <div>
            <p className="text-neutral-500">Top 5 count</p>
            <p className="font-medium">{top5.length}</p>
          </div>
          <div>
            <p className="text-neutral-500">Last run</p>
            <p className="text-neutral-400 truncate">{lastRunAt ? new Date(lastRunAt).toLocaleString("en-US") : "—"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <h3 className="font-medium text-neutral-200 px-4 py-3 border-b border-neutral-800">Checklist</h3>
        <div className="divide-y divide-neutral-800">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 p-4 hover:bg-neutral-800/30"
            >
              <span className="shrink-0">{statusIcon(item.status)}</span>
              <span className="flex-1 font-medium text-neutral-300">{item.label}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setItemStatus(item.id, "passed")}
                  className="text-emerald-400"
                >
                  Pass
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setItemStatus(item.id, "failed")}
                  className="text-red-400"
                >
                  Fail
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setItemStatus(item.id, "not_run")}
                  className="text-neutral-400"
                >
                  Reset
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
