import { getRecentKnowledgeArtifacts } from "@/lib/knowledge/ingest";
import { KnowledgePageClient } from "@/components/dashboard/knowledge/KnowledgePageClient";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const data = await getRecentKnowledgeArtifacts({ limit: 30 });
  const runs = data.runs.map((r) => ({ id: r.id, content: r.content, meta: r.meta, createdAt: r.createdAt.toISOString() }));
  const transcripts = data.transcripts.map((t) => ({ id: t.id, title: t.title, content: t.content, meta: t.meta, createdAt: t.createdAt.toISOString() }));
  const summaries = data.summaries.map((s) => ({ id: s.id, title: s.title, content: s.content, meta: s.meta, createdAt: s.createdAt.toISOString() }));
  const insights = data.insights.map((i) => ({ id: i.id, title: i.title, content: i.content, meta: i.meta, createdAt: i.createdAt.toISOString() }));
  const suggestions = data.suggestions.map((s) => ({ id: s.id, title: s.title, content: s.content, meta: s.meta, createdAt: s.createdAt.toISOString() }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Ingest YouTube videos or channels. Transcripts, summaries, insights, improvement suggestions. Human approves before apply.
        </p>
      </div>
      <KnowledgePageClient
        initialRuns={runs}
        initialTranscripts={transcripts}
        initialSummaries={summaries}
        initialInsights={insights}
        initialSuggestions={suggestions}
      />
    </div>
  );
}
