/**
 * PATCH /api/integrations/[provider] — Update connection config/status
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProviderDef, resolveProviderKey } from "@/lib/integrations/providerRegistry";
import { resolveRequestedMode } from "@/lib/integrations/runtime";
import { validateAdditionalQueryParams, mergeConfigWithQueryParams } from "@/lib/integrations/configValidators";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["not_connected", "connected", "error", "disabled"]).optional(),
  mode: z.enum(["off", "mock", "manual", "live"]).optional(),
  accountLabel: z.string().max(200).optional().nullable(),
  configJson: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  return withRouteTiming("PATCH /api/integrations/[provider]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { provider } = await params;
    const canonical = resolveProviderKey(provider);
    const providerDef = getProviderDef(provider);
    if (!providerDef) return jsonError("Unknown provider", 400);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate additionalQueryParams if present in configJson
    let configJson = data.configJson;
    if (configJson && typeof configJson === "object" && "additionalQueryParams" in configJson) {
      const v = validateAdditionalQueryParams(
        (configJson as Record<string, unknown>).additionalQueryParams
      );
      if (!v.ok) return jsonError(v.error, 400);
      configJson = mergeConfigWithQueryParams(
        configJson as Record<string, unknown>,
        Object.keys(v.params).length > 0 ? v.params : null
      ) as Record<string, unknown>;
    }

    // Resolve mode against capabilities + prodOnly
    let resolvedMode: "off" | "mock" | "manual" | "live" | undefined;
    if (data.mode !== undefined) {
      const result = resolveRequestedMode({
        provider: canonical,
        requestedMode: data.mode,
        prodOnly: providerDef.prodOnly,
        supportsLive: providerDef.supportsLive,
        supportsMock: providerDef.supportsMock,
        supportsManual: providerDef.supportsManual,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.message, resolvedMode: result.mode },
          { status: 400 }
        );
      }
      resolvedMode = result.mode;
    }

    const update: Record<string, unknown> = {};
    if (data.status !== undefined) update.status = data.status;
    if (resolvedMode !== undefined) update.mode = resolvedMode;
    if (data.accountLabel !== undefined) update.accountLabel = data.accountLabel;
    if (configJson !== undefined) update.configJson = configJson;
    if (data.isEnabled !== undefined) update.isEnabled = data.isEnabled;

    const conn = await db.integrationConnection.upsert({
      where: { provider: canonical },
      create: {
        provider: canonical,
        mode: (resolvedMode ?? data.mode ?? providerDef.defaultMode) as "off" | "mock" | "manual" | "live",
        category: providerDef.category,
        prodOnly: providerDef.prodOnly,
        providerLabel: providerDef.displayName,
        displayName: providerDef.displayName,
        helpText: providerDef.helpText ?? undefined,
        sortOrder: providerDef.sortOrder,
        ...(update as Record<string, unknown>),
      },
      update,
    });

    return NextResponse.json(conn);
  });
}
