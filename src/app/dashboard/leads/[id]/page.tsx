"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";

interface Artifact {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
}

interface Lead {
  id: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  status: string;
  description: string | null;
  budget: string | null;
  timeline: string | null;
  platform: string | null;
  techStack: string[];
  contactName: string | null;
  contactEmail: string | null;
  score: number | null;
  scoreReason: string | null;
  tags: string[];
  createdAt: string;
  artifacts: Artifact[];
}

const STATUSES = ["NEW", "ENRICHED", "SCORED", "APPROVED", "REJECTED", "BUILDING", "SHIPPED"];

const statusColors: Record<string, "default" | "success" | "warning" | "destructive"> = {
  NEW: "default",
  ENRICHED: "default",
  SCORED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  BUILDING: "warning",
  SHIPPED: "success",
};

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setLead(data);
        setLoading(false);
      });
  }, [id]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLead((prev) => (prev ? { ...prev, ...updated } : prev));
    }
  }

  if (loading) {
    return <div className="text-neutral-500 py-12 text-center">Loading...</div>;
  }

  if (!lead) {
    return <div className="text-neutral-500 py-12 text-center">Lead not found.</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{lead.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={statusColors[lead.status]}>{lead.status}</Badge>
            <span className="text-sm text-neutral-500">via {lead.source}</span>
            {lead.sourceUrl && (
              <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard label="Budget" value={lead.budget} />
        <InfoCard label="Timeline" value={lead.timeline} />
        <InfoCard label="Platform" value={lead.platform} />
        <InfoCard label="Score" value={lead.score != null ? `${lead.score}/100` : null} />
        <InfoCard label="Contact" value={lead.contactName} />
        <InfoCard label="Email" value={lead.contactEmail} />
      </div>

      {lead.description && (
        <div className="border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-neutral-400 mb-2">Description</h3>
          <p className="text-sm text-neutral-200 whitespace-pre-wrap">{lead.description}</p>
        </div>
      )}

      {lead.scoreReason && (
        <div className="border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-neutral-400 mb-2">Score Reasoning</h3>
          <p className="text-sm text-neutral-200 whitespace-pre-wrap">{lead.scoreReason}</p>
        </div>
      )}

      <div className="border border-neutral-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Update Status</h3>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              variant={lead.status === s ? "default" : "outline"}
              size="sm"
              onClick={() => updateStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {lead.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {lead.tags.map((tag) => (
            <Badge key={tag} variant="outline">{tag}</Badge>
          ))}
        </div>
      )}

      <div className="border border-neutral-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-neutral-400 mb-3">Artifacts ({lead.artifacts.length})</h3>
        {lead.artifacts.length === 0 ? (
          <p className="text-sm text-neutral-500">No artifacts yet.</p>
        ) : (
          <div className="space-y-3">
            {lead.artifacts.map((a) => (
              <div key={a.id} className="border border-neutral-800/50 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                  <span className="text-sm font-medium">{a.title}</span>
                </div>
                <p className="text-sm text-neutral-400 whitespace-pre-wrap line-clamp-4">{a.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-3">
      <div className="text-xs text-neutral-500 mb-0.5">{label}</div>
      <div className="text-sm text-neutral-200">{value || "—"}</div>
    </div>
  );
}
