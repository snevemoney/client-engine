"use client";

import { useState, useEffect } from "react";
import type { NetworkingEventWithScore } from "@/lib/ops/networkingEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

export function NetworkingEventsCard() {
  const [events, setEvents] = useState<NetworkingEventWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [audienceType, setAudienceType] = useState("");
  const [relevanceScore, setRelevanceScore] = useState("");
  const [contactsMade, setContactsMade] = useState("");
  const [followUpsSent, setFollowUpsSent] = useState("");
  const [opportunitiesCreated, setOpportunitiesCreated] = useState("");
  const [revenue, setRevenue] = useState("");
  const [notes, setNotes] = useState("");

  async function fetchEvents() {
    try {
      const res = await fetch("/api/networking-events?limit=5");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  async function submitEvent() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/networking-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          eventDate: eventDate || new Date().toISOString().slice(0, 10),
          audienceType: audienceType.trim() || undefined,
          relevanceScore: relevanceScore ? Number(relevanceScore) : undefined,
          contactsMade: Number(contactsMade) || 0,
          followUpsSent: Number(followUpsSent) || 0,
          opportunitiesCreated: Number(opportunitiesCreated) || 0,
          revenue: revenue ? Number(revenue) : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setName("");
        setEventDate("");
        setAudienceType("");
        setRelevanceScore("");
        setContactsMade("");
        setFollowUpsSent("");
        setOpportunitiesCreated("");
        setRevenue("");
        setNotes("");
        setShowForm(false);
        await fetchEvents();
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
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Networking event scoring</h2>
      <p className="text-xs text-neutral-500 mb-3">
        Log events: name, audience, relevance (1–10), contacts, follow-ups, opportunities, revenue. Quality score computed.
      </p>
      {loading && <p className="text-xs text-neutral-500">Loading…</p>}
      {!loading && events.length > 0 && (
        <ul className="space-y-2 mb-3">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 text-xs border-b border-neutral-800/50 pb-2">
              <div>
                <span className="font-medium text-neutral-200">{e.name}</span>
                <span className="text-neutral-500 ml-2">
                  {new Date(e.eventDate).toLocaleDateString()}
                  {e.audienceType && ` · ${e.audienceType}`}
                </span>
              </div>
              <span
                className={
                  e.qualityScore >= 60
                    ? "text-emerald-400 font-medium"
                    : e.qualityScore >= 30
                      ? "text-amber-400"
                      : "text-neutral-500"
                }
              >
                Score: {e.qualityScore}
              </span>
            </li>
          ))}
        </ul>
      )}
      {showForm ? (
        <div className="border border-neutral-700 rounded-md p-3 space-y-2 bg-neutral-900/80">
          <Input
            data-testid="networking-event-name"
            placeholder="Event name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-neutral-500 block">Date</label>
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block">Audience type</label>
              <Input
                placeholder="e.g. tech founders"
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block">Relevance (1–10)</label>
              <Input
                data-testid="networking-event-relevance"
                type="number"
                min={1}
                max={10}
                value={relevanceScore}
                onChange={(e) => setRelevanceScore(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block">Contacts made</label>
              <Input
                data-testid="networking-event-contacts"
                type="number"
                min={0}
                value={contactsMade}
                onChange={(e) => setContactsMade(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block">Follow-ups sent</label>
              <Input
                data-testid="networking-event-followups"
                type="number"
                min={0}
                value={followUpsSent}
                onChange={(e) => setFollowUpsSent(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block">Opportunities</label>
              <Input
                data-testid="networking-event-opportunities"
                type="number"
                min={0}
                value={opportunitiesCreated}
                onChange={(e) => setOpportunitiesCreated(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block">Revenue (optional)</label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submitEvent} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save event"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3 mr-1" /> Log event
        </Button>
      )}
    </section>
  );
}
