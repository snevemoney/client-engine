"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useBrainPanel } from "@/contexts/BrainPanelContext";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Trash2,
  Filter,
  X,
  Zap,
  Rocket,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetchJsonThrow } from "@/lib/http/fetch-json";



interface Lead {
  id: string;
  title: string;
  source: string;
  status: string;
  budget: string | null;
  score: number | null;
  scoreVerdict: string | null;
  createdAt: string;
  tags: string[];
  _count?: { artifacts: number };
  proposals?: Array<{ id: string; status: string }>;
  deliveryProjects?: Array<{ id: string; status: string }>;
}

/* ─── Flywheel Dialog Types ───────────────────────────────────────── */

type BatchResult = {
  ok: boolean;
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    leadId: string;
    title: string;
    ok: boolean;
    proposalId: string | null;
    deliveryProjectId: string | null;
    builderSiteId: string | null;
    totalDurationMs: number;
    error?: string;
  }>;
};

type PreviewLead = {
  id: string;
  title: string;
  source: string | null;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  createdAt: string;
};

/* ─── Toggle Component ────────────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-3 px-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors"
    >
      <div className="text-left">
        <p className="text-sm font-medium text-neutral-200">{label}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
      </div>
      <div
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-3 ${
          checked ? "bg-amber-500" : "bg-neutral-700"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}

/* ─── Pipeline Progress Badge ────────────────────────────────────── */

const PROPOSAL_COLORS: Record<string, string> = {
  accepted: "text-emerald-400 border-emerald-800",
  sent: "text-amber-400 border-amber-800",
  viewed: "text-amber-400 border-amber-800",
  ready: "text-blue-400 border-blue-800",
  draft: "text-neutral-400 border-neutral-700",
  rejected: "text-red-400 border-red-800",
};

const DELIVERY_COLORS: Record<string, string> = {
  completed: "text-emerald-400 border-emerald-800",
  qa: "text-blue-400 border-blue-800",
  in_progress: "text-amber-400 border-amber-800",
  kickoff: "text-amber-400 border-amber-800",
  not_started: "text-neutral-400 border-neutral-700",
};

function PipelineProgress({ lead }: { lead: Lead }) {
  const proposal = lead.proposals?.[0];
  const delivery = lead.deliveryProjects?.[0];

  if (!proposal && !delivery) {
    return <span className="text-neutral-600 text-xs">—</span>;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {proposal && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PROPOSAL_COLORS[proposal.status] ?? "text-neutral-400 border-neutral-700"}`}>
          P: {proposal.status}
        </span>
      )}
      {delivery && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${DELIVERY_COLORS[delivery.status] ?? "text-neutral-400 border-neutral-700"}`}>
          D: {delivery.status.replace(/_/g, " ")}
        </span>
      )}
    </div>
  );
}

/* ─── Flywheel Batch Dialog ───────────────────────────────────────── */

function FlywheelBatchDialog({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [autoSend, setAutoSend] = useState(false);
  const [autoBuild, setAutoBuild] = useState(false);
  const [leads, setLeads] = useState<PreviewLead[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [running, setRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [existingScheduleId, setExistingScheduleId] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const [batchRes, schedRes] = await Promise.all([
        fetch("/api/flywheel/batch", { credentials: "include", cache: "no-store" }),
        fetch("/api/job-schedules", { credentials: "include", cache: "no-store" }),
      ]);
      if (batchRes.ok) {
        const data = await batchRes.json();
        setLeads(data.leads ?? []);
      }
      if (schedRes.ok) {
        const schedules = await schedRes.json();
        const existing = (Array.isArray(schedules) ? schedules : []).find(
          (s: Record<string, unknown>) => s.key === "flywheel_batch"
        );
        if (existing) {
          setExistingScheduleId(existing.id as string);
          setScheduleEnabled(existing.isEnabled as boolean);
          setFrequency((existing.cadenceType as string) === "weekly" ? "weekly" : "daily");
          if (typeof existing.dayOfWeek === "number") setDayOfWeek(existing.dayOfWeek as number);
          const h = String(existing.hour ?? 9).padStart(2, "0");
          const m = String(existing.minute ?? 0).padStart(2, "0");
          setScheduleTime(`${h}:${m}`);
        } else {
          setExistingScheduleId(null);
          setScheduleEnabled(false);
        }
      }
    } catch {
      // Silent
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setBatchResult(null);
      void loadPreview();
    }
  }, [open, loadPreview]);

  const handleRun = async () => {
    setRunning(true);
    setBatchResult(null);
    try {
      const data = await fetchJsonThrow<BatchResult>("/api/flywheel/batch", {
        method: "POST",
        body: JSON.stringify({
          autoSendProposal: autoSend,
          autoBuild,
        }),
      });
      setBatchResult(data);
      if (data.ok) {
        toast.success(`Flywheel complete: ${data.succeeded}/${data.total} succeeded`);
      } else {
        toast.error(`Flywheel complete with errors: ${data.failed}/${data.total} failed`);
      }
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Flywheel batch failed");
    } finally {
      setRunning(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const [hour, minute] = scheduleTime.split(":").map(Number);
      const body = {
        key: "flywheel_batch",
        title: "Flywheel — Auto-run",
        jobType: "flywheel_batch",
        cadenceType: frequency,
        hour,
        minute,
        ...(frequency === "weekly" ? { dayOfWeek } : {}),
        isEnabled: scheduleEnabled,
        payloadTemplateJson: JSON.stringify({ autoSendProposal: autoSend, autoBuild }),
      };

      if (existingScheduleId) {
        await fetchJsonThrow(`/api/job-schedules/${existingScheduleId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        const created = await fetchJsonThrow<{ id: string }>("/api/job-schedules", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setExistingScheduleId(created.id);
      }
      toast.success(
        scheduleEnabled
          ? `Flywheel scheduled ${frequency === "weekly" ? "weekly" : "daily"} at ${scheduleTime}`
          : "Flywheel schedule disabled"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setSavingSchedule(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-amber-400" />
              Start Flywheel
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Run the full pipeline on all eligible leads: qualify → propose → deliver → build
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Preview */}
          <div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Eligible Leads
            </p>
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading leads...
              </div>
            ) : leads.length === 0 ? (
              <p className="text-sm text-neutral-500 py-3">
                No eligible leads found (status NEW/APPROVED, no proposal yet)
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-neutral-800 divide-y divide-neutral-800">
                {leads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-200 truncate">{lead.title}</p>
                      <p className="text-[10px] text-neutral-500">
                        {lead.source ?? "manual"} · {lead.status}
                        {lead.contactName ? ` · ${lead.contactName}` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] text-neutral-600 shrink-0 ml-2">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {leads.length > 0 && (
              <p className="text-xs text-neutral-500 mt-1.5">
                {leads.length} lead{leads.length !== 1 ? "s" : ""} will be processed
              </p>
            )}
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <Toggle
              checked={autoSend}
              onChange={setAutoSend}
              label="Send proposals automatically?"
              description="Proposals will be marked as sent. If off, they stay as drafts for manual review."
            />
            <Toggle
              checked={autoBuild}
              onChange={setAutoBuild}
              label="Start builds automatically?"
              description="Websites will be generated for each prospect. If off, only the proposal is created."
            />
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Toggle
              checked={scheduleEnabled}
              onChange={setScheduleEnabled}
              label="Run on a schedule?"
              description="Flywheel will run automatically at your chosen time."
            />
            {scheduleEnabled && (
              <div className="ml-1 space-y-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider">Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as "daily" | "weekly")}
                      className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200"
                    >
                      <option value="daily">Every day</option>
                      <option value="weekly">Every week</option>
                    </select>
                  </div>
                  {frequency === "weekly" && (
                    <div className="flex-1">
                      <label className="text-[10px] text-neutral-500 uppercase tracking-wider">Day</label>
                      <select
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(Number(e.target.value))}
                        className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200"
                      >
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                        <option value={0}>Sunday</option>
                      </select>
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider">Time</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingSchedule}
                  onClick={handleSaveSchedule}
                  className="w-full gap-2 border-amber-700/50 text-amber-400 hover:bg-amber-900/20"
                >
                  {savingSchedule ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                  ) : (
                    <><Clock className="w-3.5 h-3.5" /> {existingScheduleId ? "Update Schedule" : "Save Schedule"}</>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Results */}
          {batchResult && (
            <div
              className={`rounded-lg border p-3 ${
                batchResult.ok
                  ? "border-emerald-500/30 bg-emerald-950/20"
                  : "border-red-500/30 bg-red-950/20"
              }`}
            >
              <p className={`text-sm font-medium ${batchResult.ok ? "text-emerald-300" : "text-red-300"}`}>
                {batchResult.succeeded}/{batchResult.total} succeeded
                {batchResult.failed > 0 && ` · ${batchResult.failed} failed`}
              </p>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                {batchResult.results.map((r) => (
                  <div key={r.leadId} className="flex items-center gap-2 text-xs">
                    {r.ok ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                    )}
                    <span className="text-neutral-300 truncate">{r.title}</span>
                    <span className="text-neutral-600 ml-auto shrink-0">
                      {(r.totalDurationMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-neutral-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            {batchResult ? "Close" : "Cancel"}
          </Button>
          {!batchResult && (
            <Button
              size="sm"
              disabled={running || leads.length === 0}
              onClick={handleRun}
              className="gap-2"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running {leads.length} lead{leads.length !== 1 ? "s" : ""}...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Start Flywheel ({leads.length})
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Constants ────────────────────────────────────────────────────── */

const STATUS_OPTIONS = ["ALL", "NEW", "ENRICHED", "SCORED", "APPROVED", "REJECTED", "BUILDING", "SHIPPED"];
const SOURCE_OPTIONS = ["ALL", "manual", "upwork", "capture", "email", "facebook", "rss"];
const VERDICT_OPTIONS = ["ALL", "ACCEPT", "MAYBE", "REJECT"];

const statusColors: Record<string, "default" | "success" | "warning" | "destructive"> = {
  NEW: "default", ENRICHED: "default", SCORED: "warning",
  APPROVED: "success", REJECTED: "destructive", BUILDING: "warning", SHIPPED: "success",
};

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [verdictFilter, setVerdictFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [flywheelOpen, setFlywheelOpen] = useState(false);

  const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);
  const { confirm, dialogProps } = useConfirmDialog();

  const { setPageData } = useBrainPanel();

  // Push page data for Brain auto-summary
  useEffect(() => {
    if (loading || leads.length === 0) return;
    const newCount = leads.filter((l) => l.status === "NEW").length;
    const scoredCount = leads.filter((l) => l.score != null).length;
    const approvedCount = leads.filter((l) => l.status === "APPROVED").length;
    const topLead = leads[0]?.title ?? "none";
    setPageData(
      `Leads: ${leads.length} total, ${newCount} new, ${scoredCount} scored, ${approvedCount} approved. Top: ${topLead}.`
    );
  }, [leads, loading, setPageData]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (sourceFilter !== "ALL") params.set("source", sourceFilter);
      if (verdictFilter !== "ALL") params.set("verdict", verdictFilter);
      const res = await fetch(`/api/leads?${params}`, {
        credentials: "include",
        signal: controller.signal,
        cache: "no-store",
      });
      if (timeout) clearTimeout(timeout);
      timeout = null;
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `Failed to load leads (${res.status})`);
        setLeads([]);
        return;
      }
      setLeads(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e instanceof Error && e.name === "AbortError"
        ? "Request timed out. Check your connection and retry."
        : e instanceof Error ? e.message : "Failed to load leads";
      setError(msg);
      setLeads([]);
    } finally {
      if (timeout) clearTimeout(timeout);
      setLoading(false);
    }
  }, [search, statusFilter, sourceFilter, verdictFilter]);

  useEffect(() => {
    // Intentional: fetch on mount/filter change; setState happens in async callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch pattern
    void fetchLeads();
  }, [fetchLeads]);

  const processingToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function runBulkPipeline() {
    if (pipelineRunning) return;
    setPipelineRunning(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min for long pipeline runs
    // Show "still processing" toast after 20s so user knows it's working (alerts get blocked after async)
    processingToastRef.current = setTimeout(() => {
      toast.info("Pipeline still running. This may take 1–2 min per lead. Don't close the page.");
    }, 20_000);
    try {
      const res = await fetch("/api/leads/bulk-pipeline-run", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      clearTimeout(timeoutId);
      if (processingToastRef.current) {
        clearTimeout(processingToastRef.current);
        processingToastRef.current = null;
      }
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to run pipeline");
        return;
      }
      const ran = data?.ran ?? 0;
      const processed = data?.processed ?? 0;
      if (ran > 0) {
        void fetchLeads();
        toast.success(`Pipeline ran for ${ran} lead${ran === 1 ? "" : "s"}.`);
      } else if (processed > 0) {
        void fetchLeads();
        toast("Processed leads but none could run (may already have artifacts or be ineligible).");
      } else {
        toast("No leads need pipeline run.");
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if (processingToastRef.current) {
        clearTimeout(processingToastRef.current);
        processingToastRef.current = null;
      }
      if (e instanceof Error && e.name === "AbortError") {
        toast.error("Request timed out. Pipeline may still be running on the server. Refresh the page to see updates.");
        void fetchLeads();
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to run pipeline");
      }
    } finally {
      setPipelineRunning(false);
    }
  }

  const { execute: deleteLead, pending: deletePending } = useAsyncAction(
    async (id: string) => {
      const confirmed = await confirm({
        title: "Delete this lead?",
        body: "This action cannot be undone. The lead and its data will be permanently removed.",
        confirmLabel: "Delete",
        variant: "destructive",
      });
      if (!confirmed) return;
      await fetchJsonThrow(`/api/leads/${id}`, { method: "DELETE" });
      setLeads((prev) => prev.filter((l) => l.id !== id));
    },
    { toast: toastFn, successMessage: "Lead deleted" },
  );

  const activeFilters = (statusFilter !== "ALL" ? 1 : 0) + (sourceFilter !== "ALL" ? 1 : 0) + (verdictFilter !== "ALL" ? 1 : 0);

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const aScore = a.score ?? -1;
      const bScore = b.score ?? -1;
      if (bScore !== aScore) return bScore - aScore;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [leads]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchLeads()}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="relative">
          <Filter className="w-3.5 h-3.5" /> Filters
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white text-neutral-900 text-[10px] rounded-full flex items-center justify-center font-bold">
              {activeFilters}
            </span>
          )}
        </Button>
        {(() => {
          const needsPipeline = leads.filter((l) => l.status === "NEW" || l.status === "ENRICHED").length;
          return needsPipeline > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={runBulkPipeline}
              disabled={pipelineRunning}
              className="border-amber-700 text-amber-400 hover:bg-amber-900/30"
            >
              <Zap className="w-3.5 h-3.5" />
              {pipelineRunning ? "Running…" : `Run pipeline (${needsPipeline})`}
            </Button>
          ) : null;
        })()}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFlywheelOpen(true)}
          className="border-amber-700 text-amber-400 hover:bg-amber-900/30"
        >
          <Rocket className="w-3.5 h-3.5" />
          Start Flywheel
        </Button>
        <Link href="/dashboard/leads/new">
          <Button size="sm"><Plus className="w-4 h-4" /> Add Lead</Button>
        </Link>
      </div>

      {/* Filters row */}
      {showFilters && (
        <div className="flex items-center gap-4 p-3 border border-neutral-800 rounded-lg bg-neutral-900/30 flex-wrap">
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Status</span>
            <div className="flex gap-1 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${statusFilter === s ? "bg-neutral-700 border-neutral-600 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-700"}`}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Source</span>
            <div className="flex gap-1 flex-wrap">
              {SOURCE_OPTIONS.map((s) => (
                <button key={s} onClick={() => setSourceFilter(s)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${sourceFilter === s ? "bg-neutral-700 border-neutral-600 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-700"}`}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Verdict</span>
            <div className="flex gap-1 flex-wrap">
              {VERDICT_OPTIONS.map((v) => (
                <button key={v} onClick={() => setVerdictFilter(v)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${verdictFilter === v ? "bg-neutral-700 border-neutral-600 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-700"}`}
                >{v}</button>
              ))}
            </div>
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-neutral-400" onClick={() => { setStatusFilter("ALL"); setSourceFilter("ALL"); setVerdictFilter("ALL"); }}>
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>
      )}

      {/* Pipeline summary */}
      {!loading && leads.length > 0 && (() => {
        const newCount = leads.filter((l) => l.status === "NEW" || l.status === "ENRICHED").length;
        const scoredCount = leads.filter((l) => l.status === "SCORED").length;
        const approvedCount = leads.filter((l) => l.status === "APPROVED").length;
        const atRiskCount = leads.filter((l) => l.scoreVerdict === "REJECT" || (l.score != null && l.score < 40)).length;
        const withProposal = leads.filter((l) => (l.proposals?.length ?? 0) > 0).length;
        const inDelivery = leads.filter((l) => (l.deliveryProjects?.length ?? 0) > 0).length;
        const stats = [
          { label: "Total", value: leads.length, color: "text-neutral-200" },
          { label: "Needs pipeline", value: newCount, color: "text-amber-400" },
          { label: "Scored", value: scoredCount, color: "text-blue-400" },
          { label: "Approved", value: approvedCount, color: "text-emerald-400" },
          { label: "At risk", value: atRiskCount, color: "text-red-400" },
          { label: "Has proposal", value: withProposal, color: "text-violet-400" },
          { label: "In delivery", value: inDelivery, color: "text-cyan-400" },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{s.label}</p>
                <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Table */}
      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/50">
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Title</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 hidden sm:table-cell">Source</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Score</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 hidden md:table-cell">Pipeline</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 hidden lg:table-cell">Budget</th>
              <th className="text-right px-4 py-3 font-medium text-neutral-400 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-neutral-800/50 animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-48 rounded bg-muted" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 w-16 rounded bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-20 rounded bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-8 rounded bg-muted" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-24 rounded bg-muted" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-16 rounded bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-muted ml-auto" /></td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <p className="text-amber-400">{error}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchLeads()}>Retry</Button>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center">
                <p className="text-neutral-400 font-medium">No leads found</p>
                <p className="text-sm text-neutral-500 mt-1">Add leads manually or import from Upwork, email, and other sources.</p>
              </td></tr>
            ) : (
              sortedLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/leads/${lead.id}`} className="text-neutral-100 hover:underline font-medium block truncate max-w-[300px]">
                      {lead.title}
                    </Link>
                    {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {lead.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] py-0">{tag}</Badge>
                        ))}
                        {lead.tags.length > 3 && <span className="text-[10px] text-neutral-500">+{lead.tags.length - 3}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-400 hidden sm:table-cell">{lead.source}</td>
                  <td className="px-4 py-3"><Badge variant={statusColors[lead.status] || "default"}>{lead.status}</Badge></td>
                  <td className="px-4 py-3 text-neutral-400">
                    <div className="flex items-center gap-1.5">
                      {lead.score != null ? (
                        <span className={lead.score >= 70 ? "text-emerald-400" : lead.score >= 40 ? "text-amber-400" : "text-neutral-500"}>
                          {lead.score}
                        </span>
                      ) : "—"}
                      {lead.scoreVerdict && (
                        <Badge variant={lead.scoreVerdict === "ACCEPT" ? "success" : lead.scoreVerdict === "MAYBE" ? "warning" : "outline"} className="text-[10px] py-0">
                          {lead.scoreVerdict}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <PipelineProgress lead={lead} />
                  </td>
                  <td className="px-4 py-3 text-neutral-400 hidden lg:table-cell">{lead.budget || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteLead(lead.id)} disabled={deletePending} className="text-neutral-600 hover:text-red-400 transition-colors p-1 disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog {...dialogProps} />
      <FlywheelBatchDialog
        open={flywheelOpen}
        onClose={() => setFlywheelOpen(false)}
        onComplete={() => void fetchLeads()}
      />
    </div>
  );
}
