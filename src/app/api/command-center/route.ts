/**
 * GET /api/command-center — Aggregate data for operator daily view.
 */
import { auth } from "@/lib/auth";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { fetchCommandCenterData } from "@/lib/command-center/fetch-data";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/command-center", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    return withSummaryCache("command-center", fetchCommandCenterData, 15_000);
  });
}
