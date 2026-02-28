"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

export default function NewProposalPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [company, setCompany] = useState("");
  const [summary, setSummary] = useState("");

  const { execute: submitProposal, pending: loading } = useAsyncAction(
    async () => {
      return fetchJsonThrow<{ id: string }>("/api/proposals", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          clientName: clientName.trim() || null,
          company: company.trim() || null,
          summary: summary.trim() || null,
        }),
      });
    },
    {
      toast: toastFn,
      successMessage: "Proposal created",
      onSuccess: (data) => {
        router.push(`/dashboard/proposals/${data.id}`);
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await submitProposal();
  };

  return (
    <div className="max-w-md space-y-6">
      <div>
        <Link href="/dashboard/proposals" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Proposals
        </Link>
        <h1 className="text-2xl font-semibold mt-2">New proposal</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Proposal title"
            required
            className="bg-neutral-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Client name</label>
          <Input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Client name"
            className="bg-neutral-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Company</label>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company"
            className="bg-neutral-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Summary</label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief summary"
            rows={3}
            className="bg-neutral-900"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create proposal"}
        </Button>
      </form>
    </div>
  );
}
