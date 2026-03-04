"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PortalClient({ token }: { token: string }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Please enter your feedback");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, content: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to submit");
        return;
      }
      toast.success("Feedback submitted. Thank you!");
      setContent("");
    } catch {
      toast.error("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="feedback" className="block text-sm font-medium text-neutral-300">
        Submit feedback
      </label>
      <textarea
        id="feedback"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share your thoughts, changes, or questions..."
        rows={4}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        disabled={submitting}
      />
      <Button type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}
