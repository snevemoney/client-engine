"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDateSafe } from "@/lib/ui/date-safe";

type CallLogItem = {
  id: string;
  proposalId: string;
  contactPhone: string;
  outcome: string;
  calledAt: string;
  durationSeconds: number | null;
  externalCallId: string | null;
  proposal: { title: string; company: string | null; clientName: string | null } | null;
};

type ApiResponse = {
  items: CallLogItem[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
};

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "booked_callback":
      return "Booked callback";
    case "requested_manual_followup":
      return "Manual follow-up";
    case "not_interested":
      return "Not interested";
    case "no_answer":
      return "No answer";
    case "opted_out":
      return "Opted out";
    default:
      return outcome.replace(/_/g, " ");
  }
}

function outcomeColor(outcome: string): string {
  switch (outcome) {
    case "booked_callback":
    case "requested_manual_followup":
      return "text-emerald-400";
    case "not_interested":
    case "opted_out":
      return "text-red-400";
    case "no_answer":
      return "text-amber-400";
    default:
      return "text-neutral-400";
  }
}

export default function VoiceCallsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/voice/calls?page=${page}&pageSize=${pageSize}`,
        { credentials: "include", cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        const pag = json.pagination ?? json.meta ?? { total: 0, page: 1, pageSize, totalPages: 0 };
        setData({ items: json.items ?? json.data ?? [], pagination: pag });
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Voice call log</h1>
        <p className="text-neutral-500">Loading…</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pageSize, totalPages: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Voice call log</h1>
        <p className="text-sm text-neutral-400 mt-1">Outcomes from voice follow-up calls.</p>
      </div>

      <div className="rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/50">
              <th className="text-left p-3 font-medium text-neutral-400">Called</th>
              <th className="text-left p-3 font-medium text-neutral-400">Proposal</th>
              <th className="text-left p-3 font-medium text-neutral-400">Phone</th>
              <th className="text-left p-3 font-medium text-neutral-400">Outcome</th>
              <th className="text-left p-3 font-medium text-neutral-400">Duration</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-neutral-500">
                  No voice calls yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-neutral-800 hover:bg-neutral-800/30">
                  <td className="p-3 text-neutral-400">{formatDateSafe(item.calledAt)}</td>
                  <td className="p-3">
                    <Link
                      href={`/dashboard/proposals/${item.proposalId}`}
                      className="text-amber-400 hover:underline"
                    >
                      {item.proposal?.title ?? item.proposalId}
                    </Link>
                    {(item.proposal?.company ?? item.proposal?.clientName) && (
                      <span className="text-neutral-500 ml-1">
                        ({item.proposal.company ?? item.proposal.clientName})
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-neutral-300 font-mono text-xs">{item.contactPhone}</td>
                  <td className={`p-3 font-medium ${outcomeColor(item.outcome)}`}>
                    {outcomeLabel(item.outcome)}
                  </td>
                  <td className="p-3 text-neutral-400">
                    {item.durationSeconds != null ? `${item.durationSeconds}s` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded border border-neutral-700 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-neutral-400">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="px-3 py-1 rounded border border-neutral-700 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      <Link href="/dashboard/proposal-followups?bucket=voice_eligible" className="text-sm text-amber-400 hover:underline">
        ← Voice eligible proposals
      </Link>
    </div>
  );
}
