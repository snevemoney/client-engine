"use client";

import { cn } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  metadataJson?: unknown;
}

const typeLabel: Record<string, string> = {
  note: "Note",
  status_change: "Status change",
  score: "Score",
  draft: "Draft",
  sent: "Sent",
  followup: "Follow-up",
  manual: "Manual",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function LeadActivityTimeline({
  activities,
  emptyMessage = "No activity yet.",
  className,
}: {
  activities: ActivityItem[];
  emptyMessage?: string;
  className?: string;
}) {
  const list = Array.isArray(activities) ? activities : [];
  if (list.length === 0) {
    return (
      <p className={cn("text-neutral-500 text-sm py-4", className)}>{emptyMessage}</p>
    );
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {list.map((a) => (
        <li key={a.id} className="border-l-2 border-neutral-700 pl-4 py-2">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <span className="font-medium text-neutral-300">
              {typeLabel[a.type] ?? a.type}
            </span>
            <span>{formatDate(a.createdAt)}</span>
          </div>
          <p className="text-sm text-neutral-200 whitespace-pre-wrap break-words">
            {a.content || "—"}
          </p>
        </li>
      ))}
    </ul>
  );
}
