"use client";

import Link from "next/link";
import { Bell, AlertTriangle } from "lucide-react";

export type NotificationsCardData = {
  pending: number;
  sentToday: number;
  failedToday: number;
  criticalOpen: number;
  unreadInApp: number;
  deadLetterAlerts: number;
  staleJobAlerts: number;
};

export function NotificationsCard({ data }: { data: NotificationsCardData }) {
  const hasAlerts = data.criticalOpen > 0 || data.failedToday > 0 || data.unreadInApp > 0;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
        <Bell className="w-4 h-4" />
        Notifications
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        In-app alerts, escalations, and delivery status.
      </p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Unread</span>
          <span className={data.unreadInApp > 0 ? "font-semibold text-amber-400" : ""}>
            {data.unreadInApp}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Critical open</span>
          <span className={data.criticalOpen > 0 ? "font-semibold text-red-400" : ""}>
            {data.criticalOpen}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Failed today</span>
          <span className={data.failedToday > 0 ? "font-semibold text-red-400" : ""}>
            {data.failedToday}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Pending</span>
          <span>{data.pending}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Sent today</span>
          <span className="text-emerald-400">{data.sentToday}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Dead-letter (7d)</span>
          <span>{data.deadLetterAlerts}</span>
        </div>
      </div>
      {hasAlerts && (
        <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Attention needed
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Link
          href="/dashboard/inbox"
          className="text-xs text-neutral-400 hover:text-neutral-200 underline"
        >
          Inbox
        </Link>
        <Link
          href="/dashboard/notifications"
          className="text-xs text-neutral-400 hover:text-neutral-200 underline"
        >
          Events
        </Link>
        <Link
          href="/dashboard/notification-channels"
          className="text-xs text-neutral-400 hover:text-neutral-200 underline"
        >
          Channels
        </Link>
      </div>
    </section>
  );
}
