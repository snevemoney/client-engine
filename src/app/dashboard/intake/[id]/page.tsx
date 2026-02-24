"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { ArrowLeft, Target, FileText, MessageSquare, ExternalLink, Rocket, Send, Calendar, Trophy, XCircle, Phone, Mail, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LeadStatusBadge } from "@/components/intake/LeadStatusBadge";
import { LeadSourceBadge } from "@/components/intake/LeadSourceBadge";
import { LeadScoreBadge } from "@/components/intake/LeadScoreBadge";
import { LeadActivityTimeline } from "@/components/intake/LeadActivityTimeline";
import { FollowupCompleteModal } from "@/components/followup/FollowupCompleteModal";
import { FollowupSnoozeModal } from "@/components/followup/FollowupSnoozeModal";
import { FollowupLogModal } from "@/components/followup/FollowupLogModal";

interface IntakeLead {
  id: string;
  source: string;
  title: string;
  company: string | null;
  contactName: string | null;
  contactEmail: string | null;
  link: string | null;
  summary: string;
  budgetMin: number | null;
  budgetMax: number | null;
  urgency: string;
  status: string;
  score: number | null;
  scoreReason: string | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  promotedLeadId: string | null;
  proposalSentAt: string | null;
  followUpDueAt: string | null;
  outcomeReason: string | null;
  lastContactedAt: string | null;
  followUpCompletedAt: string | null;
  followUpCount: number;
  promotedLead?: { id: string; title: string; status: string } | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  activities?: { id: string; type: string; content: string; createdAt: string }[];
}

const STATUSES = ["new", "qualified", "proposal_drafted", "sent", "won", "lost", "archived"];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function IntakeLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lead, setLead] = useState<IntakeLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [statusEdit, setStatusEdit] = useState("");
  const [nextActionEdit, setNextActionEdit] = useState("");
  const [showEditStatus, setShowEditStatus] = useState(false);
  const [showEditNextAction, setShowEditNextAction] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupAction, setFollowupAction] = useState("");
  const [followupDue, setFollowupDue] = useState("");
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [logModalKind, setLogModalKind] = useState<"call" | "email" | null>(null);

  const fetchLead = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/intake-leads/${id}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to load lead");
        setLead(null);
        return;
      }
      setLead(data);
      setStatusEdit(data?.status ?? "new");
      setNextActionEdit(data?.nextAction ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lead");
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchLead();
  }, [fetchLead]);

  const runAction = async (
    action: string,
    fn: () => Promise<Response>
  ) => {
    setActionLoading(action);
    try {
      const res = await fn();
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : `Action failed (${res.status})`);
        return;
      }
      void fetchLead();
    } finally {
      setActionLoading(null);
    }
  };

  const handleScore = () =>
    runAction("score", () =>
      fetch(`/api/intake-leads/${id}/score`, { method: "POST", credentials: "include" })
    );

  const handleDraft = () =>
    runAction("draft", () =>
      fetch(`/api/intake-leads/${id}/draft`, { method: "POST", credentials: "include" })
    );

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    await runAction("note", () =>
      fetch(`/api/intake-leads/${id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "note", content: noteContent.trim() }),
      })
    );
    setNoteContent("");
  };

  const handleStatusChange = async () => {
    if (!statusEdit || statusEdit === lead?.status) {
      setShowEditStatus(false);
      return;
    }
    await runAction("status", () =>
      fetch(`/api/intake-leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: statusEdit }),
      })
    );
    setShowEditStatus(false);
  };

  const handleNextActionChange = async () => {
    await runAction("nextAction", () =>
      fetch(`/api/intake-leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nextAction: nextActionEdit.trim() || null,
          nextActionDueAt: null,
        }),
      })
    );
    setShowEditNextAction(false);
  };

  const handlePromote = () =>
    runAction("promote", () =>
      fetch(`/api/intake-leads/${id}/promote`, { method: "POST", credentials: "include" })
    );

  const handleMarkSent = () =>
    runAction("markSent", () =>
      fetch(`/api/intake-leads/${id}/mark-sent`, { method: "POST", credentials: "include" })
    );

  const handleSetFollowup = async () => {
    await runAction("setFollowup", () =>
      fetch(`/api/intake-leads/${id}/set-followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nextAction: followupAction.trim() || null,
          followUpDueAt: followupDue.trim() || null,
        }),
      })
    );
    setShowFollowupModal(false);
    setFollowupAction("");
    setFollowupDue("");
  };

  const handleMarkWon = () =>
    runAction("markWon", () =>
      fetch(`/api/intake-leads/${id}/mark-won`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      })
    );

  const handleMarkLost = () =>
    runAction("markLost", () =>
      fetch(`/api/intake-leads/${id}/mark-lost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      })
    );

  const leadAsFollowUpItem = lead
    ? {
        id: lead.id,
        title: lead.title,
        company: lead.company,
        source: lead.source,
        status: lead.status,
        score: lead.score,
        nextAction: lead.nextAction,
        nextActionDueAt: lead.nextActionDueAt,
        followUpDueAt: lead.followUpDueAt,
        promotedLeadId: lead.promotedLeadId,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        lastContactedAt: lead.lastContactedAt ?? null,
        followUpCount: lead.followUpCount ?? 0,
        followUpCompletedAt: lead.followUpCompletedAt ?? null,
      }
    : null;

  const handleCompleteSubmit = async (payload: {
    note?: string;
    nextAction?: string;
    nextActionDueAt?: string;
  }) => {
    await runAction("complete", () =>
      fetch(`/api/intake-leads/${id}/followup-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
    );
    setShowCompleteModal(false);
  };

  const handleSnoozeSubmit = async (payload: {
    snoozeType: "2d" | "5d" | "next_monday" | "custom";
    nextActionDueAt?: string;
    reason?: string;
  }) => {
    await runAction("snooze", () =>
      fetch(`/api/intake-leads/${id}/followup-snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
    );
    setShowSnoozeModal(false);
  };

  const handleLogSubmit = async (payload: {
    note?: string;
    outcome: string;
    nextAction?: string;
    nextActionDueAt?: string;
  }) => {
    const kind = logModalKind;
    if (!kind) return;
    const route =
      kind === "call"
        ? `/api/intake-leads/${id}/followup-log-call`
        : `/api/intake-leads/${id}/followup-log-email`;
    await runAction(kind === "call" ? "logCall" : "logEmail", () =>
      fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
    );
    setLogModalKind(null);
  };

  if (loading && !lead) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/intake" className="text-neutral-400 hover:text-neutral-200 text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Intake
        </Link>
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/intake" className="text-neutral-400 hover:text-neutral-200 text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Intake
        </Link>
        <p className="text-red-400">{error ?? "Lead not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/intake" className="text-neutral-400 hover:text-neutral-200 text-sm flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Intake
      </Link>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <div className="border border-neutral-700 rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <LeadSourceBadge source={lead.source} />
              <LeadStatusBadge status={lead.status} />
              <LeadScoreBadge score={lead.score} />
              {lead.promotedLead && (
                <Link
                  href={`/dashboard/leads/${lead.promotedLead.id}`}
                  className="text-xs text-blue-400 hover:underline"
                >
                  → Pipeline
                </Link>
              )}
              <span className="text-neutral-500 text-sm">
                Created {formatDate(lead.createdAt)}
              </span>
            </div>
            {(lead.proposalSentAt || lead.followUpDueAt || lead.lastContactedAt != null) && (
              <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
                {lead.proposalSentAt && (
                  <span>Sent {formatDate(lead.proposalSentAt)}</span>
                )}
                {lead.followUpDueAt && (
                  <span>Follow-up due {formatDate(lead.followUpDueAt)}</span>
                )}
                {lead.lastContactedAt && (
                  <span>Last contact {formatDate(lead.lastContactedAt)}</span>
                )}
                {(lead.followUpCount ?? 0) > 0 && (
                  <span>{lead.followUpCount} follow-ups</span>
                )}
                {lead.followUpCompletedAt && (
                  <span>Completed {formatDate(lead.followUpCompletedAt)}</span>
                )}
              </div>
            )}
            <h1 className="text-xl font-semibold">{lead.title || "—"}</h1>
            {lead.company && (
              <p className="text-neutral-300">{lead.company}</p>
            )}
            {lead.link && (
              <a
                href={lead.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-4 w-4" /> {lead.link}
              </a>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {lead.contactName && (
                <p><span className="text-neutral-500">Contact:</span> {lead.contactName}</p>
              )}
              {lead.contactEmail && (
                <p><span className="text-neutral-500">Email:</span> {lead.contactEmail}</p>
              )}
              {(lead.budgetMin != null || lead.budgetMax != null) && (
                <p>
                  <span className="text-neutral-500">Budget:</span>{" "}
                  {[lead.budgetMin, lead.budgetMax].filter(Boolean).join(" – ")}
                </p>
              )}
              {lead.urgency && (
                <p><span className="text-neutral-500">Urgency:</span> {lead.urgency}</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-neutral-400 mb-1">Summary</h3>
              <p className="text-neutral-200 whitespace-pre-wrap">{lead.summary || "—"}</p>
            </div>
            {lead.scoreReason && (
              <div>
                <h3 className="text-sm font-medium text-neutral-400 mb-1">Score reason</h3>
                <p className="text-neutral-300 text-sm">{lead.scoreReason}</p>
              </div>
            )}
          </div>

          <div className="border border-neutral-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Activity</h2>
            <LeadActivityTimeline activities={lead.activities ?? []} />
          </div>
        </div>

        <div className="lg:w-80 space-y-4">
          <div className="border border-neutral-700 rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Pipeline</h3>
            {!lead.promotedLeadId && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handlePromote}
                disabled={!!actionLoading}
              >
                <Rocket className="h-4 w-4" />
                {actionLoading === "promote" ? "Promoting…" : "Promote to Pipeline"}
              </Button>
            )}
            {lead.promotedLeadId && lead.promotedLead && (
              <Link href={`/dashboard/leads/${lead.promotedLead.id}`}>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <ExternalLink className="h-4 w-4" />
                  View Pipeline Lead
                </Button>
              </Link>
            )}
            {lead.status !== "sent" && lead.status !== "won" && lead.status !== "lost" && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleMarkSent}
                disabled={!!actionLoading}
              >
                <Send className="h-4 w-4" />
                {actionLoading === "markSent" ? "…" : "Mark Sent"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setShowFollowupModal(true)}
              disabled={!!actionLoading}
            >
              <Calendar className="h-4 w-4" />
              Set Follow-up
            </Button>
            {lead.status !== "won" && lead.status !== "lost" && (
              <>
                <div className="text-xs text-neutral-500 mt-1">Follow-up actions</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-emerald-400 border-emerald-700"
                  onClick={() => setShowCompleteModal(true)}
                  disabled={!!actionLoading}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {actionLoading === "complete" ? "…" : "Complete"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowSnoozeModal(true)}
                  disabled={!!actionLoading}
                >
                  <Clock className="h-4 w-4" />
                  {actionLoading === "snooze" ? "…" : "Snooze"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setLogModalKind("call")}
                  disabled={!!actionLoading}
                >
                  <Phone className="h-4 w-4" />
                  {actionLoading === "logCall" ? "…" : "Log call"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setLogModalKind("email")}
                  disabled={!!actionLoading}
                >
                  <Mail className="h-4 w-4" />
                  {actionLoading === "logEmail" ? "…" : "Log email"}
                </Button>
                <div className="flex gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      const d = new Date();
                      d.setDate(d.getDate() + 2);
                      await runAction("setFollowup", () =>
                        fetch(`/api/intake-leads/${id}/followup-snooze`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ snoozeType: "2d" }),
                        })
                      );
                    }}
                    disabled={!!actionLoading}
                    className="text-xs px-2 py-1 rounded bg-neutral-700/50 hover:bg-neutral-600/50"
                  >
                    +2d
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await runAction("setFollowup", () =>
                        fetch(`/api/intake-leads/${id}/followup-snooze`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ snoozeType: "5d" }),
                        })
                      );
                    }}
                    disabled={!!actionLoading}
                    className="text-xs px-2 py-1 rounded bg-neutral-700/50 hover:bg-neutral-600/50"
                  >
                    +5d
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await runAction("setFollowup", () =>
                        fetch(`/api/intake-leads/${id}/followup-snooze`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ snoozeType: "next_monday" }),
                        })
                      );
                    }}
                    disabled={!!actionLoading}
                    className="text-xs px-2 py-1 rounded bg-neutral-700/50 hover:bg-neutral-600/50"
                  >
                    Mon
                  </button>
                </div>
              </>
            )}
            {lead.status !== "won" && lead.status !== "lost" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-emerald-400 border-emerald-700"
                  onClick={handleMarkWon}
                  disabled={!!actionLoading}
                >
                  <Trophy className="h-4 w-4" />
                  {actionLoading === "markWon" ? "…" : "Mark Won"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-red-400 border-red-700"
                  onClick={handleMarkLost}
                  disabled={!!actionLoading}
                >
                  <XCircle className="h-4 w-4" />
                  {actionLoading === "markLost" ? "…" : "Mark Lost"}
                </Button>
              </>
            )}
          </div>

          <div className="border border-neutral-700 rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Actions</h3>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={handleScore}
              disabled={!!actionLoading}
            >
              <Target className="h-4 w-4" />
              {actionLoading === "score" ? "Scoring…" : "Score Lead"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={handleDraft}
              disabled={!!actionLoading}
            >
              <FileText className="h-4 w-4" />
              {actionLoading === "draft" ? "Generating…" : "Draft Proposal"}
            </Button>
          </div>

          <div className="border border-neutral-700 rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Status</h3>
            {showEditStatus ? (
              <div className="space-y-2">
                <select
                  value={statusEdit}
                  onChange={(e) => setStatusEdit(e.target.value)}
                  className="w-full rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleStatusChange}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowEditStatus(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <LeadStatusBadge status={lead.status} />
                <Button size="sm" variant="ghost" onClick={() => setShowEditStatus(true)}>Change</Button>
              </div>
            )}
          </div>

          <div className="border border-neutral-700 rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Next Action</h3>
            {showEditNextAction ? (
              <div className="space-y-2">
                <Input
                  value={nextActionEdit}
                  onChange={(e) => setNextActionEdit(e.target.value)}
                  placeholder="What's the next step?"
                  className="bg-neutral-800 border-neutral-600"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleNextActionChange}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowEditNextAction(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-neutral-300 mb-2">{lead.nextAction || "—"}</p>
                <Button size="sm" variant="ghost" onClick={() => setShowEditNextAction(true)}>Edit</Button>
              </div>
            )}
          </div>

          <div className="border border-neutral-700 rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Add Note</h3>
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              className="bg-neutral-800 border-neutral-600 resize-none"
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!noteContent.trim() || !!actionLoading}
            >
              <MessageSquare className="h-4 w-4" />
              Add Note
            </Button>
          </div>
        </div>
      </div>

      {showFollowupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
            <h3 className="font-medium mb-3">Set Follow-up</h3>
            <Input
              value={followupAction}
              onChange={(e) => setFollowupAction(e.target.value)}
              placeholder="What to do next?"
              className="mb-3 bg-neutral-800 border-neutral-600"
            />
            <Input
              type="datetime-local"
              value={followupDue}
              onChange={(e) => setFollowupDue(e.target.value)}
              placeholder="Due date"
              className="mb-4 bg-neutral-800 border-neutral-600"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowFollowupModal(false)}>Cancel</Button>
              <Button onClick={handleSetFollowup}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && lead && (
        <FollowupCompleteModal
          item={leadAsFollowUpItem!}
          onClose={() => setShowCompleteModal(false)}
          onSubmit={handleCompleteSubmit}
          loading={actionLoading === "complete"}
        />
      )}
      {showSnoozeModal && lead && (
        <FollowupSnoozeModal
          item={leadAsFollowUpItem!}
          onClose={() => setShowSnoozeModal(false)}
          onSubmit={handleSnoozeSubmit}
          loading={actionLoading === "snooze"}
        />
      )}
      {logModalKind && lead && (
        <FollowupLogModal
          item={leadAsFollowUpItem!}
          kind={logModalKind}
          onClose={() => setLogModalKind(null)}
          onSubmit={handleLogSubmit}
          loading={actionLoading === "logCall" || actionLoading === "logEmail"}
        />
      )}
    </div>
  );
}
