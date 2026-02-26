/**
 * GET /api/integrations/data?provider=<key> — Fetch live data from a connection.
 * Also: GET /api/integrations/data?statuses=1 — Get all connection statuses.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { fetchConnectionData, getAllConnectionStatuses } from "@/lib/integrations/connection-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withRouteTiming("GET /api/integrations/data", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");
    const statusesOnly = url.searchParams.get("statuses") === "1";

    if (statusesOnly) {
      const statuses = await getAllConnectionStatuses();
      return NextResponse.json({ statuses });
    }

    if (!provider) return jsonError("provider query param required", 400);

    const result = await fetchConnectionData(provider);
    return NextResponse.json(result);
  });
}
