import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const [runs, stepCounts] = await Promise.all([
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
  ]);

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
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline metrics</h1>
        <p className="text-sm text-neutral-400 mt-1">
          What’s working: step volume and success rate. Macro = funnel; micro = per-step quality.
        </p>
      </div>

      <section className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-4">Step success (macro)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {stepOrder.map((name) => {
            const s = byStep[name] ?? { total: 0, ok: 0 };
            const pct = s.total ? Math.round((s.ok / s.total) * 100) : 0;
            return (
              <div key={name} className="bg-neutral-900/50 rounded-lg p-3 border border-neutral-800">
                <div className="text-xs uppercase tracking-wider text-neutral-500">{name}</div>
                <div className="mt-1 text-lg font-semibold text-neutral-100">
                  {s.ok}/{s.total}
                </div>
                <div className="text-xs text-neutral-400">{pct}% success</div>
              </div>
            );
          })}
        </div>
      </section>

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
