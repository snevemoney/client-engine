"use client";

import { useEffect, useState, useCallback } from "react";

type ProviderUsage = {
  provider: string;
  totalRequests: number;
  totalCostUsd: number;
  errorCount: number;
  rateLimitCount: number;
};

type UsageData = {
  period: string;
  totalRequests: number;
  totalCostUsd: number;
  providers: ProviderUsage[];
};

type Period = "24h" | "7d" | "30d" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

export function ApiUsageSection() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/usage?period=${period}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-neutral-200">API Usage & Cost</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Track how many external API calls each integration makes.
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
        >
          {Object.entries(PERIOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-xs text-neutral-500 animate-pulse py-4">Loading usage data…</div>
      ) : !data || data.providers.length === 0 ? (
        <div className="text-xs text-neutral-500 py-4">
          No API usage recorded yet. Usage will appear here once integrations make external calls.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Total requests" value={data.totalRequests.toLocaleString()} />
            <StatCard
              label="Est. cost"
              value={`$${data.totalCostUsd.toFixed(4)}`}
            />
            <StatCard
              label="Providers active"
              value={String(data.providers.length)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-500">
                  <th className="text-left py-2 pr-4 font-medium">Provider</th>
                  <th className="text-right py-2 px-2 font-medium">Requests</th>
                  <th className="text-right py-2 px-2 font-medium">Est. Cost</th>
                  <th className="text-right py-2 px-2 font-medium">Errors</th>
                  <th className="text-right py-2 pl-2 font-medium">Rate Limited</th>
                </tr>
              </thead>
              <tbody>
                {data.providers.map((p) => (
                  <tr key={p.provider} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                    <td className="py-2 pr-4 text-neutral-200 capitalize">{p.provider}</td>
                    <td className="text-right py-2 px-2 text-neutral-300 tabular-nums">
                      {p.totalRequests.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 text-neutral-300 tabular-nums">
                      ${p.totalCostUsd.toFixed(4)}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      <span className={p.errorCount > 0 ? "text-red-400" : "text-neutral-500"}>
                        {p.errorCount}
                      </span>
                    </td>
                    <td className="text-right py-2 pl-2 tabular-nums">
                      <span className={p.rateLimitCount > 0 ? "text-amber-400" : "text-neutral-500"}>
                        {p.rateLimitCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/50 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-lg font-semibold text-neutral-100 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
