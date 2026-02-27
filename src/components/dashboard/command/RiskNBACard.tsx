"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Play, AlertTriangle, ListTodo } from "lucide-react";

type RiskItem = { id: string; title: string; severity: string; actionUrl: string | null };

type RiskSummary = {
  openBySeverity: { low: number; medium: number; high: number; critical: number };
  snoozedCount: number;
  lastRunAt: string | null;
};

type NBASummary = {
  top5: Array<{ id: string; title: string; reason: string | null; priority: string; score: number; actionUrl: string | null }>;
  queuedByPriority: { low: number; medium: number; high: number; critical: number };
  lastRunAt: string | null;
};

export function RiskNBACard() {
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [riskItems, setRiskItems] = useState<RiskItem[]>([]);
  const [nbaSummary, setNBASummary] = useState<NBASummary | null>(null);
  const [runRiskLoading, setRunRiskLoading] = useState(false);
  const [runNBALoading, setRunNBALoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [riskData, riskList, nba] = await Promise.all([
        fetch("/api/risk/summary", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/risk?status=open&pageSize=3&page=1", { credentials: "include", cache: "no-store" }).then((r) =>
          r.ok ? r.json() : { items: [] }
        ),
        fetch("/api/next-actions/summary?entityType=command_center&entityId=command_center", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      ]);
      setRiskSummary(riskData);
      setRiskItems(riskList?.items ?? []);
      setNBASummary(nba);
    };
    void load();
  }, []);

  const handleRunRisk = async () => {
    setRunRiskLoading(true);
    try {
      const res = await fetch("/api/risk/run-rules", { method: "POST" });
      if (res.ok) {
        const [sum, list] = await Promise.all([
          fetch("/api/risk/summary", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
          fetch("/api/risk?status=open&pageSize=3&page=1", { credentials: "include", cache: "no-store" }).then((r) =>
            r.ok ? r.json() : { items: [] }
          ),
        ]);
        setRiskSummary(sum);
        setRiskItems(list?.items ?? []);
      }
    } finally {
      setRunRiskLoading(false);
    }
  };

  const handleRunNBA = async () => {
    setRunNBALoading(true);
    try {
      const res = await fetch("/api/next-actions/run?entityType=command_center&entityId=command_center", { method: "POST" });
      if (res.ok) {
        const r = await fetch("/api/next-actions/summary?entityType=command_center&entityId=command_center", { credentials: "include", cache: "no-store" });
        if (r.ok) setNBASummary(await r.json());
      }
    } finally {
      setRunNBALoading(false);
    }
  };

  const top3Risks = riskItems.slice(0, 3);
  const top3Actions = nbaSummary?.top5?.slice(0, 3) ?? [];

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="risk-nba-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-neutral-200">Risks & Next Actions</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRunRisk} disabled={runRiskLoading} data-testid="run-risk-rules">
            <Play className="w-3 h-3 mr-1" />
            {runRiskLoading ? "…" : "Risk"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRunNBA} disabled={runNBALoading} data-testid="run-next-actions">
            <Play className="w-3 h-3 mr-1" />
            {runNBALoading ? "…" : "Actions"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="flex items-center gap-2 text-neutral-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Top Risks</span>
          </div>
          <div className="space-y-1.5">
            {top3Risks.length > 0
              ? top3Risks.map((r) => (
                  <div key={r.id} className="flex items-start gap-2">
                    {r.actionUrl ? (
                      <Link href={r.actionUrl} className="text-neutral-300 hover:text-white truncate min-w-0 flex-1">
                        {r.title}
                      </Link>
                    ) : (
                      <span className="text-neutral-300 truncate flex-1">{r.title}</span>
                    )}
                    <span className={`text-xs shrink-0 ${r.severity === "critical" ? "text-red-400" : r.severity === "high" ? "text-amber-400" : "text-neutral-500"}`}>
                      {r.severity}
                    </span>
                  </div>
                ))
              : riskSummary ? (
                  <p className="text-neutral-500">No open risks</p>
                ) : (
                  <p className="text-neutral-500">—</p>
                )}
          </div>
          <Link href="/dashboard/risk" className="text-xs text-neutral-400 hover:text-neutral-300 mt-1 inline-block">
            View all →
          </Link>
        </div>

        <div>
          <div className="flex items-center gap-2 text-neutral-400 mb-2">
            <ListTodo className="w-4 h-4" />
            <span>Next Actions</span>
          </div>
          <div className="space-y-1.5">
            {top3Actions.length > 0
              ? top3Actions.map((a) => (
                  <div key={a.id} className="flex items-start gap-2">
                    {a.actionUrl ? (
                      <Link href={a.actionUrl} className="text-neutral-300 hover:text-white truncate min-w-0 flex-1">
                        {a.title}
                      </Link>
                    ) : (
                      <span className="text-neutral-300 truncate flex-1">{a.title}</span>
                    )}
                  </div>
                ))
              : nbaSummary ? (
                  <p className="text-neutral-500">No queued actions</p>
                ) : (
                  <p className="text-neutral-500">—</p>
                )}
          </div>
          <Link href="/dashboard/next-actions" className="text-xs text-neutral-400 hover:text-neutral-300 mt-1 inline-block">
            View all →
          </Link>
        </div>
      </div>
    </div>
  );
}
