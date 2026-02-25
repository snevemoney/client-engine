"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function InboxBadge({ className }: { className?: string }) {
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/notifications/summary", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUnread(d?.unreadInApp ?? 0))
      .catch(() => setUnread(null));
  }, []);

  if (unread == null || unread === 0) return null;

  return (
    <Link
      href="/dashboard/inbox"
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-amber-400 transition-colors",
        className
      )}
      title={`${unread} unread notifications`}
    >
      <Inbox className="w-4 h-4" />
      <span className="bg-amber-500/20 text-amber-400 rounded-full px-1.5 min-w-[1.25rem] text-center text-xs font-medium">
        {unread > 99 ? "99+" : unread}
      </span>
    </Link>
  );
}
