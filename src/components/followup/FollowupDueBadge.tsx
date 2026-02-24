"use client";

import { Badge } from "@/components/ui/badge";

export type DueBucket = "overdue" | "today" | "upcoming";

export function FollowupDueBadge({ bucket }: { bucket: DueBucket }) {
  const variant =
    bucket === "overdue"
      ? "destructive"
      : bucket === "today"
        ? "warning"
        : "outline";
  const label =
    bucket === "overdue"
      ? "Overdue"
      : bucket === "today"
        ? "Today"
        : "Upcoming";

  return <Badge variant={variant}>{label}</Badge>;
}
