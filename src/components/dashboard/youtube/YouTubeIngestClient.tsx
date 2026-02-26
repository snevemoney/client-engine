"use client";

import { useState } from "react";
import {
  Youtube,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  BookMarked,
  Eye,
  Archive,
  ArrowUpRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror server shapes)
// ---------------------------------------------------------------------------

type Job = {
  id: string;
  sourceType: string;
  status: string;
  attempts: number;
  providerUsed: string | null;
  lastError: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  source: { title: string | null; externalId: string; channelName: string | null } | null;
};

type TranscriptRow = {
  id: string;
  videoId: string;
  channelId: string | null;
  sourceUrl: string;
  title: string | null;
  language: string | null;
  durationSeconds: number | null;
  providerUsed: string;
  transcriptStatus: string;
  failureReason: string | null;
  createdAt: string;
};

type Proposal = {
  id: string;
  summary: string;
  category: string | null;
  systemArea: string | null;
  producedAssetType: string | null;
  expectedImpact: string | null;
  revenueLink: string | null;
  status: string;
  reviewerNotes: string | null;
  extractedPointsJson: unknown;
  proposedActionsJson: unknown;
  contradictionFlagsJson: unknown;
  createdAt: string;
  transcript: {
    videoId: string;
    title: string | null;
    sourceUrl: string;
    channelId: string | null;
    providerUsed: string;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  const map: Record<string, { color: string; Icon: typeof CheckCircle2 }> = {
    TRANSCRIBED: { color: "text-emerald-400 bg-emerald-900/30", Icon: CheckCircle2 },
    READY_FOR_REVIEW: { color: "text-blue-400 bg-blue-900/30", Icon: Eye },
    PROMOTED_TO_PLAYBOOK: { color: "text-purple-400 bg-purple-900/30", Icon: BookMarked },
    REJECTED: { color: "text-red-400 bg-red-900/30", Icon: XCircle },
    KNOWLEDGE_ONLY: { color: "text-neutral-400 bg-neutral-800", Icon: Archive },
    FAILED_TRANSCRIPT: { color: "text-amber-400 bg-amber-900/30", Icon: AlertTriangle },
    FETCHING: { color: "text-yellow-400 bg-yellow-900/30", Icon: RefreshCw },
    PENDING: { color: "text-neutral-400 bg-neutral-800", Icon: Clock },
    ALREADY_INGESTED: { color: "text-neutral-400 bg-neutral-800", Icon: CheckCircle2 },
  };
  const entry = map[status] ?? { color: "text-neutral-400 bg-neutral-800", Icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${entry.color}`}>
      <entry.Icon className="w-3 h-3" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YouTubeIngestClient({
  initialJobs,
  initialTranscripts,
  initialProposals,
  initialFailedTranscripts,
}: {
  initialJobs: Job[];
  initialTranscripts: TranscriptRow[];
  initialProposals: Proposal[];
  initialFailedTranscripts: TranscriptRow[];
}) {
  const [url, setUrl] = useState("");
  const [urlType, setUrlType] = useState<"video" | "channel">("video");
  const [channelLimit, setChannelLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [jobs, setJobs] = useState(initialJobs);
  const [transcripts, setTranscripts] = useState(initialTranscripts);
  const [proposals, setProposals] = useState(initialProposals);
  const [failed, setFailed] = useState(initialFailedTranscripts);
  const [activeTab, setActiveTab] = useState<"proposals" | "jobs" | "transcripts" | "failures">("proposals");

  async function refreshData() {
    const [jobsRes, transRes, propRes] = await Promise.all([
      fetch("/api/youtube/jobs?limit=30"),
      fetch("/api/youtube/transcripts?limit=30"),
      fetch("/api/youtube/learning?limit=30"),
    ]);
    if (jobsRes.ok) { const d = await jobsRes.json(); setJobs(d.jobs ?? []); }
    if (transRes.ok) { const d = await transRes.json(); setTranscripts(d.transcripts ?? []); }
    if (propRes.ok) { const d = await propRes.json(); setProposals(d.proposals ?? []); }

    const failRes = await fetch("/api/youtube/transcripts?status=FAILED_TRANSCRIPT&limit=20");
    if (failRes.ok) { const d = await failRes.json(); setFailed(d.transcripts ?? []); }
  }

  async function handleIngest() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    try {
      const endpoint = urlType === "channel" ? "/api/youtube/ingest/channel" : "/api/youtube/ingest/video";
      const body = urlType === "channel" ? { url: trimmed, limit: channelLimit } : { url: trimmed };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok || res.ok) {
        const msg = urlType === "channel"
          ? `Channel: ${data.summary?.transcribed ?? 0} transcribed, ${data.summary?.failed ?? 0} failed, ${data.summary?.alreadyIngested ?? 0} already ingested`
          : `Video ${data.videoId}: ${data.status}`;
        setResult({ ok: true, message: msg });
        setUrl("");
      } else {
        setResult({ ok: false, message: data.error ?? data.errors?.join("; ") ?? "Ingest failed" });
      }
      await refreshData();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(videoId: string, sourceUrl: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/youtube/ingest/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const data = await res.json();
      setResult({ ok: data.ok, message: data.ok ? `Retried ${videoId}: ${data.status}` : (data.error ?? "Retry failed") });
      await refreshData();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Retry failed" });
    } finally {
      setLoading(false);
    }
  }

  async function handlePromote(id: string) {
    const notes = window.prompt("Reviewer notes (optional):");
    try {
      const res = await fetch(`/api/youtube/learning/${id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerNotes: notes || undefined }),
      });
      if (res.ok) await refreshData();
    } catch { /* ignore */ }
  }

  async function handleReject(id: string, knowledgeOnly = false) {
    const notes = window.prompt("Reviewer notes (optional):");
    try {
      const res = await fetch(`/api/youtube/learning/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerNotes: notes || undefined, knowledgeOnly }),
      });
      if (res.ok) await refreshData();
    } catch { /* ignore */ }
  }

  const tabClass = (tab: string) =>
    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
      activeTab === tab ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
    }`;

  return (
    <div className="space-y-6">
      {/* Ingest form */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <Youtube className="w-4 h-4 text-red-500" /> Paste URL
        </h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[240px]">
            <input
              data-testid="youtube-url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleIngest()}
              placeholder={urlType === "video" ? "https://www.youtube.com/watch?v=..." : "https://www.youtube.com/@channel"}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
            />
          </div>
          <select
            value={urlType}
            onChange={(e) => setUrlType(e.target.value as "video" | "channel")}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
          >
            <option value="video">Video</option>
            <option value="channel">Channel</option>
          </select>
          {urlType === "channel" && (
            <input
              type="number"
              min={1}
              max={50}
              value={channelLimit}
              onChange={(e) => setChannelLimit(Math.min(50, Math.max(1, Number(e.target.value))))}
              className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
              title="Max videos to ingest"
            />
          )}
          <button
            data-testid="youtube-ingest-button"
            onClick={handleIngest}
            disabled={loading || !url.trim()}
            className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
          >
            {loading ? "Ingesting…" : "Ingest"}
          </button>
        </div>
        {result && (
          <p className={`mt-2 text-sm ${result.ok ? "text-emerald-400" : "text-amber-400"}`}>
            {result.message}
          </p>
        )}
      </section>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-800 pb-1">
        <button className={tabClass("proposals")} onClick={() => setActiveTab("proposals")}>
          Learning Review ({proposals.filter((p) => p.status === "READY_FOR_REVIEW").length})
        </button>
        <button className={tabClass("failures")} onClick={() => setActiveTab("failures")}>
          Failures ({failed.length})
        </button>
        <button className={tabClass("jobs")} onClick={() => setActiveTab("jobs")}>
          Jobs ({jobs.length})
        </button>
        <button className={tabClass("transcripts")} onClick={() => setActiveTab("transcripts")}>
          Transcripts ({transcripts.length})
        </button>
      </div>

      {/* Learning Review Queue */}
      {activeTab === "proposals" && (
        <section className="space-y-3">
          {proposals.length === 0 ? (
            <p className="text-xs text-neutral-500">No learning proposals yet. Ingest a video to generate.</p>
          ) : (
            <ul className="space-y-3">
              {proposals.map((p) => (
                <li key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(p.status)}
                        {p.category && <span className="text-xs text-neutral-500 capitalize">{p.category.replace(/_/g, " ")}</span>}
                        {p.systemArea && <span className="text-xs font-medium text-blue-400">{p.systemArea}</span>}
                        {p.expectedImpact && <span className="text-xs text-neutral-500">→ {p.expectedImpact}</span>}
                      </div>
                      <h3 className="text-sm font-medium text-neutral-200 mt-1">
                        {p.transcript.title ?? p.transcript.videoId}
                      </h3>
                      <p className="text-sm text-neutral-400 mt-1">{p.summary.slice(0, 300)}{p.summary.length > 300 ? "…" : ""}</p>
                    </div>
                    <span className="text-xs text-neutral-500 shrink-0">{fmtDate(p.createdAt)}</span>
                  </div>

                  {/* Extracted points */}
                  {Array.isArray(p.extractedPointsJson) && (p.extractedPointsJson as string[]).length > 0 && (
                    <div>
                      <span className="text-xs text-neutral-500 block mb-1">Key points:</span>
                      <ul className="list-disc list-inside text-xs text-neutral-400 space-y-0.5">
                        {(p.extractedPointsJson as string[]).slice(0, 5).map((pt, i) => <li key={i}>{pt}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Proposed actions */}
                  {Array.isArray(p.proposedActionsJson) && (p.proposedActionsJson as { type: string; description: string }[]).length > 0 && (
                    <div>
                      <span className="text-xs text-neutral-500 block mb-1">Proposed actions:</span>
                      <ul className="text-xs text-neutral-400 space-y-0.5">
                        {(p.proposedActionsJson as { type: string; description: string }[]).map((a, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-mono text-neutral-500">{a.type.replace(/_/g, " ")}</span>
                            <span>{a.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Contradictions */}
                  {Array.isArray(p.contradictionFlagsJson) && (p.contradictionFlagsJson as string[]).length > 0 && (
                    <div className="text-xs text-amber-400">
                      Contradictions: {(p.contradictionFlagsJson as string[]).join("; ")}
                    </div>
                  )}

                  {/* Revenue link + asset type */}
                  <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                    {p.producedAssetType && <span>Asset: <span className="text-neutral-300">{p.producedAssetType.replace(/_/g, " ")}</span></span>}
                    {p.revenueLink && <span>Revenue link: <span className="text-neutral-300">{p.revenueLink}</span></span>}
                    <a
                      href={p.transcript.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-400 hover:text-neutral-200 inline-flex items-center gap-1"
                    >
                      <ArrowUpRight className="w-3 h-3" /> Source
                    </a>
                  </div>

                  {/* Reviewer notes */}
                  {p.reviewerNotes && (
                    <p className="text-xs text-neutral-500 italic">Notes: {p.reviewerNotes}</p>
                  )}

                  {/* Actions */}
                  {p.status === "READY_FOR_REVIEW" && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handlePromote(p.id)}
                        className="inline-flex items-center gap-1 rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-900/30"
                      >
                        <BookMarked className="w-3 h-3" /> Promote to playbook
                      </button>
                      <button
                        onClick={() => handleReject(p.id)}
                        className="inline-flex items-center gap-1 rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30"
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                      <button
                        onClick={() => handleReject(p.id, true)}
                        className="inline-flex items-center gap-1 rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800"
                      >
                        <Archive className="w-3 h-3" /> Knowledge only
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Failures & Interventions */}
      {activeTab === "failures" && (
        <section className="space-y-3">
          {failed.length === 0 ? (
            <p className="text-xs text-neutral-500">No failed transcripts.</p>
          ) : (
            <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
              <h3 className="text-sm font-medium text-amber-200/90 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Failed transcripts ({failed.length})
              </h3>
              <ul className="space-y-2">
                {failed.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <span className="text-amber-200/90 font-mono text-xs">{t.videoId}</span>
                      {t.title && <span className="text-neutral-400 ml-2">{t.title}</span>}
                      <p className="text-xs text-neutral-500 mt-0.5">{t.failureReason?.slice(0, 200)}</p>
                      <span className="text-xs text-neutral-600">Provider: {t.providerUsed} · {fmtDate(t.createdAt)}</span>
                    </div>
                    <button
                      onClick={() => handleRetry(t.videoId, t.sourceUrl)}
                      disabled={loading}
                      className="shrink-0 inline-flex items-center gap-1 rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Recent Jobs */}
      {activeTab === "jobs" && (
        <section>
          {jobs.length === 0 ? (
            <p className="text-xs text-neutral-500">No ingest jobs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500 border-b border-neutral-800">
                    <th className="pb-2 pr-3">Type</th>
                    <th className="pb-2 pr-3">Source</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Provider</th>
                    <th className="pb-2 pr-3">Attempts</th>
                    <th className="pb-2 pr-3">Queued</th>
                    <th className="pb-2">Error</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-300">
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-b border-neutral-800/50">
                      <td className="py-2 pr-3 capitalize">{j.sourceType}</td>
                      <td className="py-2 pr-3 truncate max-w-[180px]">
                        {j.source?.title ?? j.source?.externalId ?? "—"}
                      </td>
                      <td className="py-2 pr-3">{statusBadge(j.status)}</td>
                      <td className="py-2 pr-3 font-mono">{j.providerUsed ?? "—"}</td>
                      <td className="py-2 pr-3">{j.attempts}</td>
                      <td className="py-2 pr-3">{fmtDate(j.queuedAt)}</td>
                      <td className="py-2 text-amber-400/80 truncate max-w-[200px]" title={j.lastError ?? undefined}>
                        {j.lastError?.slice(0, 60) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Transcripts */}
      {activeTab === "transcripts" && (
        <section>
          {transcripts.length === 0 ? (
            <p className="text-xs text-neutral-500">No transcripts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500 border-b border-neutral-800">
                    <th className="pb-2 pr-3">Video</th>
                    <th className="pb-2 pr-3">Title</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Provider</th>
                    <th className="pb-2 pr-3">Lang</th>
                    <th className="pb-2 pr-3">Duration</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-300">
                  {transcripts.map((t) => (
                    <tr key={t.id} className="border-b border-neutral-800/50">
                      <td className="py-2 pr-3 font-mono">
                        <a
                          href={t.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neutral-300 hover:text-neutral-100"
                        >
                          {t.videoId}
                        </a>
                      </td>
                      <td className="py-2 pr-3 truncate max-w-[200px]">{t.title ?? "—"}</td>
                      <td className="py-2 pr-3">{statusBadge(t.transcriptStatus)}</td>
                      <td className="py-2 pr-3 font-mono">{t.providerUsed}</td>
                      <td className="py-2 pr-3">{t.language ?? "—"}</td>
                      <td className="py-2 pr-3">{fmtDuration(t.durationSeconds)}</td>
                      <td className="py-2">{fmtDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
