"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Search,
  MessageSquare,
  Star,
  Users,
  Phone,
  Mail,
  Clock,
  ChevronDown,
  Loader2,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AsyncState } from "@/components/ui/AsyncState";
import { formatDateSafe } from "@/lib/ui/date-safe";
import { useBrainPanel } from "@/contexts/BrainPanelContext";


type RetentionItem = {
  id: string;
  title: string;
  clientName: string | null;
  company: string | null;
  status: string;
  completedAt: string | null;
  handoffCompletedAt: string | null;
  testimonialRequestedAt: string | null;
  testimonialReceivedAt: string | null;
  testimonialStatus: string;
  reviewRequestedAt: string | null;
  reviewReceivedAt: string | null;
  referralRequestedAt: string | null;
  referralReceivedAt: string | null;
  referralStatus: string;
  retentionStatus: string;
  retentionBucket: string;
  retentionNextFollowUpAt: string | null;
  retentionLastContactedAt: string | null;
  retentionFollowUpCount: number;
  upsellOpportunity: string | null;
  upsellValueEstimate: number | null;
  isStale: boolean;
};

type Summary = {
  dueToday: number;
  overdue: number;
  upcoming: number;
  testimonialRequested: number;
  testimonialReceived: number;
  reviewRequested: number;
  reviewReceived: number;
  referralRequested: number;
  referralReceived: number;
  retainerOpen: number;
  upsellOpen: number;
  closedWon: number;
  closedLost: number;
  stalePostDelivery: number;
};

function bucketColor(b: string): string {
  if (b === "overdue") return "text-red-400 border-red-800/50 bg-red-950/20";
  if (b === "today") return "text-amber-400 border-amber-800/50 bg-amber-950/20";
  if (b === "upcoming") return "text-blue-400 border-blue-800/50 bg-blue-950/20";
  return "text-neutral-500 border-neutral-700 bg-neutral-900/30";
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RetentionPage() {
  const [items, setItems] = useState<RetentionItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState("all");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const { setPageData } = useBrainPanel();

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (bucketFilter !== "all") params.set("bucket", bucketFilter);
      const [res, contextRes] = await Promise.all([
        fetch(`/api/delivery-projects/retention-queue?${params}`, { credentials: "include", signal: controller.signal, cache: "no-store" }),
        fetch("/api/internal/retention/context", { credentials: "include", signal: controller.signal, cache: "no-store" }),
      ]);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error ?? `Retention queue failed (${res.status})`);
      }
      const json = await res.json().catch(() => null);
      const ctx = contextRes.ok ? await contextRes.json().catch(() => null) : null;
      const sumJson = ctx?.summary ?? null;
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      setItems(Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []));
      setSummary(sumJson && typeof sumJson === "object" ? sumJson : null);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
      setSummary(null);
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [debouncedSearch, statusFilter, bucketFilter]);

  useEffect(() => {
    void fetchData();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchData]);

  useEffect(() => {
    if (loading || !summary) return;
    setPageData(
      `Retention: ${summary.overdue} overdue, ${summary.dueToday} due today, ${summary.upcoming} upcoming, ${summary.upsellOpen} upsell open, ${summary.stalePostDelivery} stale. ${items.length} items shown.`
    );
  }, [summary, items.length, loading, setPageData]);

  const runAction = async (id: string, action: string, endpoint: string) => {
    setActionLoading(`${id}:${action}`);
    try {
      const res = await fetch(`/api/delivery-projects/${id}${endpoint}`, { method: "POST" });
      if (res.ok) {
        toast.success(`${action} done`);
        void fetchData();
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? `${action} failed`);
      }
    } catch {
      toast.error(`${action} failed`);
    } finally {
      setActionLoading(null);
    }
  };

  const isActioning = (id: string, action: string) => actionLoading === `${id}:${action}`;

  const s = summary ?? {
    dueToday: 0, overdue: 0, upcoming: 0,
    testimonialRequested: 0, testimonialReceived: 0,
    reviewRequested: 0, reviewReceived: 0,
    referralRequested: 0, referralReceived: 0,
    retainerOpen: 0, upsellOpen: 0,
    closedWon: 0, closedLost: 0, stalePostDelivery: 0,
  };

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Retention</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Follow up with delivered projects — get testimonials, reviews, referrals, and upsell.
        </p>
      </div>


      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {([
          { label: "Overdue", value: s.overdue, color: "text-red-400", filter: "overdue" },
          { label: "Due today", value: s.dueToday, color: "text-amber-400", filter: "today" },
          { label: "Upcoming", value: s.upcoming, color: "text-blue-400", filter: "upcoming" },
          { label: "Testimonials", value: s.testimonialReceived, sub: `${s.testimonialRequested} asked`, color: "text-emerald-400" },
          { label: "Reviews", value: s.reviewReceived, sub: `${s.reviewRequested} asked`, color: "text-emerald-400" },
          { label: "Referrals", value: s.referralReceived, sub: `${s.referralRequested} asked`, color: "text-emerald-400" },
          { label: "Stale", value: s.stalePostDelivery, color: "text-neutral-500" },
        ] as const).map((stat) => (
          <button
            key={stat.label}
            onClick={() => "filter" in stat && stat.filter ? setBucketFilter(stat.filter === bucketFilter ? "all" : stat.filter) : undefined}
            className={`rounded-lg border p-2.5 text-left transition-colors ${
              "filter" in stat && stat.filter === bucketFilter
                ? "border-neutral-600 bg-neutral-800/60"
                : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-700"
            }`}
          >
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider truncate">{stat.label}</p>
            <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
            {"sub" in stat && stat.sub && <p className="text-[10px] text-neutral-600">{stat.sub}</p>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value)}
            className="flex-1 sm:flex-none rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
          >
            <option value="all">All timing</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="upcoming">Upcoming</option>
            <option value="none">No follow-up set</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
          >
            <option value="all">All status</option>
            <option value="none">New</option>
            <option value="monitoring">Monitoring</option>
            <option value="followup_due">Follow-up due</option>
            <option value="upsell_open">Upsell open</option>
            <option value="retainer_open">Retainer open</option>
            <option value="closed_won">Won</option>
            <option value="closed_lost">Lost</option>
          </select>
        </div>
      </div>

      {/* List */}
      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyMessage="No projects in retention queue. Completed projects will appear here automatically."
        onRetry={fetchData}
      >
        <div className="space-y-2">
          {items.map((p) => {
            const isExpanded = expandedId === p.id;
            const name = p.clientName || p.company || "Client";
            return (
              <div
                key={p.id}
                className={`rounded-lg border transition-colors ${
                  p.isStale ? "border-amber-900/40 bg-amber-950/5" : "border-neutral-800 bg-neutral-900/30"
                }`}
              >
                {/* Main row */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/dashboard/delivery/${p.id}`}
                          className="font-medium text-neutral-100 hover:text-white hover:underline truncate"
                        >
                          {p.title || "Untitled"}
                        </Link>
                        <Badge variant="outline" className={`text-[10px] ${bucketColor(p.retentionBucket)}`}>
                          {p.retentionBucket === "none" ? "no follow-up" : p.retentionBucket}
                        </Badge>
                        {p.isStale && (
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                            <AlertTriangle className="w-3 h-3" /> stale
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {name}
                        {p.retentionNextFollowUpAt && (
                          <> · Next: {formatDateSafe(p.retentionNextFollowUpAt, { month: "short", day: "numeric" })}</>
                        )}
                        {p.retentionFollowUpCount > 0 && (
                          <> · {p.retentionFollowUpCount} follow-ups</>
                        )}
                      </p>

                      {/* Proof status chips */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <ProofChip
                          icon={<MessageSquare className="w-3 h-3" />}
                          label="Testimonial"
                          requested={!!p.testimonialRequestedAt}
                          received={!!p.testimonialReceivedAt}
                        />
                        <ProofChip
                          icon={<Star className="w-3 h-3" />}
                          label="Review"
                          requested={!!p.reviewRequestedAt}
                          received={!!p.reviewReceivedAt}
                        />
                        <ProofChip
                          icon={<Users className="w-3 h-3" />}
                          label="Referral"
                          requested={!!p.referralRequestedAt}
                          received={!!p.referralReceivedAt}
                        />
                        {p.upsellOpportunity && (
                          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                            Upsell: {p.upsellOpportunity}
                            {p.upsellValueEstimate != null && ` ($${p.upsellValueEstimate.toLocaleString()})`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {statusLabel(p.retentionStatus || "none")}
                      </Badge>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="p-1 hover:bg-neutral-800 rounded transition-colors"
                      >
                        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded actions */}
                {isExpanded && (
                  <div className="border-t border-neutral-800 px-4 py-3 bg-neutral-900/40">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Testimonial */}
                      <ActionGroup title="Testimonial" status={p.testimonialReceivedAt ? "received" : p.testimonialRequestedAt ? "requested" : "none"}>
                        {!p.testimonialRequestedAt && (
                          <ActionButton
                            label="Request"
                            loading={isActioning(p.id, "testimonial-request")}
                            disabled={!!actionLoading}
                            onClick={() => runAction(p.id, "testimonial-request", "/testimonial/request")}
                          />
                        )}
                        {p.testimonialRequestedAt && !p.testimonialReceivedAt && (
                          <ActionButton
                            label="Mark received"
                            loading={isActioning(p.id, "testimonial-receive")}
                            disabled={!!actionLoading}
                            onClick={() => runAction(p.id, "testimonial-receive", "/testimonial/receive")}
                            variant="success"
                          />
                        )}
                      </ActionGroup>

                      {/* Review */}
                      <ActionGroup title="Review" status={p.reviewReceivedAt ? "received" : p.reviewRequestedAt ? "requested" : "none"}>
                        {!p.reviewRequestedAt && (
                          <ActionButton
                            label="Request"
                            loading={isActioning(p.id, "review-request")}
                            disabled={!!actionLoading}
                            onClick={() => runAction(p.id, "review-request", "/review/request")}
                          />
                        )}
                        {p.reviewRequestedAt && !p.reviewReceivedAt && (
                          <ActionButton
                            label="Mark received"
                            loading={isActioning(p.id, "review-receive")}
                            disabled={!!actionLoading}
                            onClick={() => runAction(p.id, "review-receive", "/review/receive")}
                            variant="success"
                          />
                        )}
                      </ActionGroup>

                      {/* Referral */}
                      <ActionGroup title="Referral" status={p.referralReceivedAt ? "received" : p.referralRequestedAt ? "requested" : "none"}>
                        {!p.referralRequestedAt && (
                          <ActionButton
                            label="Request"
                            loading={isActioning(p.id, "referral-request")}
                            disabled={!!actionLoading}
                            onClick={() => runAction(p.id, "referral-request", "/referral/request")}
                          />
                        )}
                        {p.referralRequestedAt && !p.referralReceivedAt && (
                          <ActionButton
                            label="Mark received"
                            loading={isActioning(p.id, "referral-receive")}
                            disabled={!!actionLoading}
                            onClick={() => runAction(p.id, "referral-receive", "/referral/receive")}
                            variant="success"
                          />
                        )}
                      </ActionGroup>

                      {/* Follow-up */}
                      <ActionGroup title="Follow-up" status={p.retentionLastContactedAt ? "active" : "none"}>
                        <div className="flex gap-1.5">
                          <ActionButton
                            label="Call"
                            icon={<Phone className="w-3 h-3" />}
                            loading={isActioning(p.id, "log-call")}
                            disabled={!!actionLoading}
                            onClick={() => runAction(p.id, "log-call", "/retention/log-call")}
                          />
                          <ActionButton
                            label="Email"
                            icon={<Mail className="w-3 h-3" />}
                            loading={isActioning(p.id, "log-email")}
                            disabled={!!actionLoading}
                            onClick={() => runAction(p.id, "log-email", "/retention/log-email")}
                          />
                          <ActionButton
                            label="Snooze"
                            icon={<Clock className="w-3 h-3" />}
                            loading={isActioning(p.id, "snooze")}
                            disabled={!!actionLoading}
                            onClick={() => runAction(p.id, "snooze", "/retention/snooze")}
                          />
                        </div>
                        {p.retentionLastContactedAt && (
                          <p className="text-[10px] text-neutral-600 mt-1">
                            Last: {formatDateSafe(p.retentionLastContactedAt, { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </ActionGroup>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-neutral-800/50">
                      <Link href={`/dashboard/delivery/${p.id}`}>
                        <Button variant="outline" size="sm" className="text-xs">
                          Open project
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AsyncState>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────── */

function ProofChip({
  icon,
  label,
  requested,
  received,
}: {
  icon: React.ReactNode;
  label: string;
  requested: boolean;
  received: boolean;
}) {
  const status = received ? "received" : requested ? "asked" : "none";
  const colors = {
    received: "text-emerald-400 bg-emerald-950/30 border-emerald-800/30",
    asked: "text-amber-400 bg-amber-950/30 border-amber-800/30",
    none: "text-neutral-600 bg-neutral-900/30 border-neutral-800/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${colors[status]}`}>
      {icon}
      {label}
      {received && <Check className="w-2.5 h-2.5" />}
      {!received && requested && <span>?</span>}
    </span>
  );
}

function ActionGroup({
  title,
  status,
  children,
}: {
  title: string;
  status: "none" | "requested" | "received" | "active";
  children: React.ReactNode;
}) {
  const dot = {
    none: "bg-neutral-700",
    requested: "bg-amber-500",
    received: "bg-emerald-500",
    active: "bg-blue-500",
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dot[status]}`} />
        <span className="text-xs font-medium text-neutral-400">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ActionButton({
  label,
  icon,
  loading,
  disabled,
  onClick,
  variant,
}: {
  label: string;
  icon?: React.ReactNode;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  variant?: "success";
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={`text-xs h-7 ${
        variant === "success"
          ? "text-emerald-400 border-emerald-800/50 hover:bg-emerald-950/30"
          : ""
      }`}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </Button>
  );
}
