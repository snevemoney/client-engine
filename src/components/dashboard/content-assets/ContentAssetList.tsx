"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type ContentAsset = {
  id: string;
  platform: string;
  title: string | null;
  url: string | null;
  publishedAt: string | null;
  topicTag: string | null;
  format: string | null;
  ctaType: string | null;
  views: number | null;
  comments: number | null;
  inboundLeads: number;
  qualifiedLeads: number;
  wonDeals: number;
  cashCollected: number;
  notes: string | null;
  createdAt: string;
};

const platformColors: Record<string, string> = {
  linkedin: "border-blue-800 text-blue-400",
  youtube: "border-red-800 text-red-400",
  tiktok: "border-pink-800 text-pink-400",
  instagram: "border-purple-800 text-purple-400",
};

export function ContentAssetList({ assets }: { assets: ContentAsset[] }) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");

  const platforms = [...new Set(assets.map((a) => a.platform))];

  const filtered = assets.filter((a) => {
    if (platformFilter && a.platform !== platformFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (a.title ?? "").toLowerCase().includes(q) ||
        (a.topicTag ?? "").toLowerCase().includes(q) ||
        (a.notes ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (assets.length === 0) {
    return <p className="text-sm text-neutral-500 py-8 text-center">No content assets tracked yet.</p>;
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm w-48"
        />
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Views</th>
                <th className="px-4 py-3">Inbound</th>
                <th className="px-4 py-3">Won</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-800/30">
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs ${platformColors[a.platform] ?? ""}`}>
                      {a.platform}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-xs truncate">
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-neutral-200 hover:underline">
                          {a.title || "Untitled"}
                        </a>
                      ) : (
                        <span className="text-neutral-300">{a.title || "Untitled"}</span>
                      )}
                    </div>
                    {a.topicTag && <span className="text-xs text-neutral-500">{a.topicTag}</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{a.views?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-400">{a.inboundLeads || "—"}</td>
                  <td className="px-4 py-3 text-emerald-400">{a.wonDeals || "—"}</td>
                  <td className="px-4 py-3 text-emerald-400">{a.cashCollected > 0 ? `$${a.cashCollected.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-neutral-500 text-sm">No matching assets</div>
        )}
      </div>
    </>
  );
}
