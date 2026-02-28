import { getRecentJobs, getTranscripts, getLearningProposals, getFailedTranscripts } from "@/lib/youtube/queries";
import dynamicImport from "next/dynamic";

const YouTubeIngestClient = dynamicImport(
  () => import("@/components/dashboard/youtube/YouTubeIngestClient"),
  { loading: () => <div className="animate-pulse h-96 bg-neutral-900/50 rounded-lg" /> }
);

export const dynamic = "force-dynamic";

export default async function YouTubeIngestPage() {
  const [jobs, transcripts, proposals, failedTranscripts] = await Promise.all([
    getRecentJobs({ limit: 30 }),
    getTranscripts({ limit: 30 }),
    getLearningProposals({ limit: 30 }),
    getFailedTranscripts(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">YouTube Ingest</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Paste a video or channel URL. Transcripts are fetched with multi-provider fallback, then classified and queued for review. Nothing auto-applies.
        </p>
      </div>
      <YouTubeIngestClient
        initialJobs={jobs.map((j) => ({
          id: j.id,
          sourceType: j.sourceType,
          status: j.status,
          attempts: j.attempts,
          providerUsed: j.providerUsed,
          lastError: j.lastError,
          queuedAt: j.queuedAt.toISOString(),
          startedAt: j.startedAt?.toISOString() ?? null,
          completedAt: j.completedAt?.toISOString() ?? null,
          source: j.source ? {
            title: j.source.title,
            externalId: j.source.externalId,
            channelName: j.source.channelName,
          } : null,
        }))}
        initialTranscripts={transcripts.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
        }))}
        initialProposals={proposals.map((p) => ({
          ...p,
          extractedPointsJson: p.extractedPointsJson,
          proposedActionsJson: p.proposedActionsJson,
          contradictionFlagsJson: p.contradictionFlagsJson,
          createdAt: p.createdAt.toISOString(),
          transcript: p.transcript,
        }))}
        initialFailedTranscripts={failedTranscripts.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
