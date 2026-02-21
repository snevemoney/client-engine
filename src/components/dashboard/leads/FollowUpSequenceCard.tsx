"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, RefreshCw } from "lucide-react";

type Touch = {
  subject: string;
  body: string;
  tone: string;
  variant?: string;
  suggestedSendAfterDays?: number;
};

export function FollowUpSequenceCard({
  leadId,
  proposalSentAt: proposalSentAtStr,
  dealOutcome,
  onSequenceGenerated,
}: {
  leadId: string;
  proposalSentAt: string | null;
  dealOutcome: string | null;
  onSequenceGenerated?: () => void;
}) {
  const [touches, setTouches] = useState<Touch[]>([]);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loggingTouch, setLoggingTouch] = useState<number | null>(null);

  const showCard = proposalSentAtStr && !dealOutcome;

  function fetchSequence() {
    if (!showCard) return;
    fetch(`/api/followup/${leadId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.touches?.length) {
          setTouches(data.touches);
          setContent(data.content ?? null);
        } else {
          setTouches([]);
          setContent(null);
        }
      })
      .catch(() => { setTouches([]); setContent(null); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (showCard) fetchSequence();
    else setLoading(false);
  }, [leadId, showCard]);

  async function generateSequence() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/followup/${leadId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTouches(data.touches ?? []);
        setContent(null);
        onSequenceGenerated?.();
        fetchSequence();
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to generate sequence");
      }
    } catch (e) {
      alert("Request failed");
    } finally {
      setGenerating(false);
    }
  }

  async function markTouchSent(touchIndex: number) {
    setLoggingTouch(touchIndex);
    try {
      const res = await fetch(`/api/followup/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logTouch", touchIndex }),
      });
      if (res.ok) onSequenceGenerated?.();
    } finally {
      setLoggingTouch(null);
    }
  }

  if (!showCard) return null;

  if (loading) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h3 className="text-sm font-medium text-neutral-300 mb-2">Follow-up Sequence</h3>
        <p className="text-sm text-neutral-500">Loading…</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          <Send className="w-4 h-4" /> Follow-up Sequence
        </h3>
        {touches.length === 0 ? (
          <Button variant="outline" size="sm" onClick={generateSequence} disabled={generating} className="text-xs">
            <RefreshCw className={`w-3 h-3 mr-1 ${generating ? "animate-spin" : ""}`} />
            Generate Follow-up Sequence
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={generateSequence} disabled={generating} className="text-xs text-neutral-400">
            Regenerate
          </Button>
        )}
      </div>
      {touches.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No follow-up sequence yet. Click Generate to create 5-touch drafts (no auto-send).
        </p>
      ) : (
        <div className="space-y-4">
          {touches.map((t, i) => (
            <div key={i} className="border border-neutral-800 rounded-md p-3 bg-neutral-900/30">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-neutral-400">
                  Touch {i + 1}
                  {t.suggestedSendAfterDays != null && ` (day ${t.suggestedSendAfterDays})`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => markTouchSent(i)}
                  disabled={loggingTouch !== null}
                >
                  {loggingTouch === i ? "…" : "Mark touch sent"}
                </Button>
              </div>
              <p className="text-xs text-neutral-500 mb-1">Subject: {t.subject}</p>
              <p className="text-sm text-neutral-300 whitespace-pre-wrap line-clamp-4">{t.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
