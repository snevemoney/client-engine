"use client";

import { Badge } from "@/components/ui/badge";

const sourceLabel: Record<string, string> = {
  upwork: "Upwork",
  linkedin: "LinkedIn",
  referral: "Referral",
  inbound: "Inbound",
  rss: "RSS",
  other: "Other",
};

export function LeadSourceBadge({ source }: { source?: string | null }) {
  const s = source && typeof source === "string" ? source.toLowerCase() : "other";
  const label = sourceLabel[s] ?? s;
  return <Badge variant="outline">{label}</Badge>;
}
