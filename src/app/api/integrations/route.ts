/**
 * GET /api/integrations — List all integration connections + provider definitions
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { INTEGRATION_PROVIDERS } from "@/lib/integrations/providers";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/integrations", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const connections = await db.integrationConnection.findMany({
      orderBy: { provider: "asc" },
    });

    const byProvider = Object.fromEntries(connections.map((c) => [c.provider, c]));

    const items = INTEGRATION_PROVIDERS.map((p) => {
      const c = byProvider[p.key];
      return {
        ...p,
        connection: c
          ? {
              id: c.id,
              status: c.status,
              accountLabel: c.accountLabel,
              isEnabled: c.isEnabled,
              lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
              lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
              lastError: c.lastError,
              configJson: c.configJson,
            }
          : null,
      };
    });

    return NextResponse.json({ items });
  });
}
