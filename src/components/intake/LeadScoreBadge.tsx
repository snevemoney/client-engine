"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function LeadScoreBadge({ score }: { score?: number | null }) {
  if (score == null || typeof score !== "number") {
    return <span className="text-neutral-500 text-sm">—</span>;
  }
  const variant =
    score >= 70 ? "success" : score >= 50 ? "warning" : score >= 30 ? "default" : "destructive";
  return <Badge variant={variant}>{score}</Badge>;
}
