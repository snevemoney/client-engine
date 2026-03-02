"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AsyncState } from "@/components/ui/AsyncState";

interface TimelineEntry {
  id: string;
  entityType: "intake" | "lead" | "proposal" | "delivery" | "interaction";
  entityId: string;
  entityTitle: string;
  activityType: string;
  message: string;
  createdAt: string;
  channel?: string | null;
  direction?: string | null;
  nextActionSummary?: string | null;
  nextActionDueAt?: string | null;
}

const entityColors: Record<string, string> = {
  intake: "border-blue-800 text-blue-400",
  lead: "border-neutral-700 text-neutral-300",
  proposal: "border-amber-800 text-amber-400",
  delivery: "border-emerald-800 text-emerald-400",
  interaction: "border-violet-800 text-violet-400",
};

const entityLinks: Record<string, string> = {
  intake: "/dashboard/intake/",
  proposal: "/dashboard/proposals/",
  delivery: "/dashboard/delivery/",
};

export function ClientJourneyTimeline({ leadId }: { leadId: string }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/timeline`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load timeline");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  return (
    <div className="border border-neutral-800 rounded-lg p-4">
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
        Client Journey
      </h3>
      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && entries.length === 0}
        emptyMessage="No activity across linked entities yet"
        onRetry={fetchTimeline}
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {entries.map((entry) => {
            const linkBase = entityLinks[entry.entityType];
            return (
              <div key={entry.id} className="flex items-start gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-xs ${entityColors[entry.entityType] ?? ""}`}>
                      {entry.entityType}
                    </Badge>
                    {linkBase ? (
                      <Link
                        href={`${linkBase}${entry.entityId}`}
                        className="text-neutral-400 hover:text-neutral-200 hover:underline truncate text-xs"
                      >
                        {entry.entityTitle}
                      </Link>
                    ) : (
                      <span className="text-neutral-400 text-xs truncate">{entry.entityTitle}</span>
                    )}
                    <span className="text-xs text-neutral-600">
                      {new Date(entry.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-neutral-300 text-xs mt-0.5 line-clamp-2">{entry.message}</p>
                  {entry.entityType === "interaction" && (entry.channel || entry.nextActionSummary) && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {entry.channel && (
                        <span className="text-[10px] text-violet-400 bg-violet-950/40 px-1.5 py-0.5 rounded">
                          {entry.channel.replace("_", " ")}
                        </span>
                      )}
                      {entry.direction && (
                        <span className="text-[10px] text-neutral-500">{entry.direction}</span>
                      )}
                      {entry.nextActionSummary && (
                        <span className="text-[10px] text-amber-400">
                          Next: {entry.nextActionSummary}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AsyncState>
    </div>
  );
}
