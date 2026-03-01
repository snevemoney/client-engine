"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Play,
  DollarSign,
  FolderKanban,
  Rocket,
  ShieldCheck,
  BarChart3,
  Cpu,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────── */

type Approval = {
  id: string;
  agentRunId: string;
  agentId: string;
  triggerType: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  reason: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
};

type AgentRun = {
  id: string;
  agentId: string;
  triggerType: string;
  triggerSource: string | null;
  taskPrompt: string;
  status: string;
  resultSummary: string | null;
  toolCallCount: number;
  tokenUsage: { inputTokens: number; outputTokens: number } | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  approvals: Array<{
    id: string;
    toolName: string;
    status: string;
    createdAt: string;
  }>;
};

/* ─── Agent metadata for cards ───────────────────────────────────────── */

const AGENTS = [
  {
    id: "revenue",
    name: "Revenue",
    description: "Sales pipeline, leads, proposals, follow-ups",
    icon: DollarSign,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
    schedule: "Daily 8am",
  },
  {
    id: "delivery",
    name: "Delivery",
    description: "Project tracking, deadlines, quality gates",
    icon: FolderKanban,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    schedule: "Daily 8am",
  },
  {
    id: "growth",
    name: "Growth",
    description: "Prospecting, outreach, deal management",
    icon: Rocket,
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    border: "border-violet-400/20",
    schedule: "Daily 8am",
  },
  {
    id: "retention",
    name: "Retention",
    description: "Client health, churn risks, upsell",
    icon: ShieldCheck,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
    schedule: "Weekly Monday",
  },
  {
    id: "intelligence",
    name: "Intelligence",
    description: "Analytics, trends, weekly reports",
    icon: BarChart3,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/20",
    schedule: "Weekly Monday",
  },
  {
    id: "system",
    name: "System",
    description: "Health checks, self-healing, job monitoring",
    icon: Cpu,
    color: "text-neutral-400",
    bg: "bg-neutral-400/10",
    border: "border-neutral-400/20",
    schedule: "Every 6h",
  },
] as const;

const STATUS_COLORS: Record<string, string> = {
  running: "text-blue-400 border-blue-400/30",
  completed: "text-emerald-400 border-emerald-400/30",
  failed: "text-red-400 border-red-400/30",
  awaiting_approval: "text-amber-400 border-amber-400/30",
  timed_out: "text-neutral-400 border-neutral-400/30",
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── Agent Card ─────────────────────────────────────────────────────── */

function AgentCard({
  agent,
  lastRun,
  runningId,
  onRun,
}: {
  agent: (typeof AGENTS)[number];
  lastRun: AgentRun | undefined;
  runningId: string | null;
  onRun: (id: string) => void;
}) {
  const Icon = agent.icon;
  const isRunning = runningId === agent.id;

  return (
    <div
      className={`rounded-lg border ${agent.border} ${agent.bg} p-4 flex flex-col gap-3`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-md flex items-center justify-center ${agent.bg} border ${agent.border}`}
          >
            <Icon className={`w-4 h-4 ${agent.color}`} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-200">
              {agent.name}
            </h3>
            <p className="text-xs text-neutral-500">{agent.schedule}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className={`text-xs ${agent.color} ${agent.border} hover:${agent.bg}`}
          disabled={isRunning}
          onClick={() => onRun(agent.id)}
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 mr-1" />
          )}
          {isRunning ? "Running…" : "Run Now"}
        </Button>
      </div>

      {/* Description */}
      <p className="text-xs text-neutral-400">{agent.description}</p>

      {/* Last run status */}
      {lastRun ? (
        <div className="flex items-center gap-2 text-xs pt-1 border-t border-neutral-800/50">
          <Badge
            variant="outline"
            className={`text-[10px] ${STATUS_COLORS[lastRun.status] ?? "text-neutral-400"}`}
          >
            {lastRun.status.replace(/_/g, " ")}
          </Badge>
          <span className="text-neutral-500">{timeAgo(lastRun.startedAt)}</span>
          {lastRun.durationMs !== null && (
            <span className="text-neutral-600">
              {formatDuration(lastRun.durationMs)}
            </span>
          )}
          <span className="text-neutral-600">
            {lastRun.toolCallCount} tools
          </span>
        </div>
      ) : (
        <div className="text-xs text-neutral-600 pt-1 border-t border-neutral-800/50">
          Never run
        </div>
      )}

      {/* Error or summary from last run */}
      {lastRun?.errorMessage && (
        <p className="text-xs text-red-400/70 line-clamp-1">
          {lastRun.errorMessage}
        </p>
      )}
      {lastRun?.resultSummary && !lastRun.errorMessage && (
        <p className="text-xs text-neutral-500 line-clamp-2">
          {lastRun.resultSummary}
        </p>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function AgentsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [approvalsRes, runsRes] = await Promise.allSettled([
        fetch("/api/agents/approvals", {
          credentials: "include",
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : { items: [] })),
        fetch("/api/agents/runs?limit=30", {
          credentials: "include",
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : { items: [] })),
      ]);
      setApprovals(
        approvalsRes.status === "fulfilled"
          ? (approvalsRes.value.items ?? [])
          : []
      );
      setRuns(
        runsRes.status === "fulfilled" ? (runsRes.value.items ?? []) : []
      );
    } catch {
      // Graceful — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Get the last run per agent
  const lastRunByAgent = new Map<string, AgentRun>();
  for (const r of runs) {
    if (!lastRunByAgent.has(r.agentId)) {
      lastRunByAgent.set(r.agentId, r);
    }
  }

  const handleRunAgent = async (agentId: string) => {
    setRunningAgentId(agentId);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agentId }),
      });
      const result = await res.json();
      if (result.ok) {
        toast.success(
          `${agentId} agent completed — ${result.toolCalls} tool calls`
        );
      } else {
        toast.error(result.resultSummary || `${agentId} agent failed`);
      }
      void fetchData();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : `Failed to run ${agentId} agent`
      );
    } finally {
      setRunningAgentId(null);
    }
  };

  const handleApproval = async (approvalId: string, approved: boolean) => {
    setProcessingIds((prev) => new Set(prev).add(approvalId));
    try {
      const res = await fetch("/api/agents/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ approvalId, approved }),
      });
      if (!res.ok) throw new Error("Failed to process approval");
      toast.success(approved ? "Approved" : "Rejected");
      void fetchData();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to process approval"
      );
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(approvalId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-neutral-400 mt-1">
            6 autonomous domain agents — run on schedule or on demand
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw
            className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Pending Approvals (only visible when there are some) */}
      {approvals.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-medium text-amber-300">
              Pending Approvals
            </h2>
            <Badge
              variant="outline"
              className="text-amber-400 border-amber-400/30"
            >
              {approvals.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {approvals.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-4 rounded-md border border-amber-500/20 bg-neutral-900/50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {a.agentId}
                    </Badge>
                    <span className="text-xs text-neutral-500 font-mono">
                      {a.toolName}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 line-clamp-2">
                    {a.reason}
                  </p>
                  <span className="text-[10px] text-neutral-600 mt-1 block">
                    {timeAgo(a.createdAt)}
                    {a.expiresAt && (
                      <>
                        {" "}
                        · expires {timeAgo(a.expiresAt)}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10"
                    disabled={processingIds.has(a.id)}
                    onClick={() => handleApproval(a.id, true)}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                    disabled={processingIds.has(a.id)}
                    onClick={() => handleApproval(a.id, false)}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {AGENTS.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            lastRun={lastRunByAgent.get(agent.id)}
            runningId={runningAgentId}
            onRun={handleRunAgent}
          />
        ))}
      </div>

      {/* Run History (collapsible) */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-500" />
            <h2 className="text-sm font-medium text-neutral-300">
              Run History
            </h2>
            <span className="text-xs text-neutral-600">{runs.length} runs</span>
          </div>
          {showHistory ? (
            <ChevronUp className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          )}
        </button>

        {showHistory && (
          <div className="px-4 pb-4 space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-neutral-600">No runs yet</p>
            ) : (
              runs.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 rounded-md border border-neutral-800 bg-neutral-900/30 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-xs">
                        {r.agentId}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATUS_COLORS[r.status] ?? "text-neutral-400"}`}
                      >
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-neutral-500">
                        {r.triggerType === "scheduled"
                          ? `cron: ${r.triggerSource ?? "scheduled"}`
                          : r.triggerType}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-1">
                      {r.taskPrompt}
                    </p>
                    {r.resultSummary && (
                      <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                        {r.resultSummary}
                      </p>
                    )}
                    {r.errorMessage && (
                      <p className="text-xs text-red-400/70 line-clamp-1 mt-0.5">
                        {r.errorMessage}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs text-neutral-500">
                      {timeAgo(r.startedAt)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-neutral-600 justify-end">
                      {r.durationMs !== null && (
                        <span>{formatDuration(r.durationMs)}</span>
                      )}
                      <span>{r.toolCallCount} tools</span>
                      {r.tokenUsage && (
                        <span>
                          {Math.round(
                            (r.tokenUsage.inputTokens +
                              r.tokenUsage.outputTokens) /
                              1000
                          )}
                          k tok
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
