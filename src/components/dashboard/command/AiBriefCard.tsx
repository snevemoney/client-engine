import { BriefMeCard } from "./BriefMeCard";

type Brief = {
  at: string;
  summary: string;
  counts: {
    newLeads: number;
    proposalsReady: number;
    approvalsNeeded: number;
    buildReady: number;
    failedRuns: number;
  };
};

export function AiBriefCard({ latestBrief }: { latestBrief: Brief | null }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">AI Brief</h2>
      {latestBrief ? (
        <div className="text-sm text-neutral-400 space-y-1">
          <p>{latestBrief.summary}</p>
          <p className="text-xs text-neutral-500">
            At {new Date(latestBrief.at).toLocaleString()} · Leads: {latestBrief.counts.newLeads} ·
            Proposals: {latestBrief.counts.proposalsReady} · Build ready: {latestBrief.counts.buildReady}
          </p>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">No briefing yet. Click &quot;Brief Me&quot; to generate.</p>
      )}
    </section>
  );
}
