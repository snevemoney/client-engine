"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AsyncState } from "@/components/ui/AsyncState";

type Transcript = {
  id: string;
  videoId: string;
  title: string | null;
  sourceUrl: string;
  language: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  transcriptText: string;
  createdAt: string;
};

export default function TranscriptsPage() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchTranscripts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube/transcripts", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setTranscripts(data.transcripts ?? data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTranscripts();
  }, [fetchTranscripts]);

  const filtered = transcripts.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.title ?? "").toLowerCase().includes(q) ||
      t.transcriptText.toLowerCase().includes(q)
    );
  });

  function formatDuration(seconds: number | null) {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">YouTube Transcripts</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Browse ingested video transcripts. Click to expand and read.
          </p>
        </div>
        <Link href="/dashboard/youtube" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← YouTube
        </Link>
      </div>

      <input
        type="text"
        placeholder="Search transcripts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm w-full max-w-sm"
      />

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && filtered.length === 0}
        emptyMessage="No transcripts found"
        onRetry={fetchTranscripts}
      >
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 divide-y divide-neutral-800">
          {filtered.map((t) => (
            <div key={t.id}>
              <button
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-800/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-200 truncate">
                    {t.title || `Video ${t.videoId}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                    {t.language && <Badge variant="outline" className="text-[10px]">{t.language}</Badge>}
                    <span>{formatDuration(t.durationSeconds)}</span>
                    {t.publishedAt && <span>{new Date(t.publishedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <span className="text-xs text-neutral-600 shrink-0">
                  {expanded === t.id ? "Collapse" : "Expand"}
                </span>
              </button>
              {expanded === t.id && (
                <div className="px-4 pb-4 border-t border-neutral-800/50">
                  <div className="flex items-center gap-2 mb-2 mt-2">
                    <a
                      href={t.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Watch on YouTube
                    </a>
                  </div>
                  <pre className="text-xs text-neutral-300 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                    {t.transcriptText}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
