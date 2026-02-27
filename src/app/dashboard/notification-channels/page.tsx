"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, ToggleLeft, ToggleRight } from "lucide-react";
import { formatDateTimeSafe } from "@/lib/ui/date-safe";

type Channel = {
  id: string;
  key: string;
  title: string;
  type: string;
  isEnabled: boolean;
  isDefault: boolean;
  severityMin: string | null;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function NotificationChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notification-channels", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");
      setChannels(data?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleToggle = async (id: string, isEnabled: boolean) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/notification-channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !isEnabled }),
      });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        toast.error(d?.error ?? "Update failed");
      }
    } finally {
      setActioningId(null);
    }
  };

  const handleTest = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/notification-channels/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.ok) toast.success("Test sent successfully");
        void fetchData();
      } else {
        toast.error(data?.error ?? "Test failed");
        void fetchData();
      }
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notification Channels</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Configure destinations for notifications. In-app is always available.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/inbox">
            <Button variant="outline" size="sm">Inbox</Button>
          </Link>
          <Link href="/dashboard/notifications">
            <Button variant="outline" size="sm">Events</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      ) : error ? (
        <div className="py-12 text-center text-red-400">{error}</div>
      ) : channels.length === 0 ? (
        <div className="py-12 text-center text-neutral-500">
          No channels. Run <code className="rounded bg-neutral-800 px-1">npm run db:seed-notification-channels</code> to create defaults.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/80">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Title</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Type</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Enabled</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Severity min</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Last success</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Last error</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                  <td className="px-4 py-3">
                    <span className="font-medium">{ch.title}</span>
                    <div className="text-xs text-neutral-500 font-mono">{ch.key}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{ch.type}</Badge>
                    {ch.isDefault && (
                      <Badge className="ml-1 bg-neutral-700">default</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(ch.id, ch.isEnabled)}
                      disabled={actioningId === ch.id}
                      className="text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
                      title={ch.isEnabled ? "Disable" : "Enable"}
                    >
                      {ch.isEnabled ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{ch.severityMin ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-400 text-emerald-400">
                    {formatDateTimeSafe(ch.lastSuccessAt)}
                  </td>
                  <td className="px-4 py-3">
                    {ch.lastErrorAt ? (
                      <span className="text-red-400" title={ch.lastErrorMessage ?? undefined}>
                        {formatDateTimeSafe(ch.lastErrorAt)}
                      </span>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTest(ch.id)}
                      disabled={actioningId === ch.id || !ch.isEnabled}
                      className="gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Test
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
