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
  lastRunAt: string | null;
  notes: string;
};

const STORAGE_KEY = "qa-notifications-checklist";

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: "create", label: "Notification creation", status: "not_run", lastRunAt: null, notes: "" },
  { id: "dispatch", label: "Dispatch job execution", status: "not_run", lastRunAt: null, notes: "" },
  { id: "inbox", label: "In-app inbox visibility", status: "not_run", lastRunAt: null, notes: "" },
  { id: "channel_test", label: "Channel test send", status: "not_run", lastRunAt: null, notes: "" },
  { id: "escalation", label: "Escalation rule trigger", status: "not_run", lastRunAt: null, notes: "" },
  { id: "escalation_dedupe", label: "Escalation dedupe", status: "not_run", lastRunAt: null, notes: "" },
  { id: "retry", label: "Retry/failure handling", status: "not_run", lastRunAt: null, notes: "" },
  { id: "read", label: "Read / mark-all-read", status: "not_run", lastRunAt: null, notes: "" },
  { id: "dashboard", label: "Dashboard surfacing (Command Center / Scoreboard / Reviews)", status: "not_run", lastRunAt: null, notes: "" },
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

export default function NotificationsQAPage() {
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_ITEMS);
  const [systemCheck, setSystemCheck] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setItems(loadItems()); // eslint-disable-line react-hooks/set-state-in-effect -- hydrate from localStorage
  }, []);

  useEffect(() => {
    saveItems(items);
  }, [items]);

  const fetchSystemData = useCallback(async () => {
    try {
      const [check, metricsRes] = await Promise.all([
        fetch("/api/internal/system/check", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/internal/ops/metrics-summary?period=24h", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      ]);
      setSystemCheck(check);
      setMetrics(metricsRes);
    } catch {
      setSystemCheck(null);
      setMetrics(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, setState in async callback
    void fetchSystemData();
  }, [fetchSystemData]);

  const setItemStatus = (id: string, status: CheckStatus, notes = "") => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status, lastRunAt: new Date().toISOString(), notes: notes || i.notes }
          : i
      )
    );
  };

  const statusIcon = (s: CheckStatus) => {
    if (s === "passed") return <Check className="w-4 h-4 text-emerald-400" />;
    if (s === "failed") return <X className="w-4 h-4 text-red-400" />;
    return <Circle className="w-4 h-4 text-neutral-500" />;
  };

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications QA Checklist</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Internal checklist to validate notifications/escalations flow. State persists in localStorage.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void fetchSystemData()}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh system data
        </Button>
        <Link href="/dashboard/inbox">
          <Button variant="outline" size="sm">Inbox</Button>
        </Link>
        <Link href="/dashboard/notifications">
          <Button variant="outline" size="sm">Events</Button>
        </Link>
        <Link href="/dashboard/notification-channels">
          <Button variant="outline" size="sm">Channels</Button>
        </Link>
      </div>

      {systemCheck && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-2">System Check</h2>
          <pre className="text-xs text-neutral-400 overflow-auto max-h-40">
            {JSON.stringify(systemCheck, null, 2)}
          </pre>
        </div>
      )}

      {metrics && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-2">Metrics (24h)</h2>
          <pre className="text-xs text-neutral-400 overflow-auto max-h-40">
            {JSON.stringify(metrics, null, 2)}
          </pre>
        </div>
      )}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <h2 className="text-sm font-medium text-neutral-300 px-4 py-3 border-b border-neutral-800">
          Checklist
        </h2>
        <div className="divide-y divide-neutral-800">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 p-4 hover:bg-neutral-800/30"
            >
              <span className="shrink-0">{statusIcon(item.status)}</span>
              <span className="flex-1 font-medium">{item.label}</span>
              {item.lastRunAt && (
                <span className="text-xs text-neutral-500">
                  {new Date(item.lastRunAt).toLocaleString()}
                </span>
              )}
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
              {item.notes && (
                <p className="w-full text-xs text-neutral-500 mt-1">{item.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
