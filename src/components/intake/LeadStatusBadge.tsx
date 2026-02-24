"use client";

import { Badge } from "@/components/ui/badge";

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive"> = {
  new: "default",
  qualified: "success",
  proposal_drafted: "warning",
  sent: "warning",
  won: "success",
  lost: "destructive",
  archived: "default",
};

const statusLabel: Record<string, string> = {
  new: "New",
  qualified: "Qualified",
  proposal_drafted: "Draft",
  sent: "Sent",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

export function LeadStatusBadge({ status }: { status?: string | null }) {
  const s = status && typeof status === "string" ? status.toLowerCase() : "new";
  const label = statusLabel[s] ?? s;
  const variant = statusVariant[s] ?? "default";
  return <Badge variant={variant}>{label}</Badge>;
}
