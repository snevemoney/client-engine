"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, Cpu, Zap, DollarSign, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useBrainPanel } from "@/contexts/BrainPanelContext";

type AgentSummary = {
  runs: number;
  successRate: number | null;
  avgDurationMs: number | null;
};

type MetricsData = {
  days: number;
  agents: {
    totalRuns: number;
    successRate: number | null;
    avgDurationMs: number | null;
    totalTokens: number;
    estimatedCost: number;
    byAgent: Record<string, AgentSummary>;
  };
  pipeline: {
    totalRuns: number;
    successRate: number | null;
    avgDurationMs: number | null;
    succeeded: number;
    failed: number;
  };
  nba: {
    pendingCount: number;
    completedToday: number;
    avgScoreCompleted: number | null;
  };
  timeToCash: {
    avgDays: number | null;
    medianDays: number | null;
    deals: number;
  };
  flywheel: {
    totalRuns: number;
    completed: number;
    failed: number;
    successRate: number | null;
    avgDurationMs: number | null;
    failedSteps: Record<string, number>;
  };
};

type HealthData = {
  ok: boolean;
  checks: Record<string, {
    ok: boolean;
    detail?: string;
    data?: Record<string, unknown>;
  }>;
};

export default function SystemPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { setPageData } = useBrainPanel();

  const fetchAll = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, healthRes] = await Promise.all([
        fetch("/api/internal/execution/metrics?days=7", { signal: controller.signal }),
        fetch("/api/health", { signal: controller.signal }),
      ]);
      if (!metricsRes.ok) throw new Error(`Metrics: ${metricsRes.status}`);
      if (!healthRes.ok) throw new Error(`Health: ${healthRes.status}`);
      setMetrics(await metricsRes.json());
      setHealth(await healthRes.json());
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); return () => abortRef.current?.abort(); }, [fetchAll]);

  useEffect(() => {
    if (!metrics) return;
    const h = health?.ok ? "healthy" : "unhealthy";
    setPageData(
      `System: ${h}. Agents: ${metrics.agents.totalRuns} runs, ${((metrics.agents.successRate ?? 0) * 100).toFixed(0)}% success. Pipeline: ${metrics.pipeline.totalRuns} runs. NBA: ${metrics.nba.pendingCount} pending. Flywheel: ${metrics.flywheel.totalRuns} runs, ${metrics.flywheel.failed} failed.`
    );
  }, [metrics, health, setPageData]);

  if (loading && !metrics) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-neutral-100 mb-6">System Performance</h1>
        <div className="text-neutral-400">Loading execution metrics...</div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-neutral-100 mb-6">System Performance</h1>
        <div className="text-red-400">{error}</div>
        <Button variant="outline" size="sm" onClick={fetchAll} className="mt-3">Retry</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">System Performance</h1>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Health overview */}
      {health && <HealthSection health={health} />}

      {/* Key metrics cards */}
      {metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={<Cpu className="w-4 h-4" />}
              label="Agent Runs (7d)"
              value={String(metrics.agents.totalRuns)}
              sub={metrics.agents.successRate !== null ? `${metrics.agents.successRate}% success` : undefined}
              accent={metrics.agents.successRate !== null && metrics.agents.successRate >= 80}
              warn={metrics.agents.successRate !== null && metrics.agents.successRate < 50}
            />
            <MetricCard
              icon={<Activity className="w-4 h-4" />}
              label="Pipeline Runs (7d)"
              value={String(metrics.pipeline.totalRuns)}
              sub={metrics.pipeline.successRate !== null ? `${metrics.pipeline.successRate}% success` : undefined}
              accent={metrics.pipeline.successRate !== null && metrics.pipeline.successRate >= 80}
            />
            <MetricCard
              icon={<DollarSign className="w-4 h-4" />}
              label="AI Cost (7d)"
              value={`$${metrics.agents.estimatedCost.toFixed(2)}`}
              sub={`${(metrics.agents.totalTokens / 1000).toFixed(0)}k tokens`}
            />
            <MetricCard
              icon={<Clock className="w-4 h-4" />}
              label="Time to Cash"
              value={metrics.timeToCash.avgDays !== null ? `${metrics.timeToCash.avgDays}d avg` : "N/A"}
              sub={metrics.timeToCash.deals > 0 ? `${metrics.timeToCash.deals} deals (90d)` : "No data"}
            />
          </div>

          {/* NBA queue */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard
              icon={<Zap className="w-4 h-4" />}
              label="NBA Pending"
              value={String(metrics.nba.pendingCount)}
              warn={metrics.nba.pendingCount > 30}
            />
            <MetricCard
              icon={<CheckCircle2 className="w-4 h-4" />}
              label="NBA Completed Today"
              value={String(metrics.nba.completedToday)}
            />
            <MetricCard
              icon={<Activity className="w-4 h-4" />}
              label="Avg NBA Score"
              value={metrics.nba.avgScoreCompleted !== null ? String(metrics.nba.avgScoreCompleted) : "N/A"}
              sub="of completed actions"
            />
          </div>

          {/* Flywheel metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={<Zap className="w-4 h-4" />}
              label="Flywheel Runs (7d)"
              value={String(metrics.flywheel.totalRuns)}
              sub={metrics.flywheel.successRate !== null ? `${metrics.flywheel.successRate}% success` : undefined}
              accent={metrics.flywheel.successRate !== null && metrics.flywheel.successRate >= 80}
              warn={metrics.flywheel.successRate !== null && metrics.flywheel.successRate < 50}
            />
            <MetricCard
              icon={<CheckCircle2 className="w-4 h-4" />}
              label="Flywheel Completed"
              value={String(metrics.flywheel.completed)}
            />
            <MetricCard
              icon={<Activity className="w-4 h-4" />}
              label="Flywheel Avg Duration"
              value={metrics.flywheel.avgDurationMs !== null ? formatDuration(metrics.flywheel.avgDurationMs) : "N/A"}
            />
            <MetricCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Flywheel Failed"
              value={String(metrics.flywheel.failed)}
              warn={metrics.flywheel.failed > 0}
              sub={Object.keys(metrics.flywheel.failedSteps).length > 0
                ? `Top: ${Object.entries(metrics.flywheel.failedSteps).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"}`
                : undefined}
            />
          </div>

          {/* Agent breakdown table */}
          <AgentTable byAgent={metrics.agents.byAgent} />
        </>
      )}
    </div>
  );
}

function HealthSection({ health }: { health: HealthData }) {
  const entries = Object.entries(health.checks);
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2.5 h-2.5 rounded-full ${health.ok ? "bg-green-500" : "bg-red-500"}`} />
        <span className="text-sm font-medium text-neutral-200">
          System {health.ok ? "Healthy" : "Degraded"}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {entries.map(([key, check]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            {check.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span className="text-neutral-400 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
            {check.data && (
              <span className="text-neutral-500 ml-auto">
                {Object.entries(check.data).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(", ")}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, accent, warn }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-1.5 text-neutral-400 mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-lg font-semibold ${warn ? "text-amber-400" : accent ? "text-green-400" : "text-neutral-100"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function AgentTable({ byAgent }: { byAgent: Record<string, AgentSummary> }) {
  const agents = Object.entries(byAgent).sort((a, b) => b[1].runs - a[1].runs);
  if (agents.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h2 className="text-sm font-medium text-neutral-200 mb-2">Agent Performance</h2>
        <p className="text-xs text-neutral-500">No agent runs in this period.</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h2 className="text-sm font-medium text-neutral-200 mb-3">Agent Performance (7d)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-neutral-500 border-b border-neutral-800">
              <th className="text-left py-2 pr-4">Agent</th>
              <th className="text-right py-2 px-4">Runs</th>
              <th className="text-right py-2 px-4">Success</th>
              <th className="text-right py-2 pl-4">Avg Duration</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(([id, a]) => (
              <tr key={id} className="border-b border-neutral-800/50">
                <td className="py-2 pr-4">
                  <Badge variant="outline" className="text-xs capitalize">{id}</Badge>
                </td>
                <td className="text-right py-2 px-4 text-neutral-300">{a.runs}</td>
                <td className="text-right py-2 px-4">
                  {a.successRate !== null ? (
                    <span className={a.successRate >= 80 ? "text-green-400" : a.successRate >= 50 ? "text-amber-400" : "text-red-400"}>
                      {a.successRate}%
                    </span>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </td>
                <td className="text-right py-2 pl-4 text-neutral-400">
                  {a.avgDurationMs !== null ? formatDuration(a.avgDurationMs) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}
