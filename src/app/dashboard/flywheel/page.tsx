"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

/* ─── Types ───────────────────────────────────────────────────────── */

type FlywheelStep = {
  step: string;
  status: "ok" | "skipped" | "error";
  detail: string;
  reasoning: string;
  durationMs: number;
};

type FlywheelResult = {
  ok: boolean;
  steps: FlywheelStep[];
  leadId: string | null;
  proposalId: string | null;
  deliveryProjectId: string | null;
  builderSiteId: string | null;
  totalDurationMs: number;
};

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

/* ─── Constants ───────────────────────────────────────────────────── */

const STEP_LABELS: Record<string, string> = {
  create_lead: "Create Lead",
  load_lead: "Load Lead",
  pipeline: "AI Pipeline",
  create_proposal: "Create Proposal",
  send_proposal: "Send Proposal",
  accept_and_create_project: "Accept & Create Project",
  trigger_builder: "Build Website",
  complete: "Complete",
  post_hooks: "System Cascade",
};

const PRESETS = [
  { value: "custom", label: "Custom" },
  { value: "health_coaching", label: "Health Coaching" },
  { value: "consulting", label: "Consulting" },
  { value: "fitness", label: "Fitness" },
  { value: "agency", label: "Agency" },
  { value: "freelance", label: "Freelance" },
];

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
        className={`relative w-10 h-5 rounded-full transition-colors ${
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

/* ─── Batch Run Dialog ────────────────────────────────────────────── */

function BatchRunDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [autoSend, setAutoSend] = useState(false);
  const [autoBuild, setAutoBuild] = useState(false);
  const [leads, setLeads] = useState<PreviewLead[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [running, setRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/flywheel/batch", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads ?? []);
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
          autoBuild: autoBuild,
        }),
      });
      setBatchResult(data);
      if (data.ok) {
        toast.success(
          `Batch complete: ${data.succeeded}/${data.total} succeeded`
        );
      } else {
        toast.error(
          `Batch complete with errors: ${data.failed}/${data.total} failed`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch run failed");
    } finally {
      setRunning(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Run from Prospect List
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Run the flywheel on all eligible leads
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
          {/* Preview: eligible leads */}
          <div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Eligible Prospects
            </p>
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading prospects...
              </div>
            ) : leads.length === 0 ? (
              <p className="text-sm text-neutral-500 py-3">
                No eligible leads found (status NEW/APPROVED, no proposal yet)
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-neutral-800 divide-y divide-neutral-800">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-200 truncate">
                        {lead.title}
                      </p>
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
                {leads.length} prospect{leads.length !== 1 ? "s" : ""} will be
                processed
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

          {/* Batch results */}
          {batchResult && (
            <div
              className={`rounded-lg border p-3 ${
                batchResult.ok
                  ? "border-emerald-500/30 bg-emerald-950/20"
                  : "border-red-500/30 bg-red-950/20"
              }`}
            >
              <p
                className={`text-sm font-medium ${batchResult.ok ? "text-emerald-300" : "text-red-300"}`}
              >
                {batchResult.succeeded}/{batchResult.total} succeeded
                {batchResult.failed > 0 &&
                  ` · ${batchResult.failed} failed`}
              </p>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                {batchResult.results.map((r) => (
                  <div
                    key={r.leadId}
                    className="flex items-center gap-2 text-xs"
                  >
                    {r.ok ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                    )}
                    <span className="text-neutral-300 truncate">
                      {r.title}
                    </span>
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
                  Running {leads.length} prospect
                  {leads.length !== 1 ? "s" : ""}...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Run {leads.length} prospect{leads.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function FlywheelPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FlywheelResult | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRunning(true);
    setResult(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      title: fd.get("title"),
      source: fd.get("source") || "manual",
      contactName: fd.get("contactName") || undefined,
      contactEmail: fd.get("contactEmail") || undefined,
      company: fd.get("company") || undefined,
      budget: fd.get("budget") || undefined,
      timeline: fd.get("timeline") || undefined,
      description: fd.get("description") || undefined,
      builderPreset: fd.get("builderPreset") || "custom",
      contentHints: fd.get("contentHints") || undefined,
      tags:
        (fd.get("tags") as string)
          ?.split(",")
          .map((t) => t.trim())
          .filter(Boolean) || [],
    };

    try {
      const data = await fetchJsonThrow<FlywheelResult>(
        "/api/flywheel/trigger",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      setResult(data);
      if (data.ok) {
        toast.success("Flywheel completed successfully");
      } else {
        toast.error("Flywheel completed with errors");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Flywheel failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Flywheel
          </h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            Enter a prospect and the AI runs the full pipeline: qualify, propose,
            accept, deliver, and build the website.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBatchOpen(true)}
          disabled={running}
          className="gap-2 shrink-0"
        >
          <Users className="w-4 h-4" />
          Run from Prospect List
        </Button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="fw-title" className="text-sm font-medium">
              Prospect / Business Name *
            </label>
            <Input
              id="fw-title"
              name="title"
              required
              placeholder="e.g. Sophie Lavoie — Hair Salon"
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Source</label>
            <Input
              name="source"
              placeholder="instagram, upwork, referral..."
              defaultValue="manual"
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Company</label>
            <Input
              name="company"
              placeholder="Business name"
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact Name</label>
            <Input name="contactName" disabled={running} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact Email</label>
            <Input name="contactEmail" type="email" disabled={running} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Budget</label>
            <Input
              name="budget"
              placeholder="$2,000-$5,000"
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Timeline</label>
            <Input
              name="timeline"
              placeholder="2-4 weeks"
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Website Preset</label>
            <select
              name="builderPreset"
              className="flex h-9 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-sm text-neutral-100"
              disabled={running}
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tags</label>
            <Input
              name="tags"
              placeholder="web, design, coaching (comma-separated)"
              disabled={running}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              name="description"
              rows={3}
              placeholder="What does this prospect need?"
              disabled={running}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">
              Content Hints (for AI website copy)
            </label>
            <Textarea
              name="contentHints"
              rows={3}
              placeholder="Bio, niche, services, target audience — the more context, the better the website copy"
              disabled={running}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={running} className="gap-2">
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Running Pipeline...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> Launch Flywheel
              </>
            )}
          </Button>
          <Link href="/dashboard">
            <Button type="button" variant="outline" disabled={running}>
              Cancel
            </Button>
          </Link>
        </div>
      </form>

      {/* Results */}
      {result && (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <div
            className={`px-4 py-3 text-sm font-medium ${result.ok ? "bg-emerald-950/40 text-emerald-300" : "bg-red-950/40 text-red-300"}`}
          >
            {result.ok
              ? "Flywheel completed successfully"
              : "Flywheel completed with errors"}{" "}
            — {(result.totalDurationMs / 1000).toFixed(1)}s
          </div>

          {/* Steps */}
          <div className="divide-y divide-neutral-800">
            {result.steps.map((step, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  {step.status === "ok" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : step.status === "error" ? (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 text-neutral-500 shrink-0">
                      —
                    </span>
                  )}
                  <span className="font-medium text-neutral-200">
                    {STEP_LABELS[step.step] ?? step.step}
                  </span>
                  <span className="text-neutral-500 text-xs ml-auto">
                    {(step.durationMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1 ml-6">
                  {step.detail}
                </p>
                {step.reasoning && (
                  <p className="text-xs text-neutral-500 mt-1 ml-6 italic">
                    {step.reasoning}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div className="px-4 py-3 border-t border-neutral-800 flex flex-wrap gap-3">
            {result.leadId && (
              <Link
                href={`/dashboard/leads/${result.leadId}`}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                View Lead <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            {result.proposalId && (
              <Link
                href={`/dashboard/proposals/${result.proposalId}`}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                View Proposal <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            {result.deliveryProjectId && (
              <Link
                href={`/dashboard/delivery/${result.deliveryProjectId}`}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                View Delivery & Website <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Batch Run Dialog */}
      <BatchRunDialog open={batchOpen} onClose={() => setBatchOpen(false)} />
    </div>
  );
}
