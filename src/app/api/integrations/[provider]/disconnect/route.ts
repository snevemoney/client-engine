/**
 * POST /api/integrations/[provider]/disconnect — Disable / reset connection
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProviderDef, resolveProviderKey } from "@/lib/integrations/providerRegistry";
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
    const canonical = resolveProviderKey(provider);
    const providerDef = getProviderDef(provider);
    if (!providerDef) return jsonError("Unknown provider", 400);

    await db.integrationConnection.upsert({
      where: { provider: canonical },
      create: {
        provider: canonical,
        status: "not_connected",
        mode: "off",
        category: providerDef.category,
        prodOnly: providerDef.prodOnly,
        providerLabel: providerDef.displayName,
        displayName: providerDef.displayName,
        helpText: providerDef.helpText ?? undefined,
        sortOrder: providerDef.sortOrder,
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
