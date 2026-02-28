"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

export default function NewDeliveryPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonThrow<{ id: string }>("/api/delivery-projects", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          clientName: clientName.trim() || null,
          company: company.trim() || null,
        }),
      });
      toast.success("Project created");
      router.push(`/dashboard/delivery/${data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <div>
        <Link href="/dashboard/delivery" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Delivery
        </Link>
        <h1 className="text-2xl font-semibold mt-2">New delivery project</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
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
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create project"}
        </Button>
      </form>
    </div>
  );
}
