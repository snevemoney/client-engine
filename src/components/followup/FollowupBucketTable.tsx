"use client";

import Link from "next/link";
import { Phone, Mail, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { LeadStatusBadge } from "@/components/intake/LeadStatusBadge";
import { LeadSourceBadge } from "@/components/intake/LeadSourceBadge";
import { LeadScoreBadge } from "@/components/intake/LeadScoreBadge";
import { FollowupDueBadge, type DueBucket } from "./FollowupDueBadge";

export type FollowUpItem = {
  id: string;
  title: string;
  company: string | null;
  source: string;
  status: string;
  score: number | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  followUpDueAt: string | null;
  promotedLeadId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  lastContactedAt: string | null;
  followUpCount: number;
  followUpCompletedAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export function FollowupBucketTable({
  items,
  bucket,
  onComplete,
  onSnooze,
  onLogCall,
  onLogEmail,
  actionLoading,
}: {
  items: FollowUpItem[];
  bucket: DueBucket;
  onComplete: (item: FollowUpItem) => void;
  onSnooze: (item: FollowUpItem) => void;
  onLogCall: (item: FollowUpItem) => void;
  onLogEmail: (item: FollowUpItem) => void;
  actionLoading: string | null;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-500 py-4 px-3">None</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-700 bg-neutral-900/50">
            <th className="text-left p-3 font-medium text-neutral-400">Lead</th>
            <th className="text-left p-3 font-medium text-neutral-400">Company</th>
            <th className="text-left p-3 font-medium text-neutral-400">Source</th>
            <th className="text-left p-3 font-medium text-neutral-400">Status</th>
            <th className="text-left p-3 font-medium text-neutral-400">Score</th>
            <th className="text-left p-3 font-medium text-neutral-400">Next action</th>
            <th className="text-left p-3 font-medium text-neutral-400">Due</th>
            <th className="text-left p-3 font-medium text-neutral-400">Pipeline</th>
            <th className="text-left p-3 font-medium text-neutral-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const dueIso = item.nextActionDueAt ?? item.followUpDueAt;
            const loading = actionLoading === item.id;
            return (
              <tr
                key={item.id}
                className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors"
              >
                <td className="p-3">
                  <Link
                    href={`/dashboard/intake/${item.id}`}
                    className="font-medium text-neutral-100 hover:text-white hover:underline"
                  >
                    {item.title || "—"}
                  </Link>
                </td>
                <td className="p-3 text-neutral-300">{item.company ?? "—"}</td>
                <td className="p-3">
                  <LeadSourceBadge source={item.source} />
                </td>
                <td className="p-3">
                  <LeadStatusBadge status={item.status} />
                </td>
                <td className="p-3">
                  <LeadScoreBadge score={item.score} />
                </td>
                <td className="p-3 text-neutral-400 max-w-[120px] truncate" title={item.nextAction ?? undefined}>
                  {item.nextAction ?? "—"}
                </td>
                <td className="p-3" title={dueIso ?? undefined}>
                  {formatDate(dueIso)}
                </td>
                <td className="p-3">
                  {item.promotedLeadId ? (
                    <Link
                      href={`/dashboard/leads/${item.promotedLeadId}`}
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" /> Pipeline
                    </Link>
                  ) : (
                    <span className="text-neutral-500 text-xs">—</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => onComplete(item)}
                      disabled={loading}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/50 border border-emerald-700/50 disabled:opacity-50"
                      title="Complete"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => onSnooze(item)}
                      disabled={loading}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs bg-amber-900/50 text-amber-300 hover:bg-amber-800/50 border border-amber-700/50 disabled:opacity-50"
                      title="Snooze"
                    >
                      <Clock className="h-3 w-3" />
                      Snooze
                    </button>
                    <button
                      type="button"
                      onClick={() => onLogCall(item)}
                      disabled={loading}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs bg-neutral-700/50 text-neutral-200 hover:bg-neutral-600/50 border border-neutral-600 disabled:opacity-50"
                      title="Log call"
                    >
                      <Phone className="h-3 w-3" />
                      Call
                    </button>
                    <button
                      type="button"
                      onClick={() => onLogEmail(item)}
                      disabled={loading}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs bg-neutral-700/50 text-neutral-200 hover:bg-neutral-600/50 border border-neutral-600 disabled:opacity-50"
                      title="Log email"
                    >
                      <Mail className="h-3 w-3" />
                      Email
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
