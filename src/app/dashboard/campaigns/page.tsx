"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Plus, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

type Campaign = {
  id: string;
  slug: string;
  title: string;
  filterTag: string;
  published: boolean;
  ctaLabel: string | null;
  ctaUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "campaign";
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch("/api/campaigns", { credentials: "include" });
    const data = await res.json().catch(() => []);
    setCampaigns(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    fetchCampaigns().finally(() => setLoading(false));
  }, [fetchCampaigns]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !filterTag.trim()) {
      toast.error("Title and filter tag required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          slug: slugFromTitle(title.trim()),
          filterTag: filterTag.trim().toLowerCase(),
          ctaLabel: ctaLabel.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to create");
        return;
      }
      toast.success("Campaign created");
      setTitle("");
      setFilterTag("");
      setCtaLabel("");
      setCtaUrl("");
      fetchCampaigns();
    } finally {
      setCreating(false);
    }
  }

  async function togglePublish(c: Campaign) {
    const res = await fetch(`/api/campaigns/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ published: !c.published }),
    });
    if (res.ok) {
      toast.success(c.published ? "Unpublished" : "Published");
      fetchCampaigns();
    } else {
      const data = await res.json();
      toast.error(data?.error ?? "Failed");
    }
  }

  async function handleDelete(c: Campaign) {
    if (!confirm(`Delete campaign "${c.title}"?`)) return;
    const res = await fetch(`/api/campaigns/${c.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      toast.success("Campaign deleted");
      fetchCampaigns();
    } else {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Group proof pages by filter tag. Campaigns appear at <code className="text-neutral-500">/campaigns/[slug]</code>.
        </p>
      </div>

      <form onSubmit={handleCreate} className="border border-neutral-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-medium text-neutral-300">Create campaign</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 Operator Audit"
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Filter tag (matches project campaignTags)</label>
            <Input
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              placeholder="e.g. nextjs, dashboard"
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">CTA label (optional)</label>
            <Input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="e.g. Book a call"
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">CTA URL (optional)</label>
            <Input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://…"
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
        </div>
        <Button type="submit" disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create
        </Button>
      </form>

      {loading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-8 text-center text-neutral-500">
          No campaigns yet. Create one above.
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Title</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Slug</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Filter tag</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300 w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                  <td className="px-4 py-3 font-medium text-neutral-100">{c.title}</td>
                  <td className="px-4 py-3">
                    <code className="text-neutral-400 text-xs">{c.slug}</code>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{c.filterTag}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        c.published ? "bg-emerald-900/50 text-emerald-400" : "bg-neutral-800 text-neutral-500"
                      }`}
                    >
                      {c.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/campaigns/${c.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-neutral-200"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => togglePublish(c)}
                      >
                        {c.published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(c)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
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
