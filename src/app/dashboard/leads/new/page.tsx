"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

export default function NewLeadPage() {
  const router = useRouter();

  const { execute: handleSubmit, pending: loading } = useAsyncAction(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const fd = new FormData(e.currentTarget);
      const body = {
        title: fd.get("title"),
        source: fd.get("source") || "manual",
        sourceUrl: fd.get("sourceUrl") || undefined,
        description: fd.get("description") || undefined,
        budget: fd.get("budget") || undefined,
        timeline: fd.get("timeline") || undefined,
        platform: fd.get("platform") || undefined,
        contactName: fd.get("contactName") || undefined,
        contactEmail: fd.get("contactEmail") || undefined,
        tags: (fd.get("tags") as string)?.split(",").map((t) => t.trim()).filter(Boolean) || [],
      };

      await fetchJsonThrow("/api/leads", {
        method: "POST",
        body: JSON.stringify(body),
      });

      router.push("/dashboard");
    },
    { toast: toastFn, successMessage: "Lead created" },
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Lead</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Add a lead manually.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="lead-title" className="text-sm font-medium">Title *</label>
            <Input id="lead-title" name="title" required placeholder="e.g. E-commerce site for local bakery" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-source" className="text-sm font-medium">Source</label>
            <Input id="lead-source" name="source" placeholder="upwork, facebook, referral..." defaultValue="manual" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Source URL</label>
            <Input name="sourceUrl" type="url" placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Budget</label>
            <Input name="budget" placeholder="$500-$2000" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Timeline</label>
            <Input name="timeline" placeholder="1-2 weeks" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Platform</label>
            <Input name="platform" placeholder="web, mobile, both" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tags</label>
            <Input name="tags" placeholder="react, ai, automation (comma-separated)" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact Name</label>
            <Input name="contactName" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact Email</label>
            <Input name="contactEmail" type="email" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea name="description" rows={5} placeholder="Project requirements, context, notes..." />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Lead"}
          </Button>
          <Link href="/dashboard">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
