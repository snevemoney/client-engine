"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useBrainPanel } from "@/contexts/BrainPanelContext";
import {
  Search,
  Youtube,
  BookOpen,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Archive,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  BookMarked,
  Eye,
  Clock,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Artifact = { id: string; title: string; content: string; meta: unknown; createdAt: string };
type Run = { id: string; content: string; meta: unknown; createdAt: string };

type SearchResult = {
  id: string;
  score: number;
  content: string;
  leadId: string;
  title: string;
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
  transcript: { videoId: string; title: string | null; sourceUrl: string };
};

type SuggestionMeta = {
  systemArea?: string;
  effort?: string;
  expectedImpact?: string;
  status?: string;
  produced?: string | null;
  confidenceTier?: "high" | "medium" | "low";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUGGESTION_STATUSES = ["queued", "reviewed", "applied", "dismissed"] as const;
const PRODUCED_TAGS = [
  { value: "", label: "—" },
  { value: "knowledge_only", label: "Knowledge only" },
  { value: "proposal_template", label: "Proposal template" },
  { value: "playbook_update", label: "Playbook update" },
  { value: "automation_change", label: "Automation change" },
  { value: "copy_snippet", label: "Copy snippet" },
  { value: "positioning_rule", label: "Positioning rule" },
] as const;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    TRANSCRIBED: "text-emerald-400 bg-emerald-900/30",
    READY_FOR_REVIEW: "text-blue-400 bg-blue-900/30",
    PROMOTED_TO_PLAYBOOK: "text-purple-400 bg-purple-900/30",
    REJECTED: "text-red-400 bg-red-900/30",
    KNOWLEDGE_ONLY: "text-neutral-400 bg-neutral-800",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${map[status] ?? "text-neutral-400 bg-neutral-800"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabKey = "search" | "ingest" | "review" | "library";

const TABS: { key: TabKey; label: string; Icon: typeof Search }[] = [
  { key: "search", label: "Search", Icon: Search },
  { key: "ingest", label: "Ingest", Icon: Youtube },
  { key: "review", label: "Review", Icon: Eye },
  { key: "library", label: "Library", Icon: BookOpen },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

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
  const [activeTab, setActiveTab] = useState<TabKey>("search");
  const [summaries, setSummaries] = useState(initialSummaries);
  const [insights, setInsights] = useState(initialInsights);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [runs, setRuns] = useState(initialRuns);
  const [transcripts, setTranscripts] = useState(initialTranscripts);

  // YouTube learning proposals (fetched on demand)
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalsLoaded, setProposalsLoaded] = useState(false);
  const { setPageData } = useBrainPanel();

  useEffect(() => {
    setPageData(
      `Knowledge Base: ${summaries.length} summaries, ${insights.length} insights, ${suggestions.length} suggestions, ${transcripts.length} transcripts, ${runs.length} runs.`
    );
  }, [summaries.length, insights.length, suggestions.length, transcripts.length, runs.length, setPageData]);

  async function refreshKnowledge() {
    try {
      const res = await fetch("/api/knowledge?limit=30");
      if (res.ok) {
        const list = await res.json();
        setRuns(list.runs ?? []);
        setSummaries(list.summaries ?? []);
        setSuggestions(list.suggestions ?? []);
        setInsights(list.insights ?? []);
        setTranscripts(list.transcripts ?? []);
      }
    } catch { /* non-critical */ }
  }

  async function loadProposals() {
    try {
      const res = await fetch("/api/youtube/learning?limit=30");
      if (res.ok) {
        const d = await res.json();
        setProposals(d.proposals ?? []);
        setProposalsLoaded(true);
      }
    } catch { /* non-critical */ }
  }

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    if (tab === "review" && !proposalsLoaded) void loadProposals();
  }, [proposalsLoaded]);

  const reviewCount = suggestions.filter((s) => {
    const m = s.meta as SuggestionMeta | null;
    return !m?.status || m.status === "queued";
  }).length + (proposalsLoaded ? proposals.filter((p) => p.status === "READY_FOR_REVIEW").length : 0);

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-800 pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
            }`}
          >
            <tab.Icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.key === "review" && reviewCount > 0 && (
              <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {reviewCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "search" && <SearchTab />}
      {activeTab === "ingest" && <IngestTab onRefresh={refreshKnowledge} />}
      {activeTab === "review" && (
        <ReviewTab
          suggestions={suggestions}
          proposals={proposals}
          proposalsLoaded={proposalsLoaded}
          onRefreshKnowledge={refreshKnowledge}
          onRefreshProposals={loadProposals}
        />
      )}
      {activeTab === "library" && (
        <LibraryTab
          transcripts={transcripts}
          summaries={summaries}
          insights={insights}
          runs={runs}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SEARCH TAB
// ---------------------------------------------------------------------------

function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}&topK=15`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      } else {
        toast.error("Search failed");
        setResults([]);
      }
    } catch {
      toast.error("Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search knowledge base... (proposals, strategies, transcripts, insights)"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-neutral-700 bg-neutral-900 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading || query.trim().length < 2}>
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </Button>
      </div>

      {!searched && (
        <div className="text-center py-16">
          <Sparkles className="w-8 h-8 text-amber-400/50 mx-auto mb-3" />
          <p className="text-neutral-400 font-medium">Semantic Knowledge Search</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            Search across all ingested knowledge — YouTube transcripts, summaries, insights, proposals, and business artifacts. Powered by vector embeddings.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {["closing strategies", "pricing objections", "client retention", "upsell techniques", "proposal frameworks"].map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); }}
                className="text-xs px-3 py-1.5 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-neutral-400">No results found for &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-neutral-500 mt-1">Try different keywords or ingest more content.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.map((r) => (
            <div key={r.id} className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium text-neutral-200 truncate">{r.title || "Untitled"}</h3>
                  <p className="text-sm text-neutral-400 mt-1 line-clamp-3">{r.content.slice(0, 400)}{r.content.length > 400 ? "…" : ""}</p>
                </div>
                <span className="shrink-0 text-xs text-neutral-600 font-mono">{(r.score * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// INGEST TAB
// ---------------------------------------------------------------------------

function IngestTab({ onRefresh }: { onRefresh: () => void }) {
  const [videoUrl, setVideoUrl] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [maxVideos, setMaxVideos] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
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
      if (!res.ok) { setResult({ ok: false, message: data.error ?? "Ingest failed" }); return; }
      setResult({ ok: data.ok, message: data.ok ? "Ingested successfully." : (data.errors ?? []).join("; ") });
      setVideoUrl("");
      onRefresh();
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
      if (!res.ok) { setResult({ ok: false, message: data.error ?? "Ingest failed" }); return; }
      setResult({ ok: data.ok, message: data.ok ? `Discovered ${data.discovered ?? 0}, ingested ${data.ingested ?? 0}.` : (data.errors ?? []).join("; ") });
      setChannelUrl("");
      onRefresh();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(false);
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
      if (!res.ok) { setQueueMessage(data.error ?? "Failed"); return; }
      setQueueMessage("Added to queue. Next workday run will ingest.");
      setQueueUrl("");
    } catch (e) {
      setQueueMessage(e instanceof Error ? e.message : "Request failed");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-4">
        <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          <Youtube className="w-4 h-4 text-red-500" />
          Ingest YouTube Content
        </h2>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-neutral-500 mb-1">Video URL</label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleIngestVideo()}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
              />
            </div>
            <Button onClick={handleIngestVideo} disabled={loading || !videoUrl.trim()}>
              {loading ? "Ingesting…" : "Ingest Video"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-neutral-500 mb-1">Channel URL</label>
              <input
                type="text"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                placeholder="https://www.youtube.com/@channel"
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
              title="Max videos"
            />
            <Button onClick={handleIngestChannel} disabled={loading || !channelUrl.trim()} variant="outline">
              {loading ? "Ingesting…" : "Ingest Channel"}
            </Button>
          </div>
        </div>

        {result && (
          <p className={`text-sm ${result.ok ? "text-emerald-400" : "text-amber-400"}`}>{result.message}</p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-3">
        <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          <Clock className="w-4 h-4 text-neutral-500" />
          Autopilot Queue
        </h2>
        <p className="text-xs text-neutral-500">URLs added here will be ingested automatically on the next workday run.</p>
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
          <Button variant="outline" onClick={addToQueue} disabled={!queueUrl.trim()}>
            Add to queue
          </Button>
        </div>
        {queueMessage && <p className="text-xs text-neutral-400">{queueMessage}</p>}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// REVIEW TAB
// ---------------------------------------------------------------------------

function ReviewTab({
  suggestions,
  proposals,
  proposalsLoaded,
  onRefreshKnowledge,
  onRefreshProposals,
}: {
  suggestions: Artifact[];
  proposals: Proposal[];
  proposalsLoaded: boolean;
  onRefreshKnowledge: () => void;
  onRefreshProposals: () => void;
}) {
  const [reviewModal, setReviewModal] = useState<{ id: string; action: "promote" | "reject" | "knowledge_only" } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  async function submitReview() {
    if (!reviewModal) return;
    const { id, action } = reviewModal;
    setReviewModal(null);
    try {
      const endpoint = action === "promote" ? `/api/youtube/learning/${id}/promote` : `/api/youtube/learning/${id}/reject`;
      const body = action === "promote"
        ? { reviewerNotes: reviewNotes || undefined }
        : { reviewerNotes: reviewNotes || undefined, knowledgeOnly: action === "knowledge_only" };
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { onRefreshProposals(); toast.success(action === "promote" ? "Promoted to playbook" : "Updated"); }
      else toast.error("Action failed");
    } catch { toast.error("Action failed"); }
    setReviewNotes("");
  }

  const readyProposals = proposals.filter((p) => p.status === "READY_FOR_REVIEW");
  const processedProposals = proposals.filter((p) => p.status !== "READY_FOR_REVIEW");

  return (
    <div className="space-y-6">
      {/* YouTube Learning Review */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
            <Youtube className="w-4 h-4 text-red-500" />
            Learning Proposals
            {readyProposals.length > 0 && (
              <Badge className="bg-blue-500/20 text-blue-400">{readyProposals.length} to review</Badge>
            )}
          </h2>
          {!proposalsLoaded && <span className="text-xs text-neutral-500">Loading…</span>}
        </div>

        {proposalsLoaded && readyProposals.length === 0 && processedProposals.length === 0 && (
          <p className="text-xs text-neutral-500">No learning proposals yet. Ingest YouTube content to generate.</p>
        )}

        {readyProposals.map((p) => (
          <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge(p.status)}
                  {p.category && <span className="text-xs text-neutral-500 capitalize">{p.category.replace(/_/g, " ")}</span>}
                  {p.systemArea && <span className="text-xs font-medium text-blue-400">{p.systemArea}</span>}
                </div>
                <h3 className="text-sm font-medium text-neutral-200 mt-1">{p.transcript.title ?? p.transcript.videoId}</h3>
                <p className="text-sm text-neutral-400 mt-1">{p.summary.slice(0, 300)}{p.summary.length > 300 ? "…" : ""}</p>
              </div>
              <span className="text-xs text-neutral-500 shrink-0">{fmtDate(p.createdAt)}</span>
            </div>

            {Array.isArray(p.extractedPointsJson) && (p.extractedPointsJson as string[]).length > 0 && (
              <div>
                <span className="text-xs text-neutral-500 block mb-1">Key points:</span>
                <ul className="list-disc list-inside text-xs text-neutral-400 space-y-0.5">
                  {(p.extractedPointsJson as string[]).slice(0, 5).map((pt, i) => <li key={i}>{pt}</li>)}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
              {p.producedAssetType && <span>Asset: <span className="text-neutral-300">{p.producedAssetType.replace(/_/g, " ")}</span></span>}
              <a href={p.transcript.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-200 inline-flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> Source
              </a>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setReviewNotes(""); setReviewModal({ id: p.id, action: "promote" }); }}
                className="inline-flex items-center gap-1 rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-900/30">
                <BookMarked className="w-3 h-3" /> Promote
              </button>
              <button onClick={() => { setReviewNotes(""); setReviewModal({ id: p.id, action: "reject" }); }}
                className="inline-flex items-center gap-1 rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30">
                <XCircle className="w-3 h-3" /> Reject
              </button>
              <button onClick={() => { setReviewNotes(""); setReviewModal({ id: p.id, action: "knowledge_only" }); }}
                className="inline-flex items-center gap-1 rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800">
                <Archive className="w-3 h-3" /> Knowledge only
              </button>
            </div>
          </div>
        ))}

        {processedProposals.length > 0 && (
          <details className="text-xs">
            <summary className="text-neutral-500 cursor-pointer hover:text-neutral-400">
              {processedProposals.length} processed proposal{processedProposals.length !== 1 ? "s" : ""}
            </summary>
            <div className="mt-2 space-y-2">
              {processedProposals.map((p) => (
                <div key={p.id} className="border border-neutral-800/50 rounded-lg p-3 opacity-60">
                  <div className="flex items-center gap-2">
                    {statusBadge(p.status)}
                    <span className="text-neutral-300 truncate">{p.transcript.title ?? p.transcript.videoId}</span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Improvement Suggestions */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Improvement Suggestions
        </h2>
        {suggestions.length === 0 ? (
          <p className="text-xs text-neutral-500">No suggestions yet. Ingest content to generate.</p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => {
              const meta = s.meta as SuggestionMeta | null;
              return (
                <SuggestionRow
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  content={s.content}
                  meta={meta}
                  createdAt={s.createdAt}
                  status={meta?.status ?? "queued"}
                  produced={meta?.produced ?? ""}
                  onUpdate={onRefreshKnowledge}
                />
              );
            })}
          </ul>
        )}
      </section>

      {/* Review modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setReviewModal(null)} aria-label="Close" />
          <div className="relative w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-950 p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-neutral-200">
                {reviewModal.action === "promote" ? "Promote to playbook" : reviewModal.action === "knowledge_only" ? "Knowledge only" : "Reject"}
              </h3>
              <button type="button" onClick={() => setReviewModal(null)} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Notes (optional)..."
              rows={3}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
            />
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => void submitReview()}
                className={reviewModal.action === "promote" ? "bg-emerald-700 hover:bg-emerald-600" : "bg-red-800 hover:bg-red-700"}
              >
                {reviewModal.action === "promote" ? "Promote" : reviewModal.action === "knowledge_only" ? "Knowledge only" : "Reject"}
              </Button>
              <Button variant="outline" onClick={() => setReviewModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionRow({
  id, title, content, meta, createdAt, status, produced, onUpdate,
}: {
  id: string;
  title: string;
  content: string;
  meta: SuggestionMeta | null;
  createdAt: string;
  status: string;
  produced: string;
  onUpdate: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  async function patch(updates: { status?: string; produced?: string }) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/knowledge/suggestions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      if (res.ok) onUpdate();
      else toast.error("Failed to update suggestion");
    } catch { toast.error("Failed to update suggestion"); }
    finally { setUpdating(false); }
  }

  return (
    <li className="border border-neutral-800 rounded-lg p-3 bg-neutral-900/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-medium text-neutral-200">{title}</h3>
          {meta?.confidenceTier && (
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
              meta.confidenceTier === "high" ? "bg-emerald-900/50 text-emerald-300" :
              meta.confidenceTier === "medium" ? "bg-amber-900/30 text-amber-300" :
              "bg-neutral-700/50 text-neutral-400"
            }`}>{meta.confidenceTier}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <select value={status} onChange={(e) => patch({ status: e.target.value })} disabled={updating}
            className="rounded border border-neutral-700 bg-neutral-900 text-neutral-200 text-xs px-2 py-1">
            {SUGGESTION_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
          <select value={produced} onChange={(e) => patch({ produced: e.target.value })} disabled={updating}
            className="rounded border border-neutral-700 bg-neutral-900 text-neutral-200 text-xs px-2 py-1" title="Produced (outcome tag)">
            {PRODUCED_TAGS.map((t) => <option key={t.value || "_"} value={t.value}>{t.label}</option>)}
          </select>
          <span className="text-xs text-neutral-500">{new Date(createdAt).toLocaleDateString("en-US")}</span>
        </div>
      </div>
      {meta && <p className="text-xs text-neutral-500 mt-1">{meta.systemArea} · effort {meta.effort}</p>}
      <p className="mt-2 text-sm text-neutral-400">{content.slice(0, 300)}{content.length > 300 ? "…" : ""}</p>
    </li>
  );
}

// ---------------------------------------------------------------------------
// LIBRARY TAB
// ---------------------------------------------------------------------------

function LibraryTab({
  transcripts,
  summaries,
  insights,
  runs,
}: {
  transcripts: Artifact[];
  summaries: Artifact[];
  insights: Artifact[];
  runs: Run[];
}) {
  const [view, setView] = useState<"summaries" | "insights" | "transcripts" | "runs">("summaries");

  const viewTabs = [
    { key: "summaries" as const, label: "Summaries", count: summaries.length },
    { key: "insights" as const, label: "Insights", count: insights.length },
    { key: "transcripts" as const, label: "Transcripts", count: transcripts.length },
    { key: "runs" as const, label: "Ingest Runs", count: runs.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {viewTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              view === t.key
                ? "bg-neutral-700 text-neutral-100 border border-neutral-600"
                : "text-neutral-400 border border-neutral-800 hover:border-neutral-700"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {view === "summaries" && (
        summaries.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4">No summaries yet. Ingest YouTube content to generate.</p>
        ) : (
          <div className="space-y-3">
            {summaries.map((s) => (
              <div key={s.id} className="border-l-2 border-neutral-700 pl-3 py-2">
                <p className="font-medium text-sm text-neutral-200">{s.title}</p>
                <p className="text-sm text-neutral-400 mt-1">{s.content.slice(0, 400)}{s.content.length > 400 ? "…" : ""}</p>
                <span className="text-xs text-neutral-500">{new Date(s.createdAt).toLocaleDateString("en-US")}</span>
              </div>
            ))}
          </div>
        )
      )}

      {view === "insights" && (
        insights.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4">No insights extracted yet.</p>
        ) : (
          <div className="space-y-3">
            {insights.map((i) => (
              <div key={i.id} className="rounded-lg border border-neutral-800 p-3">
                <p className="font-medium text-sm text-neutral-200">{i.title}</p>
                <p className="text-sm text-neutral-400 mt-1">{i.content.slice(0, 300)}{i.content.length > 300 ? "…" : ""}</p>
                <span className="text-xs text-neutral-500">{new Date(i.createdAt).toLocaleDateString("en-US")}</span>
              </div>
            ))}
          </div>
        )
      )}

      {view === "transcripts" && (
        transcripts.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4">No transcripts yet.</p>
        ) : (
          <div className="space-y-2">
            {transcripts.map((t) => (
              <div key={t.id} className="flex items-center justify-between border border-neutral-800 rounded-lg p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-200 truncate">{t.title}</p>
                  <p className="text-xs text-neutral-500">{t.content.slice(0, 100)}…</p>
                </div>
                <span className="text-xs text-neutral-500 shrink-0 ml-3">{new Date(t.createdAt).toLocaleDateString("en-US")}</span>
              </div>
            ))}
          </div>
        )
      )}

      {view === "runs" && (
        runs.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4">No ingest runs yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-neutral-400">
            {runs.map((r) => (
              <li key={r.id} className="flex justify-between items-center border border-neutral-800 rounded-lg p-3">
                <span className="truncate">{r.content.split("\n")[2] ?? r.id}</span>
                <span className="text-xs shrink-0 ml-3">{new Date(r.createdAt).toLocaleString("en-US")}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
