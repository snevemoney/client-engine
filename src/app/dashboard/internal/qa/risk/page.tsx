"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, X, Circle, RefreshCw } from "lucide-react";

type CheckStatus = "not_run" | "passed" | "failed";

type ChecklistItem = {
  id: string;
  label: string;
  status: CheckStatus;
};

const STORAGE_KEY = "qa-risk-checklist";

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: "run_rules", label: "Run risk rules", status: "not_run" },
  { id: "list_filters", label: "List + filters work", status: "not_run" },
  { id: "snooze_resolve", label: "Snooze / Resolve / Dismiss", status: "not_run" },
  { id: "critical_notify", label: "Critical risk creates in-app notification", status: "not_run" },
];

function loadItems(): ChecklistItem[] {
  if (typeof window === "undefined") return DEFAULT_ITEMS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ITEMS;
    const parsed = JSON.parse(raw) as ChecklistItem[];
    return parsed.length > 0 ? parsed : DEFAULT_ITEMS;
  } catch {
    return DEFAULT_ITEMS;
  }
}

function saveItems(items: ChecklistItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export default function RiskQAPage() {
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_ITEMS);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setItems(loadItems());
  }, []);

  useEffect(() => {
    saveItems(items);
  }, [items]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/risk/summary", { credentials: "include", cache: "no-store" });
      setSummary(res.ok ? await res.json() : null);
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const setItemStatus = (id: string, status: CheckStatus) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const statusIcon = (s: CheckStatus) => {
    if (s === "passed") return <Check className="w-4 h-4 text-emerald-400" />;
    if (s === "failed") return <X className="w-4 h-4 text-red-400" />;
    return <Circle className="w-4 h-4 text-neutral-500" />;
  };

  const openBySeverity = (summary?.openBySeverity as Record<string, number>) ?? {};
  const lastRunAt = summary?.lastRunAt as string | null;

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Risk QA Checklist</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Internal checklist for risk flags. State persists in localStorage.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void fetchData()}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
        <Link href="/dashboard/risk">
          <Button variant="outline" size="sm">Risk page</Button>
        </Link>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h3 className="font-medium text-neutral-200 mb-2">System readiness</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-neutral-500">Critical</p>
            <p className="font-medium text-red-400">{openBySeverity.critical ?? 0}</p>
          </div>
          <div>
            <p className="text-neutral-500">High</p>
            <p className="font-medium text-amber-400">{openBySeverity.high ?? 0}</p>
          </div>
          <div>
            <p className="text-neutral-500">Snoozed</p>
            <p className="font-medium">{(summary?.snoozedCount as number) ?? 0}</p>
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
