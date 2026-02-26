/**
 * GET /api/integrations/data?provider=<key> — Fetch live data from a connection.
 * Also: GET /api/integrations/data?statuses=1 — Get all connection statuses.
 *
 * Optional ?purpose=monitoring|analytics|crm|... — Filter statuses to providers
 * that serve the given purpose(s). Comma-separated for multiple.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { fetchConnectionData, getAllConnectionStatuses } from "@/lib/integrations/connection-data";
import type { IntegrationPurpose } from "@/lib/integrations/providerRegistry";

const VALID_PURPOSES: IntegrationPurpose[] = [
  "prospecting", "monitoring", "scheduling", "crm", "analytics",
  "content", "ops", "enrichment", "visibility", "research",
];

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withRouteTiming("GET /api/integrations/data", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");
    const statusesOnly = url.searchParams.get("statuses") === "1";
    const purposeParam = url.searchParams.get("purpose");

    let purposes: IntegrationPurpose[] | undefined;
    if (purposeParam) {
      purposes = purposeParam
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter((p): p is IntegrationPurpose => VALID_PURPOSES.includes(p as IntegrationPurpose));
    }

    if (statusesOnly) {
      const statuses = await getAllConnectionStatuses(
        purposes && purposes.length > 0 ? purposes : undefined,
      );
      return NextResponse.json({ statuses });
    }

    if (!provider) return jsonError("provider query param required", 400);

    const result = await fetchConnectionData(provider);
    return NextResponse.json(result);
  });
}
