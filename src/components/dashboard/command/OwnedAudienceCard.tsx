"use client";

import { useState, useEffect } from "react";
import type { OwnedAudienceHealth } from "@/lib/ops/ownedAudience";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, Minus, Plus } from "lucide-react";

export function OwnedAudienceCard() {
  const [health, setHealth] = useState<OwnedAudienceHealth | null | "loading">("loading");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subscribers, setSubscribers] = useState("");
  const [sends, setSends] = useState("");
  const [replies, setReplies] = useState("");
  const [clicks, setClicks] = useState("");
  const [inquiries, setInquiries] = useState("");
  const [note, setNote] = useState("");

  async function fetchHealth() {
    try {
      const res = await fetch("/api/owned-audience?mode=health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    }
  }

  useEffect(() => {
    fetchHealth();
  }, []);

  async function submitSnapshot() {
    setSaving(true);
    try {
      const res = await fetch("/api/owned-audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscribers: Number(subscribers) || 0,
          sends: Number(sends) || 0,
          replies: Number(replies) || 0,
          clicks: Number(clicks) || 0,
          inquiriesInfluenced: Number(inquiries) || 0,
          note: note.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSubscribers("");
        setSends("");
        setReplies("");
        setClicks("");
        setInquiries("");
        setNote("");
        setShowForm(false);
        await fetchHealth();
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to save");
      }
    } catch (e) {
      alert("Request failed");
    }
    setSaving(false);
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Owned audience health</h2>
      <p className="text-xs text-neutral-500 mb-3">
        Newsletter/blog: subscribers, sends, replies, clicks, inquiries influenced. Manual entry.
      </p>
      {health === "loading" && <p className="text-xs text-neutral-500">Loading…</p>}
      {health === null && !showForm && (
        <p className="text-xs text-neutral-500 mb-2">No ledger entries yet. Log a snapshot below.</p>
      )}
      {health !== "loading" && health !== null && (
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-neutral-200">{health.summary}</span>
            {health.trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-400" />}
            {health.trend === "down" && <TrendingDown className="w-4 h-4 text-amber-400" />}
            {health.trend === "flat" && <Minus className="w-4 h-4 text-neutral-500" />}
          </div>
          <p className="text-[10px] text-neutral-600">
            Latest snapshot: {new Date(health.at).toLocaleDateString()}
          </p>
        </div>
      )}
      {showForm ? (
        <div className="border border-neutral-700 rounded-md p-3 space-y-2 bg-neutral-900/80">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-neutral-500 block">Subscribers</label>
              <Input
                data-testid="owned-audience-subscribers"
                type="number"
                min={0}
                value={subscribers}
                onChange={(e) => setSubscribers(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block">Sends</label>
              <Input
                data-testid="owned-audience-sends"
                type="number"
                min={0}
                value={sends}
                onChange={(e) => setSends(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block">Replies</label>
              <Input
                data-testid="owned-audience-replies"
                type="number"
                min={0}
                value={replies}
                onChange={(e) => setReplies(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block">Clicks</label>
              <Input
                data-testid="owned-audience-clicks"
                type="number"
                min={0}
                value={clicks}
                onChange={(e) => setClicks(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block">Inquiries influenced</label>
              <Input
                data-testid="owned-audience-inquiries"
                type="number"
                min={0}
                value={inquiries}
                onChange={(e) => setInquiries(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submitSnapshot} disabled={saving}>
              {saving ? "Saving…" : "Save snapshot"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3 mr-1" /> Log snapshot
        </Button>
      )}
    </section>
  );
}
