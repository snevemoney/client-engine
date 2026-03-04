"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DecisionLead = {
  id: string;
  title: string;
  status: string;
  scoreVerdict: string | null;
  score: number | null;
  source: string;
  hasProposal: boolean;
  hasPositioning: boolean;
};

export function DecisionQueue({ pending }: { pending: DecisionLead[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});

  async function handleApprove(leadId: string) {
    setLoading(leadId);
    setError((e) => ({ ...e, [leadId]: "" }));
    try {
      const res = await fetch(`/api/leads/${leadId}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((e) => ({ ...e, [leadId]: data.error ?? "Failed to approve" }));
        return;
      }
      window.location.reload();
    } catch {
      setError((e) => ({ ...e, [leadId]: "Network error" }));
    } finally {
      setLoading(null);
    }
  }

  async function handleApproveAndBuild(leadId: string) {
    setLoading(leadId);
    setError((e) => ({ ...e, [leadId]: "" }));
    try {
      const approveRes = await fetch(`/api/leads/${leadId}/approve`, { method: "POST" });
      const approveData = await approveRes.json().catch(() => ({}));
      if (!approveRes.ok) {
        setError((e) => ({ ...e, [leadId]: approveData.error ?? "Failed to approve" }));
        setLoading(null);
        return;
      }
      const buildRes = await fetch(`/api/build/${leadId}`, { method: "POST" });
      const buildData = await buildRes.json().catch(() => ({}));
      if (!buildRes.ok) {
        setError((e) => ({
          ...e,
          [leadId]: buildData.error ?? "Approved but build failed",
        }));
        setLoading(null);
        return;
      }
      window.location.reload();
    } catch {
      setError((e) => ({ ...e, [leadId]: "Network error" }));
    } finally {
      setLoading(null);
    }
  }

  if (pending.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 p-8 text-center text-neutral-500">
        <p>No leads waiting for your decision.</p>
        <p className="text-sm mt-1">New leads will appear here after the pipeline runs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((lead) => {
        const badge =
          lead.scoreVerdict === "MAYBE" && !lead.hasProposal ? (
            <Badge variant="warning">Positioning only</Badge>
          ) : (
            <Badge variant="success">Proposal ready</Badge>
          );
        const canApprove = lead.hasProposal;
        const isLoading = loading === lead.id;
        const err = error[lead.id];

        return (
          <div
            key={lead.id}
            className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/dashboard/leads/${lead.id}`}
                  className="font-medium text-neutral-200 hover:text-white truncate"
                >
                  {lead.title}
                </Link>
                {badge}
                {lead.scoreVerdict && (
                  <Badge variant={lead.scoreVerdict === "ACCEPT" ? "success" : "warning"} className="text-[10px]">
                    {lead.scoreVerdict}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {lead.source} {lead.score != null && `· Score ${lead.score}`}
              </p>
              {err && <p className="text-sm text-red-400 mt-2">{err}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              {canApprove ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApprove(lead.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApproveAndBuild(lead.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve & Build"}
                  </Button>
                </>
              ) : (
                <Link
                  href={`/dashboard/leads/${lead.id}`}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                >
                  Review
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
