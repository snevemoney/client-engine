"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Send, Loader2 } from "lucide-react";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { AsyncState } from "@/components/ui/AsyncState";
import { formatDateSafe } from "@/lib/ui/date-safe";
import { useBrainPanel } from "@/contexts/BrainPanelContext";

type ContentPost = {
  id: string;
  proofRecordId: string;
  proofTitle: string | null;
  platform: string;
  content: string;
  status: string;
  scheduledFor: string | null;
  postedAt: string | null;
  generatedBy: string | null;
  createdAt: string;
};

const STATUS_BADGE: Record<string, "default" | "warning" | "success" | "destructive"> = {
  draft: "default",
  scheduled: "warning",
  posted: "success",
  failed: "destructive",
};

const PLATFORM_STYLE: Record<string, string> = {
  linkedin: "border-blue-500/40 text-blue-400",
  twitter: "border-neutral-500/40 text-neutral-300",
  email_newsletter: "border-amber-500/40 text-amber-400",
};

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

export default function ContentPostsPage() {
  const url = useUrlQueryState();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusFilter = url.getString("status", "all");
  const platformFilter = url.getString("platform", "all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const { setPageData } = useBrainPanel();

  const fetchPosts = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (platformFilter !== "all") params.set("platform", platformFilter);
      const res = await fetch(`/api/content-posts?${params}`, {
        credentials: "include",
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      setPosts(Array.isArray(data?.posts) ? data.posts : []);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setPosts([]);
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [statusFilter, platformFilter]);

  useEffect(() => {
    void fetchPosts();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchPosts]);

  useEffect(() => {
    if (loading) return;
    const draft = posts.filter((p) => p.status === "draft").length;
    const scheduled = posts.filter((p) => p.status === "scheduled").length;
    const posted = posts.filter((p) => p.status === "posted").length;
    setPageData(
      `Content Posts: ${posts.length} total (${draft} draft, ${scheduled} scheduled, ${posted} posted).`
    );
  }, [posts, loading, setPageData]);

  const runAction = async (postId: string, fn: () => Promise<Response>) => {
    setActionLoading(postId);
    try {
      const res = await fn();
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : `Action failed (${res.status})`);
        return;
      }
      toast.success(data?.post?.status === "posted" ? "Post executed" : "Post scheduled");
      void fetchPosts();
    } catch {
      toast.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content Posts</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Drafts and published content generated from proof records.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => url.setFilter("status", e.target.value)}
          className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
        >
          <option value="all">Status: All</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="posted">Posted</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={platformFilter}
          onChange={(e) => url.setFilter("platform", e.target.value)}
          className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm"
        >
          <option value="all">Platform: All</option>
          <option value="linkedin">LinkedIn</option>
          <option value="twitter">Twitter</option>
          <option value="email_newsletter">Newsletter</option>
        </select>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && posts.length === 0}
        emptyMessage="No content posts yet. Promote a proof candidate to auto-generate drafts."
        onRetry={fetchPosts}
      >
        {posts.length > 0 ? (
          <div className="border border-neutral-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-700 bg-neutral-900/50">
                    <th className="text-left p-3 font-medium text-neutral-400">Proof</th>
                    <th className="text-left p-3 font-medium text-neutral-400">Platform</th>
                    <th className="text-left p-3 font-medium text-neutral-400">Preview</th>
                    <th className="text-left p-3 font-medium text-neutral-400">Status</th>
                    <th className="text-left p-3 font-medium text-neutral-400">Scheduled</th>
                    <th className="text-left p-3 font-medium text-neutral-400">Posted</th>
                    <th className="text-left p-3 font-medium text-neutral-400">Created</th>
                    <th className="text-left p-3 font-medium text-neutral-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id} className="border-b border-neutral-800 hover:bg-neutral-800/30">
                      <td className="p-3 font-medium text-neutral-100">
                        {p.proofTitle || p.proofRecordId.slice(0, 8)}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={PLATFORM_STYLE[p.platform] ?? ""}>
                          {p.platform === "email_newsletter" ? "newsletter" : p.platform}
                        </Badge>
                      </td>
                      <td className="p-3 text-neutral-300 max-w-xs">
                        {truncate(p.content)}
                      </td>
                      <td className="p-3">
                        <Badge variant={STATUS_BADGE[p.status] ?? "default"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-neutral-400">
                        {p.scheduledFor ? formatDateSafe(p.scheduledFor, { month: "short", day: "numeric", hour: "numeric" }) : "—"}
                      </td>
                      <td className="p-3 text-neutral-400">
                        {p.postedAt ? formatDateSafe(p.postedAt, { month: "short", day: "numeric", hour: "numeric" }) : "—"}
                      </td>
                      <td className="p-3 text-neutral-400">
                        {formatDateSafe(p.createdAt, { month: "short", day: "numeric" })}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {p.status === "draft" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={actionLoading === p.id}
                                onClick={() =>
                                  runAction(p.id, () =>
                                    fetch(`/api/content-posts/${p.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      credentials: "include",
                                      body: JSON.stringify({ action: "schedule" }),
                                    })
                                  )
                                }
                              >
                                {actionLoading === p.id ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Calendar className="h-3 w-3 mr-1" />
                                )}
                                Schedule
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={actionLoading === p.id}
                                onClick={() =>
                                  runAction(p.id, () =>
                                    fetch(`/api/content-posts/${p.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      credentials: "include",
                                      body: JSON.stringify({ action: "execute" }),
                                    })
                                  )
                                }
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Post Now
                              </Button>
                            </>
                          )}
                          {p.status === "scheduled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionLoading === p.id}
                              onClick={() =>
                                runAction(p.id, () =>
                                  fetch(`/api/content-posts/${p.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ action: "execute" }),
                                  })
                                )
                              }
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Post Now
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}
