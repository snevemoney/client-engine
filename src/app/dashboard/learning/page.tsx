import { getRecentLearningArtifacts } from "@/lib/learning/ingest";
import { LearningPageClient } from "@/components/dashboard/learning/LearningPageClient";

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const { runs, proposals, summaries } = await getRecentLearningArtifacts({ limit: 30 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Learning</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Ingest YouTube videos or channels. Transcripts → summaries → improvement proposals. Human approves before apply.
        </p>
      </div>
      <LearningPageClient
        initialRuns={runs.map((r) => ({
          id: r.id,
          content: r.content,
          meta: r.meta,
          createdAt: r.createdAt.toISOString(),
        }))}
        initialProposals={proposals.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          meta: p.meta,
          createdAt: p.createdAt.toISOString(),
        }))}
        initialSummaries={summaries.map((s) => ({
          id: s.id,
          title: s.title,
          content: s.content,
          meta: s.meta,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
