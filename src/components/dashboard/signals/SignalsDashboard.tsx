"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

type Source = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  mode: string;
  prodOnly: boolean;
  lastSyncedAt: string | null;
  itemCount: number;
};

type Item = {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string | null;
  score: number;
  tags: string[];
  status: string;
};

export function SignalsDashboard() {
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMinScore, setFilterMinScore] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);

  const loadSources = () =>
    fetch("/api/signals/sources")
      .then((r) => r.json())
      .then((d) => setSources(d.items ?? []));

  const loadItems = () => {
    const params = new URLSearchParams();
    if (filterSource) params.set("sourceId", filterSource);
    if (filterStatus) params.set("status", filterStatus);
    if (filterMinScore) params.set("minScore", filterMinScore);
    return fetch(`/api/signals/items?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  };

  useEffect(() => {
    Promise.all([loadSources(), loadItems()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) loadItems();
  }, [filterSource, filterStatus, filterMinScore]);

  async function handleAddSource() {
    if (!addName.trim() || !addUrl.trim()) return;
    try {
      const res = await fetch("/api/signals/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), url: addUrl.trim(), mode: "live" }),
      });
      if (res.ok) {
        await loadSources();
        setAddOpen(false);
        setAddName("");
        setAddUrl("");
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed");
      }
    } catch {
      alert("Failed");
    }
  }

  async function handleSync(id: string) {
    setSyncing(id);
    try {
      const res = await fetch(`/api/signals/sources/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        await loadSources();
        await loadItems();
      }
      alert(data.message ?? (data.ok ? "Synced" : "Failed"));
    } catch {
      alert("Sync failed");
    }
    setSyncing(null);
  }

  async function updateItemStatus(itemId: string, status: string) {
    try {
      const res = await fetch(`/api/signals/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status } : i)));
      }
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <p className="text-sm text-neutral-500">Loading…</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Sources</h2>
        <div className="space-y-2">
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 py-2 border-b border-neutral-800 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium text-neutral-200">{s.name}</span>
                <span className="text-xs text-neutral-500 ml-2 truncate block">{s.url}</span>
              </div>
              <select
                value={s.mode}
                onChange={async (e) => {
                  const mode = e.target.value as "off" | "mock" | "manual" | "live";
                  const res = await fetch(`/api/signals/sources/${s.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode }),
                  });
                  if (res.ok) setSources((prev) => prev.map((x) => (x.id === s.id ? { ...x, mode } : x)));
                }}
                className="rounded border border-neutral-600 bg-neutral-900 px-2 py-0.5 text-xs capitalize shrink-0"
              >
                <option value="off">Off</option>
                <option value="mock">Mock</option>
                <option value="manual">Manual</option>
                <option value="live">Live</option>
              </select>
              <span className="text-xs text-neutral-500 shrink-0">{s.itemCount} items</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSync(s.id)}
                disabled={syncing === s.id}
              >
                {syncing === s.id ? "Syncing…" : "Sync"}
              </Button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setAddOpen(true)}>
          Add source
        </Button>
      </section>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setAddOpen(false)}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-950 p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-neutral-200">Add RSS source</h3>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Name</label>
                <Input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Hacker News"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Feed URL</label>
                <Input
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <p className="text-xs text-neutral-500">Defaults to MOCK mode. Use Sync to fetch.</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleAddSource} disabled={!addName.trim() || !addUrl.trim()}>
                Add
              </Button>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <h2 className="text-sm font-medium text-neutral-300 p-4 pb-0">Signal feed</h2>
        <div className="p-4 flex flex-wrap gap-2">
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-sm"
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-sm"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="archived">Archived</option>
          </select>
          <Input
            type="number"
            placeholder="Min score"
            value={filterMinScore}
            onChange={(e) => setFilterMinScore(e.target.value)}
            className="w-24 h-8 text-sm"
          />
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-900">
              <tr className="text-left text-neutral-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-neutral-800 hover:bg-neutral-800/30">
                  <td className="px-4 py-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-200 hover:text-amber-300 hover:underline truncate max-w-[300px] block"
                    >
                      {item.title}
                    </a>
                    {item.tags.length > 0 && (
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {item.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs py-0">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-neutral-400">{item.sourceName}</td>
                  <td className="px-4 py-2 text-neutral-500">
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      variant="outline"
                      className={
                        item.score >= 20
                          ? "text-emerald-400 border-emerald-700"
                          : item.score >= 10
                            ? "text-amber-400 border-amber-700"
                            : "text-neutral-500"
                      }
                    >
                      {item.score}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={item.status}
                      onChange={(e) => updateItemStatus(item.id, e.target.value)}
                      className="rounded border border-neutral-600 bg-neutral-900 px-2 py-0.5 text-xs"
                    >
                      <option value="new">New</option>
                      <option value="read">Read</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-300 hover:underline text-xs"
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && (
          <div className="p-8 text-center text-neutral-500">
            <p className="text-sm">No items yet. Add a source and click Sync (MOCK mode works in local).</p>
          </div>
        )}
      </section>
    </div>
  );
}
