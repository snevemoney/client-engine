/**
 * GET /api/automation-suggestions/summary — For dashboard cards.
 */
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/weekStart";
import { withSummaryCache } from "@/lib/http/cached-handler";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/automation-suggestions/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("automation-suggestions/summary", async () => {
      const now = new Date();
      const weekStart = getWeekStart(now);
      const endOfWeek = new Date(weekStart);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const [pending, highPriority, appliedThisWeek] = await Promise.all([
        db.automationSuggestion.count({ where: { status: "pending" } }),
        db.automationSuggestion.count({
          where: {
            status: "pending",
            priority: { in: ["high", "critical"] },
          },
        }),
        db.automationSuggestion.count({
          where: {
            status: "applied",
            resolvedAt: { gte: weekStart, lte: endOfWeek },
          },
        }),
      ]);

      return {
        pending: pending ?? 0,
        highPriority: highPriority ?? 0,
        appliedThisWeek: appliedThisWeek ?? 0,
      };
      }, 15_000);
    } catch (err) {
      console.error("[automation-suggestions/summary]", err);
      return jsonError("Failed to load summary", 500);
    }
  });
}
