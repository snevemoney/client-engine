"use client";

import { useState } from "react";

type Run = { id: string; content: string; meta: unknown; createdAt: string };
type Artifact = { id: string; title: string; content: string; meta: unknown; createdAt: string };

const SUGGESTION_STATUSES = ["queued", "reviewed", "applied", "dismissed"] as const;

function SuggestionRow({
  id,
  title,
  content,
  meta,
  createdAt,
  status,
  onStatusChange,
}: {
  id: string;
  title: string;
  content: string;
  meta: { systemArea?: string; effort?: string; expectedImpact?: string; status?: string } | null;
  createdAt: string;
  status: string;
  onStatusChange: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  async function setStatus(newStatus: string) {
    if (!SUGGESTION_STATUSES.includes(newStatus as (typeof SUGGESTION_STATUSES)[number])) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/knowledge/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) onStatusChange();
    } finally {
      setUpdating(false);
    }
  }
  return (
    <li className="border border-neutral-800 rounded-lg p-3 bg-neutral-900/30">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-neutral-200">{title}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={updating}
            className="rounded border border-neutral-700 bg-neutral-900 text-neutral-200 text-xs px-2 py-1"
          >
            {SUGGESTION_STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">{new Date(createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      {meta && (
        <p className="text-xs text-neutral-500 mt-1">
          {meta.systemArea} · effort {meta.effort}
        </p>
      )}
      <p className="mt-2 text-sm text-neutral-400">{content.slice(0, 300)}{content.length > 300 ? "…" : ""}</p>
    </li>
  );
}

export function KnowledgePageClient({
  initialRuns,
  initialTranscripts,
  initialSummaries,
  initialInsights,
  initialSuggestions,
}: {
  initialRuns: Run[];
  initialTranscripts: Artifact[];
  initialSummaries: Artifact[];
  initialInsights: Artifact[];
  initialSuggestions: Artifact[];
}) {
  const [videoUrl, setVideoUrl] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [maxVideos, setMaxVideos] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [runs, setRuns] = useState(initialRuns);
  const [summaries, setSummaries] = useState(initialSummaries);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [queueUrl, setQueueUrl] = useState("");
  const [queueType, setQueueType] = useState<"video" | "channel">("video");
  const [queueMessage, setQueueMessage] = useState<string | null>(null);

  async function handleIngestVideo() {
    const url = videoUrl.trim();
    if (!url) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Ingest failed" });
        return;
      }
      setResult({
        ok: data.ok,
        message: data.ok
          ? `Ingested. ${data.errors?.length ? `Errors: ${data.errors.join("; ")}` : ""}`
          : (data.errors ?? []).join("; "),
      });
      setVideoUrl("");
      refresh();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  async function handleIngestChannel() {
    const url = channelUrl.trim();
    if (!url) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUrl: url, maxVideos }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Ingest failed" });
        return;
      }
      setResult({
        ok: data.ok,
        message: data.ok
          ? `Discovered ${data.discovered}, ingested ${data.ingested}. ${data.errors?.length ? `Errors: ${data.errors.join("; ")}` : ""}`
          : (data.errors ?? []).join("; "),
      });
      setChannelUrl("");
      refresh();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    const listRes = await fetch("/api/knowledge?limit=30");
    if (listRes.ok) {
      const list = await listRes.json();
      setRuns(list.runs ?? []);
      setSummaries(list.summaries ?? []);
      setSuggestions(list.suggestions ?? []);
    }
  }

  async function addToQueue() {
    const url = queueUrl.trim();
    if (!url) return;
    setQueueMessage(null);
    try {
      const res = await fetch("/api/knowledge/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type: queueType, maxVideos: queueType === "channel" ? 5 : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQueueMessage(data.error ?? "Failed");
        return;
      }
      setQueueMessage("Added to workday queue. Next workday run will ingest (capped).");
      setQueueUrl("");
    } catch (e) {
      setQueueMessage(e instanceof Error ? e.message : "Request failed");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Ingest</h2>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-neutral-500 mb-1">YouTube video URL</label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
              />
            </div>
            <button
              onClick={handleIngestVideo}
              disabled={loading || !videoUrl.trim()}
              className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
            >
              Ingest Video
            </button>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-neutral-500 mb-1">YouTube channel URL</label>
              <input
                type="text"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                placeholder="https://www.youtube.com/channel/... or /c/... or /@..."
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
              />
            </div>
            <input
              type="number"
              min={1}
              max={50}
              value={maxVideos}
              onChange={(e) => setMaxVideos(parseInt(e.target.value, 10) || 10)}
              className="w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-200"
            />
            <button
              onClick={handleIngestChannel}
              disabled={loading || !channelUrl.trim()}
              className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
            >
              Ingest Channel
            </button>
          </div>
        </div>
        {result && (
          <p className={`mt-2 text-sm ${result.ok ? "text-neutral-400" : "text-amber-400"}`}>
            {result.message}
          </p>
        )}
        <div className="mt-4 pt-4 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 mb-2">Add URL to workday queue (autopilot will ingest on next run, capped)</p>
          <div className="flex flex-wrap gap-2 items-end">
            <input
              type="text"
              value={queueUrl}
              onChange={(e) => setQueueUrl(e.target.value)}
              placeholder="Video or channel URL"
              className="flex-1 min-w-[180px] rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
            />
            <select
              value={queueType}
              onChange={(e) => setQueueType(e.target.value as "video" | "channel")}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
            >
              <option value="video">Video</option>
              <option value="channel">Channel</option>
            </select>
            <button
              onClick={addToQueue}
              disabled={!queueUrl.trim()}
              className="rounded-md border border-neutral-600 text-neutral-300 px-3 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
            >
              Add to queue
            </button>
          </div>
          {queueMessage && <p className="mt-2 text-xs text-neutral-400">{queueMessage}</p>}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Improvement suggestions (queued for review)</h2>
        {suggestions.length === 0 ? (
          <p className="text-xs text-neutral-500">No suggestions yet. Ingest a video or channel to generate.</p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => {
              const meta = s.meta as { systemArea?: string; effort?: string; expectedImpact?: string; status?: string } | null;
              const currentStatus = meta?.status ?? "queued";
              return (
                <SuggestionRow
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  content={s.content}
                  meta={meta}
                  createdAt={s.createdAt}
                  status={currentStatus}
                  onStatusChange={() => refresh()}
                />
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Recent summaries</h2>
        {summaries.length === 0 ? (
          <p className="text-xs text-neutral-500">No summaries yet.</p>
        ) : (
          <ul className="space-y-2">
            {summaries.map((s) => (
              <li key={s.id} className="border-l-2 border-neutral-700 pl-3 py-1">
                <p className="text-sm text-neutral-300">{s.content.slice(0, 250)}{s.content.length > 250 ? "…" : ""}</p>
                <span className="text-xs text-neutral-500">{new Date(s.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Recent ingests</h2>
        {runs.length === 0 ? (
          <p className="text-xs text-neutral-500">No ingest runs yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-neutral-400">
            {runs.map((r) => (
              <li key={r.id} className="flex justify-between items-center">
                <span className="truncate">{r.content.split("\n")[2] ?? r.id}</span>
                <span className="text-xs shrink-0">{new Date(r.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
