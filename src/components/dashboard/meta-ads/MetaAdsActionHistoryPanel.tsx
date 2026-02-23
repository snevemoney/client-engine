"use client";

import { useEffect, useState, useCallback } from "react";

type Action = {
  id: string;
  entityName: string;
  entityType: string;
  actionType: string;
  mode: string;
  dryRun: boolean;
  status: string;
  message: string | null;
  createdAt: string;
};

export function MetaAdsActionHistoryPanel() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meta-ads/actions?limit=30");
      const json = await res.json();
      setActions(json.actions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex justify-between mb-4">
        <h2 className="text-sm font-medium text-neutral-300">Action History</h2>
        <button onClick={fetchActions} disabled={loading} className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-50">Refresh</button>
      </div>
      {loading ? (
        <div className="h-32 rounded bg-neutral-800 animate-pulse" />
      ) : actions.length === 0 ? (
        <p className="text-neutral-500 text-sm py-6 text-center">No actions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left">
                <th className="py-2 px-2 font-medium text-neutral-400">When</th>
                <th className="py-2 px-2 font-medium text-neutral-400">Entity</th>
                <th className="py-2 px-2 font-medium text-neutral-400">Action</th>
                <th className="py-2 px-2 font-medium text-neutral-400">Mode</th>
                <th className="py-2 px-2 font-medium text-neutral-400">Dry</th>
                <th className="py-2 px-2 font-medium text-neutral-400">Status</th>
                <th className="py-2 px-2 font-medium text-neutral-400">Message</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id} className="border-b border-neutral-800/50">
                  <td className="py-2 px-2 text-neutral-500 text-xs">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="py-2 px-2 text-neutral-300 truncate max-w-[120px]" title={a.entityName}>{a.entityName}</td>
                  <td className="py-2 px-2 text-neutral-400">{a.actionType}</td>
                  <td className="py-2 px-2 text-neutral-500 text-xs">{a.mode}</td>
                  <td className="py-2 px-2">{a.dryRun ? "Y" : "—"}</td>
                  <td className="py-2 px-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${a.status === "success" ? "bg-emerald-900/40 text-emerald-200" : a.status === "simulated" ? "bg-blue-900/40 text-blue-200" : "bg-red-900/40 text-red-200"}`}>{a.status}</span>
                  </td>
                  <td className="py-2 px-2 text-neutral-500 text-xs max-w-[200px] truncate" title={a.message ?? ""}>{a.message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
