/**
 * GET /api/reminders/summary — For Scoreboard / Command Center.
 */
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getStartOfDay } from "@/lib/followup/dates";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { swrCacheHeaders } from "@/lib/http/response";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/reminders/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("reminders/summary", async () => {
        const now = new Date();
      const weekStart = getWeekStart(now);
      const endOfWeek = new Date(weekStart);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      const startToday = getStartOfDay(now);
      const endToday = new Date(startToday);
      endToday.setHours(23, 59, 59, 999);

      const [open, all, doneThisWeek] = await Promise.all([
        db.opsReminder.count({ where: { status: { in: ["open", "snoozed"] } } }),
        db.opsReminder.findMany({
          where: { status: { in: ["open", "snoozed"] } },
          select: { dueAt: true, snoozedUntil: true, status: true, priority: true },
        }),
        db.opsReminder.count({
          where: {
            status: "done",
            completedAt: { gte: weekStart, lte: endOfWeek },
          },
        }),
      ]);

      let overdue = 0;
      let today = 0;
      let dueThisWeek = 0;
      let highPriority = 0;

      for (const r of all ?? []) {
        const effectiveDue = r.snoozedUntil ?? r.dueAt;
        const due = effectiveDue ? new Date(effectiveDue).getTime() : null;
        if (due != null && !Number.isNaN(due)) {
          if (due < startToday.getTime()) overdue++;
          else if (due >= startToday.getTime() && due <= endToday.getTime()) today++;
          else if (due <= endOfWeek.getTime()) dueThisWeek++;
        }
        if (r.priority === "high" || r.priority === "critical") highPriority++;
      }

      return {
        open: open ?? 0,
        overdue,
        today,
        highPriority,
        dueThisWeek: overdue + today + dueThisWeek,
        doneThisWeek: doneThisWeek ?? 0,
      };
      }, 15_000, swrCacheHeaders(15, 60));
    } catch (err) {
      console.error("[reminders/summary]", err);
      return jsonError("Failed to load summary", 500);
    }
  });
}
