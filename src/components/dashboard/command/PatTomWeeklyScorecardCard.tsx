import type { PatTomWeeklyScorecard } from "@/lib/ops/patTomWeeklyScorecard";

export function PatTomWeeklyScorecardCard({ data }: { data: PatTomWeeklyScorecard }) {
  return (
    <section className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">
        Pat / Tom weekly scorecard
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        Does the system make you more money and more scalable? Check every Friday.
      </p>
      <div className="rounded-md bg-neutral-900/60 border border-neutral-700/60 p-3 mb-4">
        <p className="text-sm text-neutral-200 italic">&ldquo;{data.sentence}&rdquo;</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
        <div>
          <p className="text-neutral-500 uppercase tracking-wider">Deals closed (7d)</p>
          <p className="text-neutral-200 font-medium tabular-nums">{data.dealsClosed7d}</p>
        </div>
        <div>
          <p className="text-neutral-500 uppercase tracking-wider">Cash collected</p>
          <p className="text-neutral-200 font-medium">
            {data.cashCollected != null ? `$${data.cashCollected.toLocaleString("en-US")}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-neutral-500 uppercase tracking-wider">Turnaround (days)</p>
          <p className="text-neutral-200 font-medium tabular-nums">
            {data.turnaroundDays != null ? data.turnaroundDays : "—"}
          </p>
        </div>
        <div>
          <p className="text-neutral-500 uppercase tracking-wider">Outcomes tracked %</p>
          <p className="text-neutral-200 font-medium tabular-nums">{data.clientOutcomesPct}%</p>
        </div>
        <div>
          <p className="text-neutral-500 uppercase tracking-wider">Reusable assets %</p>
          <p className="text-neutral-200 font-medium tabular-nums">{data.reusableAssetsPct}%</p>
        </div>
        <div>
          <p className="text-neutral-500 uppercase tracking-wider">Failures surfaced</p>
          <p className="text-neutral-200 font-medium tabular-nums">{data.failuresSurfaced}</p>
        </div>
        <div>
          <p className="text-neutral-500 uppercase tracking-wider">Run status</p>
          <p className={data.runStatus === "ok" ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
            {data.runStatus === "ok" ? "OK" : "No run 24h"}
          </p>
        </div>
      </div>
    </section>
  );
}
