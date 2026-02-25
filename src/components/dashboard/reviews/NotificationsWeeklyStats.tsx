"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type NotifStats = {
  sentToday?: number;
  failedToday?: number;
  criticalOpen?: number;
  deadLetterAlerts?: number;
};

export function NotificationsWeeklyStats() {
  const [stats, setStats] = useState<NotifStats | null>(null);

  useEffect(() => {
    fetch("/api/notifications/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d === "object") {
          setStats({
            sentToday: d.sentToday,
            failedToday: d.failedToday,
            criticalOpen: d.criticalOpen,
            deadLetterAlerts: d.deadLetterAlerts,
          });
        }
      })
      .catch(() => setStats(null));
  }, []);

  const sent = stats?.sentToday ?? 0;
  const failed = stats?.failedToday ?? 0;
  const critical = stats?.criticalOpen ?? 0;
  const deadLetter = stats?.deadLetterAlerts ?? 0;
  const hasAny = sent > 0 || failed > 0 || critical > 0 || deadLetter > 0;

  if (!hasAny) return null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
        Notifications
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {sent > 0 && (
          <span>
            Sent today: <strong className="text-emerald-400">{sent}</strong>
          </span>
        )}
        {failed > 0 && (
          <Link href="/dashboard/notifications?status=failed" className="text-red-400 hover:underline">
            Failed today: <strong>{failed}</strong>
          </Link>
        )}
        {critical > 0 && (
          <Link href="/dashboard/inbox" className="text-red-400 hover:underline">
            Critical open: <strong>{critical}</strong>
          </Link>
        )}
        {deadLetter > 0 && (
          <span>
            Dead-letter (7d): <strong className="text-amber-400">{deadLetter}</strong>
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <Link href="/dashboard/inbox" className="text-xs text-amber-400 hover:underline">
          Inbox
        </Link>
        <Link href="/dashboard/notifications" className="text-xs text-amber-400 hover:underline">
          Events
        </Link>
      </div>
    </div>
  );
}
