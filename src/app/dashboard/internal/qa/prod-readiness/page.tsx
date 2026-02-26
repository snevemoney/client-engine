"use client";

/**
 * Phase 3.6: Prod readiness validation page.
 * Links to QA pages, system check, metrics; checklist persisted in localStorage.
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, X, Circle, ExternalLink } from "lucide-react";

type CheckStatus = "not_run" | "passed" | "failed";

type ChecklistItem = {
  id: string;
  label: string;
  status: CheckStatus;
  lastRunAt: string | null;
};

const STORAGE_KEY = "qa-prod-readiness-checklist";
const LAST_RUN_KEY = "qa-prod-readiness-last-run";

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: "auth", label: "Auth checks (401 without session)", status: "not_run", lastRunAt: null },
  { id: "score_compute", label: "Score compute flow", status: "not_run", lastRunAt: null },
  { id: "alerts_suppression", label: "Alerts suppression / cooldown", status: "not_run", lastRunAt: null },
  { id: "trend_chart", label: "Trend chart rendering", status: "not_run", lastRunAt: null },
  { id: "system_check", label: "System check green", status: "not_run", lastRunAt: null },
  { id: "metrics", label: "Metrics endpoint responding", status: "not_run", lastRunAt: null },
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

function loadLastRun(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_RUN_KEY);
}

function saveLastRun() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_RUN_KEY, new Date().toISOString());
}

export default function ProdReadinessPage() {
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_ITEMS);
  const [lastRun, setLastRun] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadItems()); // eslint-disable-line react-hooks/set-state-in-effect
    setLastRun(loadLastRun());
  }, []);

  useEffect(() => {
    saveItems(items);
  }, [items]);

  const setItemStatus = (id: string, status: CheckStatus) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status, lastRunAt: new Date().toISOString() }
          : i
      )
    );
    saveLastRun();
    setLastRun(new Date().toISOString());
  };

  const statusIcon = (s: CheckStatus) => {
    if (s === "passed") return <Check className="w-4 h-4 text-emerald-400" />;
    if (s === "failed") return <X className="w-4 h-4 text-red-400" />;
    return <Circle className="w-4 h-4 text-neutral-500" />;
  };

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prod Readiness Validation</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Internal checklist for production readiness. State persists in localStorage.
        </p>
        {lastRun && (
          <p className="text-xs text-neutral-500 mt-1">
            Last run: {new Date(lastRun).toLocaleString("en-US")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/internal/qa/notifications" data-testid="prod-readiness-link-notifications-qa">
          <Button variant="outline" size="sm">
            Notifications QA
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
        <Link href="/dashboard/internal/qa/scores" data-testid="prod-readiness-link-scores-qa">
          <Button variant="outline" size="sm">
            Scores QA
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
        <Link href="/dashboard/internal/qa/risk" data-testid="prod-readiness-link-risk-qa">
          <Button variant="outline" size="sm">
            Risk QA
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
        <Link href="/dashboard/internal/qa/next-actions" data-testid="prod-readiness-link-next-actions-qa">
          <Button variant="outline" size="sm">
            Next Actions QA
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
        <Link href="/dashboard/internal/scoreboard">
          <Button variant="outline" size="sm">
            Scoreboard
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
        <Link href="/dashboard/internal/scores/alerts">
          <Button variant="outline" size="sm">
            Alerts Preferences
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
        <a href="/api/internal/system/check" target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            System Check (API)
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </a>
        <a href="/api/internal/ops/metrics-summary?period=24h" target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            Metrics (API)
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </a>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <h2 className="text-sm font-medium text-neutral-300 px-4 py-3 border-b border-neutral-800">
          Go/No-Go Checklist
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
                  {new Date(item.lastRunAt).toLocaleString("en-US")}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
