import { getOutcomeScorecard } from "@/lib/ops/outcomeScorecard";
import { getScoreCalibrationData } from "@/lib/ops/scoreCalibration";
import { ScoreCalibrationChart } from "@/components/dashboard/scorecard/ScoreCalibrationChart";

export const dynamic = "force-dynamic";

export default async function ScorecardPage() {
  const [scorecard, calibration] = await Promise.all([
    getOutcomeScorecard(),
    getScoreCalibrationData(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scorecard</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Win rate by source and score bucket, quoted vs actual revenue, and
          score calibration (AI score vs actual revenue).
        </p>
      </div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">
          Time to close
        </h2>
        <p className="text-neutral-200 font-medium">
          {scorecard.timeToCloseMedianDays != null
            ? `${scorecard.timeToCloseMedianDays}d median (proposal sent → outcome)`
            : "No data yet"}
        </p>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">
          Win rate by source
        </h2>
        {scorecard.winRateBySource.length === 0 ? (
          <p className="text-sm text-neutral-500">No data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-700 text-left">
                  <th className="py-2 pr-4 font-medium text-neutral-400">
                    Source
                  </th>
                  <th className="py-2 pr-4 font-medium text-neutral-400">Won</th>
                  <th className="py-2 pr-4 font-medium text-neutral-400">Lost</th>
                  <th className="py-2 font-medium text-neutral-400">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {scorecard.winRateBySource.map((row) => (
                  <tr
                    key={row.source}
                    className="border-b border-neutral-800/50"
                  >
                    <td className="py-2 pr-4 text-neutral-200">{row.source}</td>
                    <td className="py-2 pr-4 text-neutral-300">{row.won}</td>
                    <td className="py-2 pr-4 text-neutral-300">{row.lost}</td>
                    <td className="py-2 text-emerald-400">{row.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">
          Win rate by score bucket
        </h2>
        {scorecard.winRateByScoreBucket.length === 0 ? (
          <p className="text-sm text-neutral-500">No data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-700 text-left">
                  <th className="py-2 pr-4 font-medium text-neutral-400">
                    Score bucket
                  </th>
                  <th className="py-2 pr-4 font-medium text-neutral-400">Won</th>
                  <th className="py-2 pr-4 font-medium text-neutral-400">Lost</th>
                  <th className="py-2 font-medium text-neutral-400">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {scorecard.winRateByScoreBucket.map((row) => (
                  <tr
                    key={row.bucket}
                    className="border-b border-neutral-800/50"
                  >
                    <td className="py-2 pr-4 text-neutral-200">{row.bucket}</td>
                    <td className="py-2 pr-4 text-neutral-300">{row.won}</td>
                    <td className="py-2 pr-4 text-neutral-300">{row.lost}</td>
                    <td className="py-2 text-emerald-400">{row.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">
          Quoted vs actual revenue
        </h2>
        {scorecard.quotedVsActual.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No data yet. Record outcomes on paid projects in Deploys.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-700 text-left">
                  <th className="py-2 pr-4 font-medium text-neutral-400">
                    Project
                  </th>
                  <th className="py-2 pr-4 font-medium text-neutral-400">
                    Quoted
                  </th>
                  <th className="py-2 pr-4 font-medium text-neutral-400">
                    Actual
                  </th>
                  <th className="py-2 font-medium text-neutral-400">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody>
                {scorecard.quotedVsActual.map((row) => (
                  <tr
                    key={row.projectId}
                    className="border-b border-neutral-800/50"
                  >
                    <td className="py-2 pr-4 text-neutral-200 truncate max-w-[200px]">
                      {row.projectName}
                    </td>
                    <td className="py-2 pr-4 text-neutral-300">
                      {row.quotedCents != null
                        ? `$${(row.quotedCents / 100).toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-neutral-300">
                      {row.actualCents != null
                        ? `$${(row.actualCents / 100).toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="py-2">
                      {row.variancePct != null ? (
                        <span
                          className={
                            row.variancePct >= 0
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }
                        >
                          {row.variancePct > 0 ? "+" : ""}
                          {row.variancePct}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">
          Score calibration (AI score vs actual revenue)
        </h2>
        <ScoreCalibrationChart data={calibration} />
      </section>
    </div>
  );
}
