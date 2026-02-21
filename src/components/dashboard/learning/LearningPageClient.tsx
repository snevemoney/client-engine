"use client";

import { useState } from "react";

type Run = { id: string; content: string; meta: unknown; createdAt: string };
type Proposal = { id: string; title: string; content: string; meta: unknown; createdAt: string };
type Summary = { id: string; title: string; content: string; meta: unknown; createdAt: string };

type ProposalMeta = {
  title?: string;
  sourceVideo?: string;
  sourceChannel?: string;
  insightType?: string;
  problemObserved?: string;
  principle?: string;
  proposedChange?: string;
  expectedImpact?: string;
  effort?: string;
  risk?: string;
  metricToTrack?: string;
  rollbackPlan?: string;
  applyTarget?: string;
};

export function LearningPageClient({
  initialRuns,
  initialProposals,
  initialSummaries,
}: {
  initialRuns: Run[];
  initialProposals: Proposal[];
  initialSummaries: Summary[];
}) {
  const [url, setUrl] = useState("");
  const [urlType, setUrlType] = useState<"video" | "channel">("video");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [runs, setRuns] = useState(initialRuns);
  const [proposals, setProposals] = useState(initialProposals);
  const [summaries, setSummaries] = useState(initialSummaries);
  const [filterChannel, setFilterChannel] = useState("");
  const [filterTag, setFilterTag] = useState("");

  async function handleIngest() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    try {
      const body =
        urlType === "channel"
          ? { channelUrl: trimmed, maxVideos: 10 }
          : { videoUrl: trimmed };
      const res = await fetch("/api/learning/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Ingest failed" });
        return;
      }
      setResult({
        ok: data.ok,
        message: data.ok
          ? `Ingested ${data.ingested}. ${data.errors?.length ? `Errors: ${data.errors.join("; ")}` : ""}`
          : (data.errors ?? []).join("; "),
      });
      setUrl("");
      const listRes = await fetch("/api/learning?limit=30");
      if (listRes.ok) {
        const list = await listRes.json();
        setRuns(list.runs ?? []);
        setProposals(list.proposals ?? []);
        setSummaries(list.summaries ?? []);
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  const metaProposal = (p: Proposal): ProposalMeta | undefined => (p.meta as { proposal?: ProposalMeta })?.proposal;
  const filteredProposals = proposals.filter((p) => {
    const prop = metaProposal(p);
    if (filterChannel && prop?.sourceChannel && !String(prop.sourceChannel).toLowerCase().includes(filterChannel.toLowerCase()))
      return false;
    if (filterTag && prop?.insightType && !String(prop.insightType).toLowerCase().includes(filterTag.toLowerCase()))
      return false;
    return true;
  });

  function ProposalBlock({ p }: { p: Proposal }) {
    const prop = metaProposal(p);
    return (
      <li className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/30 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-medium text-neutral-200">{p.title}</h3>
            <p className="text-xs text-neutral-500 mt-1">
              {prop?.insightType && <span className="capitalize">{prop.insightType}</span>}
              {prop?.effort && ` · effort: ${prop.effort}`}
              {prop?.risk && ` · risk: ${prop.risk}`}
              {prop?.applyTarget && ` · apply: ${prop.applyTarget}`}
              {prop?.sourceChannel && ` · ${prop.sourceChannel}`}
            </p>
          </div>
          <span className="text-xs text-neutral-500 shrink-0">{new Date(p.createdAt).toLocaleDateString()}</span>
        </div>
        {prop && typeof prop === "object" && (
          <div className="grid gap-2 text-sm">
            {prop.sourceVideo && (
              <p><span className="text-neutral-500">Source video:</span> <a href={prop.sourceVideo} target="_blank" rel="noopener noreferrer" className="text-neutral-300 underline truncate block">{prop.sourceVideo}</a></p>
            )}
            {prop.problemObserved && <p><span className="text-neutral-500">Problem:</span> <span className="text-neutral-300">{prop.problemObserved}</span></p>}
            {prop.principle && <p><span className="text-neutral-500">Principle:</span> <span className="text-neutral-300">{prop.principle}</span></p>}
            {prop.proposedChange && <p><span className="text-neutral-500">Proposed change:</span> <span className="text-neutral-300">{prop.proposedChange}</span></p>}
            {prop.expectedImpact && <p><span className="text-neutral-500">Expected impact:</span> <span className="text-neutral-300">{prop.expectedImpact}</span></p>}
            {(prop.metricToTrack || prop.rollbackPlan) && (
              <p className="text-xs text-neutral-500">
                {prop.metricToTrack && `Track: ${prop.metricToTrack}. `}
                {prop.rollbackPlan && `Rollback: ${prop.rollbackPlan}`}
              </p>
            )}
          </div>
        )}
        <pre className="text-xs text-neutral-400 whitespace-pre-wrap font-sans max-h-32 overflow-y-auto border-t border-neutral-800 pt-2 mt-2">
          {p.content.slice(0, 500)}{p.content.length > 500 ? "…" : ""}
        </pre>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Paste URL</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={urlType === "video" ? "https://www.youtube.com/watch?v=..." : "https://www.youtube.com/channel/..."}
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
          <button
            onClick={handleIngest}
            disabled={loading || !url.trim()}
            className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
          >
            {loading ? "Ingesting…" : "Ingest"}
          </button>
        </div>
        {result && (
          <p className={`mt-2 text-sm ${result.ok ? "text-neutral-400" : "text-amber-400"}`}>
            {result.message}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Proposed improvements</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            placeholder="Filter by channel"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-500 w-48"
          />
          <input
            type="text"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            placeholder="Filter by tag"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-500 w-32"
          />
        </div>
        {filteredProposals.length === 0 ? (
          <p className="text-xs text-neutral-500">No improvement proposals yet. Ingest a video to generate.</p>
        ) : (
          <ul className="space-y-3">
            {filteredProposals.map((p) => <ProposalBlock key={p.id} p={p} />)}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Recent learning summaries</h2>
        {summaries.length === 0 ? (
          <p className="text-xs text-neutral-500">No summaries yet.</p>
        ) : (
          <ul className="space-y-2">
            {summaries.map((s) => (
              <li key={s.id} className="border-l-2 border-neutral-700 pl-3 py-1">
                <p className="text-sm text-neutral-300">{s.content.slice(0, 300)}{s.content.length > 300 ? "…" : ""}</p>
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
          <ul className="space-y-2 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex justify-between items-center text-neutral-400">
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
