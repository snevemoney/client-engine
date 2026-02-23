/**
 * POST /api/integrations/[provider]/disconnect — Disable / reset connection
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { INTEGRATION_PROVIDERS } from "@/lib/integrations/providers";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  return withRouteTiming("POST /api/integrations/[provider]/disconnect", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { provider } = await params;
    const validProvider = INTEGRATION_PROVIDERS.some((p) => p.key === provider);
    if (!validProvider) return jsonError("Unknown provider", 400);

    await db.integrationConnection.upsert({
      where: { provider },
      create: {
        provider,
        status: "not_connected",
        isEnabled: false,
        configJson: {},
      },
      update: {
        status: "not_connected",
        isEnabled: false,
        configJson: {},
        lastError: null,
      },
    });

    return NextResponse.json({ ok: true });
  });
}
