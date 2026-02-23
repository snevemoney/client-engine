/**
 * Build Ops summary for Command Center card: counts by status/type for Cloud Agent queue.
 */

import { db } from "@/lib/db";

export type BuildOpsSummary = {
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  total: number;
  byType: Record<string, number>;
};

export async function getBuildOpsSummary(): Promise<BuildOpsSummary> {
  const [tasks, byTypeRows] = await Promise.all([
    db.buildTask.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    db.buildTask.groupBy({
      by: ["type"],
      _count: { id: true },
    }),
  ]);

  const statusCounts = { todo: 0, in_progress: 0, review: 0, done: 0 };
  for (const row of tasks) {
    const k = row.status as keyof typeof statusCounts;
    if (k in statusCounts) statusCounts[k] = row._count.id;
  }

  const byType: Record<string, number> = {};
  for (const row of byTypeRows) {
    byType[row.type] = row._count.id;
  }

  const total = tasks.reduce((s, r) => s + r._count.id, 0);

  return {
    todo: statusCounts.todo,
    inProgress: statusCounts.in_progress,
    review: statusCounts.review,
    done: statusCounts.done,
    total,
    byType,
  };
}
