"use client";

import { useState, use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AsyncState } from "@/components/ui/AsyncState";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

type Deal = {
  id: string;
  stage: string;
  priority: string;
  valueCad: number | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  prospect: {
    id: string;
    name: string;
    handle: string | null;
    platform: string;
    niche: string | null;
    followers: number | null;
    bioUrl: string | null;
    opportunityScore: number | null;
  };
  outreachMessages: Array<{
    id: string;
    channel: string;
    templateKey: string;
    content: string;
    status: string;
    sentAt: string | null;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    summary: string;
    occurredAt: string;
  }>;
};

const STAGES = ["new", "contacted", "replied", "call_scheduled", "proposal_sent", "won", "lost"];
const TEMPLATE_KEYS = [
  "broken_link_fix",
  "google_form_upgrade",
  "linktree_cleanup",
  "big_audience_no_site",
  "canva_site_upgrade",
  "calendly_blank_fix",
];

const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

export default function GrowthDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: deal, loading, error, refetch } = useRetryableFetch<Deal>(
    `/api/internal/growth/deals/${id}`
  );
  const { confirm, dialogProps } = useConfirmDialog();

  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sendContent, setSendContent] = useState("");
  const [eventType, setEventType] = useState("note");
  const [eventSummary, setEventSummary] = useState("");

  const { execute: handlePreview, pending: previewPending } = useAsyncAction(
    async () => {
      if (!selectedTemplate) return;
      const data = await fetchJsonThrow<{ content: string }>(
        `/api/internal/growth/deals/${id}/outreach/preview`,
        { method: "POST", body: JSON.stringify({ templateKey: selectedTemplate }) }
      );
      setPreviewContent(data.content);
      setSendContent(data.content);
    },
    { toast: toastFn }
  );

  const { execute: handleSend, pending: sendPending } = useAsyncAction(
    async () => {
      if (!selectedTemplate || !sendContent.trim()) return;
      await fetchJsonThrow(
        `/api/internal/growth/deals/${id}/outreach/send`,
        { method: "POST", body: JSON.stringify({ templateKey: selectedTemplate, content: sendContent }) }
      );
      setPreviewContent(null);
      setSendContent("");
      setSelectedTemplate("");
      void refetch();
    },
    { toast: toastFn, successMessage: "Message sent" }
  );

  const { execute: handleScheduleFollowUp, pending: followUpPending } = useAsyncAction(
    async (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      await fetchJsonThrow(`/api/internal/growth/deals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ nextFollowUpAt: d.toISOString() }),
      });
      void refetch();
    },
    { toast: toastFn, successMessage: "Follow-up scheduled" }
  );

  const { execute: handleStageChange, pending: stagePending } = useAsyncAction(
    async (stage: string) => {
      const destructiveStages = ["lost"];
      if (destructiveStages.includes(stage)) {
        const ok = await confirm({ title: `Change stage to "${stage}"?`, body: "This may affect pipeline metrics.", variant: "destructive" });
        if (!ok) return;
      }
      await fetchJsonThrow(`/api/internal/growth/deals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      });
      void refetch();
    },
    { toast: toastFn, successMessage: "Stage updated" }
  );

  const { execute: handleAddEvent, pending: eventPending } = useAsyncAction(
    async () => {
      if (!eventSummary.trim()) return;
      await fetchJsonThrow(`/api/internal/growth/deals/${id}/events`, {
        method: "POST",
        body: JSON.stringify({ type: eventType, summary: eventSummary.trim() }),
      });
      setEventSummary("");
      void refetch();
    },
    { toast: toastFn, successMessage: "Event logged" }
  );

  return (
    <div className="space-y-6" data-testid="growth-deal-page">
      <AsyncState loading={loading} error={error} onRetry={refetch}>
        {deal && (
          <>
            <div>
              <Link href="/dashboard/growth" className="text-sm text-amber-400 hover:underline mb-2 block">
                ← Pipeline
              </Link>
              <h1 className="text-2xl font-semibold tracking-tight">{deal.prospect.name}</h1>
              {deal.prospect.handle && (
                <p className="text-sm text-neutral-400">@{deal.prospect.handle} · {deal.prospect.platform}</p>
              )}
              {deal.prospect.bioUrl && (
                <a href={deal.prospect.bioUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 hover:underline">
                  Bio link
                </a>
              )}
              {deal.prospect.opportunityScore != null && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-neutral-700">Score: {deal.prospect.opportunityScore}</span>
              )}
            </div>

            {/* Stage + actions */}
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <h2 className="text-sm font-medium text-amber-400/90 mb-3">Stage</h2>
              <select
                value={deal.stage}
                onChange={(e) => void handleStageChange(e.target.value)}
                disabled={stagePending}
                className="rounded bg-neutral-800 border border-neutral-700 text-sm px-2 py-1 disabled:opacity-50"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <span className="text-xs text-neutral-500">Follow-up:</span>
                {[1, 2, 7].map((days) => (
                  <button
                    key={days}
                    onClick={() => void handleScheduleFollowUp(days)}
                    disabled={followUpPending}
                    className="text-xs px-2 py-0.5 rounded border border-neutral-600 hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {days === 1 ? "24h" : days === 2 ? "48h" : "7d"}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate message */}
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <h2 className="text-sm font-medium text-amber-400/90 mb-3">Outreach</h2>
              <div className="space-y-2">
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="rounded bg-neutral-800 border border-neutral-700 text-sm px-2 py-1"
                >
                  <option value="">Select template</option>
                  {TEMPLATE_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handlePreview()}
                  disabled={!selectedTemplate || previewPending}
                  className="rounded border border-neutral-600 px-2 py-1 text-xs hover:bg-neutral-800 disabled:opacity-50"
                >
                  {previewPending ? "Loading…" : "Preview"}
                </button>
              </div>
              {previewContent && (
                <div className="mt-3">
                  <textarea
                    value={sendContent}
                    onChange={(e) => setSendContent(e.target.value)}
                    rows={4}
                    className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sendPending}
                    className="mt-2 rounded bg-amber-600 hover:bg-amber-500 text-black px-3 py-1 text-sm disabled:opacity-50"
                  >
                    {sendPending ? "Sending…" : "Mark sent"}
                  </button>
                </div>
              )}
            </div>

            {/* Add event */}
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <h2 className="text-sm font-medium text-amber-400/90 mb-3">Log event</h2>
              <div className="flex gap-2">
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="rounded bg-neutral-800 border border-neutral-700 text-sm px-2 py-1"
                >
                  <option value="note">Note</option>
                  <option value="call">Call</option>
                  <option value="proposal">Proposal</option>
                  <option value="payment">Payment</option>
                  <option value="status_change">Status change</option>
                </select>
                <input
                  type="text"
                  placeholder="Summary"
                  value={eventSummary}
                  onChange={(e) => setEventSummary(e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAddEvent()}
                  disabled={!eventSummary.trim() || eventPending}
                  className="rounded bg-amber-600 hover:bg-amber-500 text-black px-3 py-1 text-sm disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <h2 className="text-sm font-medium text-amber-400/90 mb-3">Timeline</h2>
              <ul className="space-y-3">
                {[
                  ...deal.outreachMessages.map((m) => ({
                    type: "outreach",
                    id: m.id,
                    date: m.sentAt ?? m.createdAt,
                    content: m.content,
                    meta: m.channel,
                  })),
                  ...deal.events.map((e) => ({
                    type: "event",
                    id: e.id,
                    date: e.occurredAt,
                    content: e.summary,
                    meta: e.type,
                  })),
                ]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((t) => (
                    <li key={t.id} className="border-l-2 border-neutral-700 pl-3">
                      <span className="text-xs text-neutral-500">
                        {new Date(t.date).toLocaleString()} · {t.type} · {t.meta}
                      </span>
                      <p className="text-sm mt-0.5">{t.content}</p>
                    </li>
                  ))}
                {deal.outreachMessages.length === 0 && deal.events.length === 0 && (
                  <p className="text-sm text-neutral-500">No activity yet.</p>
                )}
              </ul>
            </div>
          </>
        )}
      </AsyncState>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
