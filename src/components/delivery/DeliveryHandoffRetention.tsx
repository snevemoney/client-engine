"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Project = {
  id: string;
  status: string;
  handoffStartedAt: string | null;
  handoffCompletedAt: string | null;
  handoffOwner: string | null;
  handoffSummary: string | null;
  clientConfirmedAt: string | null;
  testimonialRequestedAt: string | null;
  testimonialReceivedAt: string | null;
  testimonialStatus: string;
  testimonialQuote: string | null;
  testimonialSourceUrl: string | null;
  reviewRequestedAt: string | null;
  reviewReceivedAt: string | null;
  reviewPlatform: string | null;
  reviewUrl: string | null;
  referralRequestedAt: string | null;
  referralReceivedAt: string | null;
  referralStatus: string;
  referralNotes: string | null;
  retentionStatus: string;
  retentionNextFollowUpAt: string | null;
  retentionLastContactedAt: string | null;
  retentionFollowUpCount: number;
  retentionOutcome: string | null;
  upsellOpportunity: string | null;
  upsellValueEstimate: number | null;
  postDeliveryHealth: string;
};

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

export function DeliveryHandoffRetention({
  project,
  onReload,
}: {
  project: Project;
  onReload: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showCompleteHandoff, setShowCompleteHandoff] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [showReceiveTestimonial, setShowReceiveTestimonial] = useState(false);
  const [showReceiveReview, setShowReceiveReview] = useState(false);
  const [showReceiveReferral, setShowReceiveReferral] = useState(false);
  const [showCompleteRetention, setShowCompleteRetention] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);

  const [handoffSummary, setHandoffSummary] = useState("");
  const [handoffOwner, setHandoffOwner] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [snoozePreset, setSnoozePreset] = useState<"7d" | "14d" | "30d" | "next_month" | "custom">("7d");
  const [customDate, setCustomDate] = useState("");
  const [testimonialQuote, setTestimonialQuote] = useState("");
  const [testimonialSourceUrl, setTestimonialSourceUrl] = useState("");
  const [reviewPlatform, setReviewPlatform] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [referralNotes, setReferralNotes] = useState("");
  const [retentionOutcome, setRetentionOutcome] = useState("");
  const [retentionStatus, setRetentionStatus] = useState("");
  const [upsellOpportunity, setUpsellOpportunity] = useState("");
  const [upsellValueEstimate, setUpsellValueEstimate] = useState("");
  const [clientConfirmNote, setClientConfirmNote] = useState("");

  const run = async (action: string, fn: () => Promise<Response>) => {
    setLoading(action);
    try {
      const res = await fn();
      if (res.ok) onReload();
      else {
        const d = await res.json();
        alert(d?.error ?? "Action failed");
      }
    } finally {
      setLoading(null);
    }
  };

  const handleStartHandoff = () =>
    run("handoff-start", () =>
      fetch(`/api/delivery-projects/${project.id}/handoff/start`, { method: "POST" })
    );

  const handleCompleteHandoff = () =>
    run("handoff-complete", () =>
      fetch(`/api/delivery-projects/${project.id}/handoff/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handoffSummary: handoffSummary || null, handoffOwner: handoffOwner || null }),
      })
    );

  const handleClientConfirm = () =>
    run("client-confirm", () =>
      fetch(`/api/delivery-projects/${project.id}/client-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: clientConfirmNote || null }),
      })
    );

  const handleTestimonialRequest = () =>
    run("testimonial-request", () =>
      fetch(`/api/delivery-projects/${project.id}/testimonial/request`, { method: "POST" })
    );

  const handleTestimonialReceive = () =>
    run("testimonial-receive", () =>
      fetch(`/api/delivery-projects/${project.id}/testimonial/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: testimonialQuote || null, sourceUrl: testimonialSourceUrl || null }),
      })
    );

  const handleTestimonialDecline = () =>
    run("testimonial-decline", () =>
      fetch(`/api/delivery-projects/${project.id}/testimonial/decline`, { method: "POST" })
    );

  const handleReviewRequest = () =>
    run("review-request", () =>
      fetch(`/api/delivery-projects/${project.id}/review/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: reviewPlatform || null }),
      })
    );

  const handleReviewReceive = () =>
    run("review-receive", () =>
      fetch(`/api/delivery-projects/${project.id}/review/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: reviewPlatform || null, reviewUrl: reviewUrl || null }),
      })
    );

  const handleReferralRequest = () =>
    run("referral-request", () =>
      fetch(`/api/delivery-projects/${project.id}/referral/request`, { method: "POST" })
    );

  const handleReferralReceive = () =>
    run("referral-receive", () =>
      fetch(`/api/delivery-projects/${project.id}/referral/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: referralNotes || null }),
      })
    );

  const handleReferralDecline = () =>
    run("referral-decline", () =>
      fetch(`/api/delivery-projects/${project.id}/referral/decline`, { method: "POST" })
    );

  const handleRetentionSchedule = () =>
    run("retention-schedule", () =>
      fetch(`/api/delivery-projects/${project.id}/retention/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextFollowUpAt: new Date(scheduleDate).toISOString() }),
      })
    );

  const handleRetentionSnooze = () =>
    run("retention-snooze", () =>
      fetch(`/api/delivery-projects/${project.id}/retention/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset: snoozePreset,
          customDate: snoozePreset === "custom" ? customDate || undefined : undefined,
        }),
      })
    );

  const handleLogEmail = () =>
    run("log-email", () =>
      fetch(`/api/delivery-projects/${project.id}/retention/log-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

  const handleLogCall = () =>
    run("log-call", () =>
      fetch(`/api/delivery-projects/${project.id}/retention/log-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

  const handleRetentionComplete = () =>
    run("retention-complete", () =>
      fetch(`/api/delivery-projects/${project.id}/retention/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: retentionOutcome || null,
          retentionStatus: retentionStatus || undefined,
          upsellOpportunity: upsellOpportunity || undefined,
          upsellValueEstimate: upsellValueEstimate ? parseInt(upsellValueEstimate, 10) : undefined,
        }),
      })
    );

  const handleRetentionStatus = () =>
    run("retention-status", () =>
      fetch(`/api/delivery-projects/${project.id}/retention/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionStatus: retentionStatus }),
      })
    );

  const handleUpsell = () =>
    run("upsell", () =>
      fetch(`/api/delivery-projects/${project.id}/upsell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upsellOpportunity,
          upsellValueEstimate: upsellValueEstimate ? parseInt(upsellValueEstimate, 10) : undefined,
        }),
      })
    );

  const isCompleted = project.status === "completed" || project.status === "archived";
  if (!isCompleted) return null;

  const Modal = ({
    title,
    children,
    onClose,
  }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
        <h3 className="font-medium mb-3">{title}</h3>
        {children}
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border border-neutral-800 p-4 space-y-6">
      <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Handoff & Retention</h2>

      {/* Handoff */}
      <div>
        <h3 className="text-sm font-medium mb-2">Handoff</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {project.handoffStartedAt && <Badge variant="outline">Started</Badge>}
          {project.handoffCompletedAt && <Badge variant="outline" className="text-emerald-400">Completed</Badge>}
          {project.clientConfirmedAt && <Badge variant="outline" className="text-emerald-400">Client Confirmed</Badge>}
        </div>
        {project.handoffOwner && <p className="text-sm text-neutral-400 mb-1">Owner: {project.handoffOwner}</p>}
        {project.handoffSummary && <p className="text-sm text-neutral-300 mb-2">{project.handoffSummary}</p>}
        <div className="flex flex-wrap gap-2">
          {!project.handoffStartedAt && (
            <Button size="sm" onClick={handleStartHandoff} disabled={!!loading}>
              {loading === "handoff-start" ? "…" : "Start Handoff"}
            </Button>
          )}
          {project.handoffStartedAt && !project.handoffCompletedAt && (
            <Button size="sm" onClick={() => setShowCompleteHandoff(true)}>Complete Handoff</Button>
          )}
          {project.handoffCompletedAt && !project.clientConfirmedAt && (
            <Button size="sm" onClick={() => setShowCompleteHandoff(true)}>Mark Client Confirmed</Button>
          )}
        </div>
      </div>

      {/* Testimonial / Review / Referral */}
      <div>
        <h3 className="text-sm font-medium mb-2">Testimonial / Review / Referral</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline" className="capitalize">{project.testimonialStatus.replace(/_/g, " ")}</Badge>
          <Badge variant="outline" className="capitalize">{project.referralStatus.replace(/_/g, " ")}</Badge>
        </div>
        {project.testimonialQuote && <p className="text-sm text-neutral-300 mb-1 italic">&quot;{project.testimonialQuote}&quot;</p>}
        {project.testimonialSourceUrl && (
          <a href={project.testimonialSourceUrl} target="_blank" rel="noreferrer" className="text-sm text-emerald-400 hover:underline block mb-2">
            Source
          </a>
        )}
        {project.reviewUrl && (
          <a href={project.reviewUrl} target="_blank" rel="noreferrer" className="text-sm text-emerald-400 hover:underline block mb-2">
            Review: {project.reviewPlatform ?? "Review"}
          </a>
        )}
        {project.referralNotes && <p className="text-sm text-neutral-400 mb-2">{project.referralNotes}</p>}
        <div className="flex flex-wrap gap-2">
          {project.testimonialStatus === "none" && (
            <Button size="sm" variant="outline" onClick={handleTestimonialRequest} disabled={!!loading}>
              Request Testimonial
            </Button>
          )}
          {project.testimonialStatus === "requested" && (
            <>
              <Button size="sm" onClick={() => setShowReceiveTestimonial(true)}>Receive Testimonial</Button>
              <Button size="sm" variant="outline" onClick={handleTestimonialDecline}>Declined</Button>
            </>
          )}
          {!project.reviewRequestedAt && (
            <Button size="sm" variant="outline" onClick={handleReviewRequest} disabled={!!loading}>
              Request Review
            </Button>
          )}
          {project.reviewRequestedAt && !project.reviewReceivedAt && (
            <Button size="sm" onClick={() => setShowReceiveReview(true)}>Receive Review</Button>
          )}
          {project.referralStatus === "none" && (
            <Button size="sm" variant="outline" onClick={handleReferralRequest} disabled={!!loading}>
              Request Referral
            </Button>
          )}
          {project.referralStatus === "requested" && (
            <>
              <Button size="sm" onClick={() => setShowReceiveReferral(true)}>Receive Referral</Button>
              <Button size="sm" variant="outline" onClick={handleReferralDecline}>Declined</Button>
            </>
          )}
        </div>
      </div>

      {/* Retention / Upsell */}
      <div>
        <h3 className="text-sm font-medium mb-2">Retention / Upsell</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline" className="capitalize">{project.retentionStatus.replace(/_/g, " ")}</Badge>
          <Badge
            variant="outline"
            className={
              project.postDeliveryHealth === "red"
                ? "text-red-400"
                : project.postDeliveryHealth === "yellow"
                  ? "text-amber-400"
                  : "text-emerald-400"
            }
          >
            {project.postDeliveryHealth}
          </Badge>
        </div>
        <p className="text-sm text-neutral-400 mb-1">
          Next: {formatDate(project.retentionNextFollowUpAt)} · Last: {formatDate(project.retentionLastContactedAt)} · Count: {project.retentionFollowUpCount ?? 0}
        </p>
        {project.upsellOpportunity && (
          <p className="text-sm text-neutral-300 mb-2">
            Upsell: {project.upsellOpportunity}
            {project.upsellValueEstimate != null && ` ($${project.upsellValueEstimate})`}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSchedule(true)}>Schedule Follow-up</Button>
          <Button size="sm" variant="outline" onClick={() => setShowSnooze(true)}>Snooze</Button>
          <Button size="sm" variant="outline" onClick={handleLogEmail} disabled={!!loading}>Log Email</Button>
          <Button size="sm" variant="outline" onClick={handleLogCall} disabled={!!loading}>Log Call</Button>
          <Button size="sm" onClick={() => setShowCompleteRetention(true)}>Complete Follow-up</Button>
          <Button size="sm" variant="outline" onClick={() => setShowUpsell(true)}>Log Upsell</Button>
        </div>
      </div>

      {/* Modals */}
      {showCompleteHandoff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
            <h3 className="font-medium mb-3">
              {project.handoffCompletedAt ? "Mark Client Confirmed" : "Complete Handoff"}
            </h3>
            {!project.handoffCompletedAt && (
              <>
                <Input
                  value={handoffSummary}
                  onChange={(e) => setHandoffSummary(e.target.value)}
                  placeholder="Handoff summary"
                  className="mb-2 bg-neutral-800 border-neutral-600"
                />
                <Input
                  value={handoffOwner}
                  onChange={(e) => setHandoffOwner(e.target.value)}
                  placeholder="Handoff owner"
                  className="mb-2 bg-neutral-800 border-neutral-600"
                />
              </>
            )}
            {project.handoffCompletedAt && (
              <Input
                value={clientConfirmNote}
                onChange={(e) => setClientConfirmNote(e.target.value)}
                placeholder="Note (optional)"
                className="mb-2 bg-neutral-800 border-neutral-600"
              />
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowCompleteHandoff(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (project.handoffCompletedAt) handleClientConfirm();
                  else handleCompleteHandoff();
                  setShowCompleteHandoff(false);
                }}
                disabled={!!loading}
              >
                {project.handoffCompletedAt ? "Confirm" : "Complete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
            <h3 className="font-medium mb-3">Schedule Follow-up</h3>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm w-full mb-3"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowSchedule(false)}>Cancel</Button>
              <Button onClick={() => { handleRetentionSchedule(); setShowSchedule(false); }} disabled={!scheduleDate}>
                Set
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSnooze && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
            <h3 className="font-medium mb-3">Snooze</h3>
            <select
              value={snoozePreset}
              onChange={(e) => setSnoozePreset(e.target.value as typeof snoozePreset)}
              className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm w-full mb-2"
            >
              <option value="7d">+7 days</option>
              <option value="14d">+14 days</option>
              <option value="30d">+30 days</option>
              <option value="next_month">Next month</option>
              <option value="custom">Custom</option>
            </select>
            {snoozePreset === "custom" && (
              <input
                type="datetime-local"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm w-full mb-3"
              />
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowSnooze(false)}>Cancel</Button>
              <Button onClick={() => { handleRetentionSnooze(); setShowSnooze(false); }} disabled={snoozePreset === "custom" && !customDate}>
                Snooze
              </Button>
            </div>
          </div>
        </div>
      )}

      {showReceiveTestimonial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
            <h3 className="font-medium mb-3">Receive Testimonial</h3>
            <textarea
              value={testimonialQuote}
              onChange={(e) => setTestimonialQuote(e.target.value)}
              placeholder="Quote"
              rows={3}
              className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm w-full mb-2"
            />
            <Input
              value={testimonialSourceUrl}
              onChange={(e) => setTestimonialSourceUrl(e.target.value)}
              placeholder="Source URL (Loom, email, etc.)"
              className="mb-3 bg-neutral-800 border-neutral-600"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowReceiveTestimonial(false)}>Cancel</Button>
              <Button onClick={() => { handleTestimonialReceive(); setShowReceiveTestimonial(false); }} disabled={!!loading}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {showReceiveReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
            <h3 className="font-medium mb-3">Receive Review</h3>
            <Input
              value={reviewPlatform}
              onChange={(e) => setReviewPlatform(e.target.value)}
              placeholder="Platform (Google, LinkedIn, etc.)"
              className="mb-2 bg-neutral-800 border-neutral-600"
            />
            <Input
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="Review URL"
              className="mb-3 bg-neutral-800 border-neutral-600"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowReceiveReview(false)}>Cancel</Button>
              <Button onClick={() => { handleReviewReceive(); setShowReceiveReview(false); }} disabled={!!loading}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {showReceiveReferral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
            <h3 className="font-medium mb-3">Receive Referral</h3>
            <textarea
              value={referralNotes}
              onChange={(e) => setReferralNotes(e.target.value)}
              placeholder="Notes"
              rows={3}
              className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm w-full mb-3"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowReceiveReferral(false)}>Cancel</Button>
              <Button onClick={() => { handleReferralReceive(); setShowReceiveReferral(false); }} disabled={!!loading}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCompleteRetention && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
            <h3 className="font-medium mb-3">Complete Follow-up</h3>
            <Input
              value={retentionOutcome}
              onChange={(e) => setRetentionOutcome(e.target.value)}
              placeholder="Outcome (optional)"
              className="mb-2 bg-neutral-800 border-neutral-600"
            />
            <select
              value={retentionStatus}
              onChange={(e) => setRetentionStatus(e.target.value)}
              className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm w-full mb-2"
            >
              <option value="">—</option>
              <option value="monitoring">Monitoring</option>
              <option value="followup_due">Follow-up due</option>
              <option value="upsell_open">Upsell open</option>
              <option value="retainer_open">Retainer open</option>
              <option value="closed_won">Closed won</option>
              <option value="closed_lost">Closed lost</option>
            </select>
            <Input
              value={upsellOpportunity}
              onChange={(e) => setUpsellOpportunity(e.target.value)}
              placeholder="Upsell opportunity"
              className="mb-2 bg-neutral-800 border-neutral-600"
            />
            <Input
              value={upsellValueEstimate}
              onChange={(e) => setUpsellValueEstimate(e.target.value)}
              placeholder="Value estimate ($)"
              type="number"
              className="mb-3 bg-neutral-800 border-neutral-600"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowCompleteRetention(false)}>Cancel</Button>
              <Button onClick={() => { handleRetentionComplete(); setShowCompleteRetention(false); }} disabled={!!loading}>
                Complete
              </Button>
            </div>
          </div>
        </div>
      )}

      {showUpsell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
            <h3 className="font-medium mb-3">Log Upsell</h3>
            <Input
              value={upsellOpportunity}
              onChange={(e) => setUpsellOpportunity(e.target.value)}
              placeholder="Upsell opportunity (required)"
              className="mb-2 bg-neutral-800 border-neutral-600"
            />
            <Input
              value={upsellValueEstimate}
              onChange={(e) => setUpsellValueEstimate(e.target.value)}
              placeholder="Value estimate ($)"
              type="number"
              className="mb-3 bg-neutral-800 border-neutral-600"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowUpsell(false)}>Cancel</Button>
              <Button onClick={() => { handleUpsell(); setShowUpsell(false); }} disabled={!upsellOpportunity.trim() || !!loading}>
                Log
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
