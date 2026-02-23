import { db } from "@/lib/db";
import Link from "next/link";
import { getConstraintSnapshot } from "@/lib/ops/constraint";
import { getScorecardSnapshot } from "@/lib/ops/scorecard";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const [runs, stepCounts, constraint, scorecard, lastRunReport, recentFailures] = await Promise.all([
    db.pipelineRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
      include: {
        lead: { select: { id: true, title: true } },
        steps: true,
      },
    }),
    db.pipelineStepRun.groupBy({
      by: ["stepName", "success"],
      _count: true,
    }),
    getConstraintSnapshot(),
    getScorecardSnapshot(),
    db.artifact.findFirst({
      where: {
        lead: { source: "system", title: "Research Engine Runs" },
        title: "WORKDAY_RUN_REPORT",
      },
      orderBy: { createdAt: "desc" },
      select: { content: true, createdAt: true },
    }),
    db.pipelineRun.findMany({
      where: { success: false },
      orderBy: { lastErrorAt: "desc" },
      take: 20,
      include: { steps: { where: { success: false }, select: { stepName: true } }, lead: { select: { title: true } } },
    }),
  ]);

  const failureByStep: Record<string, number> = {};
  for (const run of recentFailures) {
    for (const s of run.steps) {
      failureByStep[s.stepName] = (failureByStep[s.stepName] ?? 0) + 1;
    }
  }

  const byStep = stepCounts.reduce(
    (acc, { stepName, success, _count }) => {
      if (!acc[stepName]) acc[stepName] = { total: 0, ok: 0 };
      acc[stepName].total += _count;
      if (success) acc[stepName].ok += _count;
      return acc;
    },
    {} as Record<string, { total: number; ok: number }>
  );

  const stepOrder = ["enrich", "score", "position", "propose", "build"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scorecard &amp; bottleneck</h1>
        <p className="text-sm text-neutral-400 mt-1">
          INPUT → PROCESS → OUTPUT → FEEDBACK. One constraint to fix at a time.
        </p>
      </div>

      {constraint && (
        <section className="border border-amber-900/50 rounded-lg p-4 bg-amber-950/20">
          <h2 className="text-sm font-medium text-amber-200 mb-2">Current constraint</h2>
          <p className="text-sm text-amber-100/90 mb-2">{constraint.reason}</p>
          <ul className="text-xs text-amber-100/80 list-disc list-inside">
            {constraint.recommendedActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">1) INPUT scorecard</h2>
        <p className="text-xs text-neutral-500 mb-3">Leads discovered, created, source mix, enrichment coverage.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded border border-neutral-800 p-3">
            <div className="text-neutral-500 text-xs">Leads created</div>
            <div className="font-semibold">{scorecard.inputs.created}</div>
          </div>
          <div className="rounded border border-neutral-800 p-3">
            <div className="text-neutral-500 text-xs">By source</div>
            <div className="font-semibold text-xs">
              {Object.entries(scorecard.inputs.bySource)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ") || "—"}
            </div>
          </div>
          <div className="rounded border border-neutral-800 p-3">
            <div className="text-neutral-500 text-xs">Enrichment coverage</div>
            <div className="font-semibold">{scorecard.inputs.enrichmentCoveragePct ?? 0}%</div>
          </div>
        </div>
      </section>

      <section className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">2) PROCESS scorecard</h2>
        <p className="text-xs text-neutral-500 mb-3">Pipeline step success, avg time, retries.</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm mb-3">
          {stepOrder.map((name) => {
            const s = byStep[name] ?? { total: 0, ok: 0 };
            const pct = s.total ? Math.round((s.ok / s.total) * 100) : 0;
            return (
              <div key={name} className="rounded border border-neutral-800 p-2">
                <div className="text-neutral-500 text-xs">{name}</div>
                <div className="font-semibold">{s.ok}/{s.total} ({pct}%)</div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-neutral-500">
          Retries (period): {scorecard.process.retryCounts} · Avg time in stage: enrichment/scoring only.
        </div>
      </section>

      <section className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">3) OUTPUT scorecard</h2>
        <p className="text-xs text-neutral-500 mb-3">Proposals, approvals, builds, outcomes.</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <div className="rounded border border-neutral-800 p-2">
            <div className="text-neutral-500 text-xs">Proposals</div>
            <div className="font-semibold">{scorecard.outputs.proposalsGenerated}</div>
          </div>
          <div className="rounded border border-neutral-800 p-2">
            <div className="text-neutral-500 text-xs">Approved</div>
            <div className="font-semibold">{scorecard.outputs.approvals}</div>
          </div>
          <div className="rounded border border-neutral-800 p-2">
            <div className="text-neutral-500 text-xs">Builds</div>
            <div className="font-semibold">{scorecard.outputs.buildsCreated}</div>
          </div>
          <div className="rounded border border-neutral-800 p-2">
            <div className="text-neutral-500 text-xs">Projects</div>
            <div className="font-semibold">{scorecard.outputs.projectsCreated}</div>
          </div>
          <div className="rounded border border-neutral-800 p-2">
            <div className="text-neutral-500 text-xs">Won / Lost</div>
            <div className="font-semibold">{scorecard.outputs.won} / {scorecard.outputs.lost}</div>
          </div>
        </div>
      </section>

      <section className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">4) FEEDBACK scorecard</h2>
        <p className="text-xs text-neutral-500 mb-3">Failure types, current constraint (above).</p>
        {Object.keys(failureByStep).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {Object.entries(failureByStep).map(([step, count]) => (
              <span key={step} className="rounded bg-red-950/30 border border-red-800/50 px-2 py-1 text-sm">
                {step}: {count}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500">No recent failures by step.</p>
        )}
      </section>

      {lastRunReport && (
        <section className="border border-neutral-800 rounded-lg p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-2">What changed since last run</h2>
          <p className="text-xs text-neutral-500 mb-2">
            {new Date(lastRunReport.createdAt).toLocaleString()}
          </p>
          <pre className="text-xs text-neutral-400 whitespace-pre-wrap font-sans">
            {lastRunReport.content?.slice(0, 600)}
            {lastRunReport.content && lastRunReport.content.length > 600 ? "…" : ""}
          </pre>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Recent runs</h2>
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left py-2 px-3 font-medium text-neutral-400">Lead</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-400">Steps</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-400">Skipped</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-400">Status</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-400">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const skipped = run.steps.filter((s) => s.notes?.startsWith("skipped:"));
                return (
                  <tr key={run.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                    <td className="py-2 px-3">
                      <Link
                        href={`/dashboard/leads/${run.leadId}`}
                        className="text-neutral-200 hover:text-white"
                      >
                        {run.lead.title}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-neutral-400">
                      {run.steps.map((s) => s.stepName).join(", ")}
                    </td>
                    <td className="py-2 px-3 text-neutral-500 text-xs">
                      {skipped.length > 0 ? (
                        <span title={skipped.map((s) => `${s.stepName}: ${s.notes}`).join("; ")}>
                          {skipped.map((s) => s.stepName).join(", ")} ({skipped.length})
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={
                          run.success === true
                            ? "text-emerald-400"
                            : run.success === false
                              ? "text-red-400"
                              : "text-amber-400"
                        }
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-neutral-500">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {runs.length === 0 && (
          <div className="border border-neutral-800 rounded-lg p-8 text-center text-neutral-500">
            No pipeline runs yet. Enrich, score, propose, or build a lead to see metrics.
          </div>
        )}
      </section>
    </div>
  );
}
