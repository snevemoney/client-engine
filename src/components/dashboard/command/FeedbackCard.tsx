"use client";

import { useState, useEffect } from "react";

type Note = { id: string; content: string; createdAt: string };

export function FeedbackCard({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadNotes() {
    const res = await fetch("/api/ops/feedback");
    if (res.ok) {
      const data = await res.json();
      setNotes(data.notes ?? []);
    }
  }

  async function submit() {
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ops/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        setContent("");
        await loadNotes();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Feedback notes</h2>
      <p className="text-xs text-neutral-500 mb-3">
        What felt off? What failed? Stored for future briefings.
      </p>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="e.g. Proposal for X felt too generic"
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button
          onClick={submit}
          disabled={saving || !content.trim()}
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {notes.length > 0 && (
        <ul className="space-y-1 text-xs text-neutral-400 max-h-32 overflow-y-auto">
          {notes.slice(0, 5).map((n) => (
            <li key={n.id} className="border-l border-neutral-700 pl-2">
              {n.content.slice(0, 120)}
              {n.content.length > 120 ? "…" : ""}
              <span className="text-neutral-500 ml-1">
                {new Date(n.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
