/**
 * PATCH /api/integrations/[provider] — Update connection config/status
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { INTEGRATION_PROVIDERS } from "@/lib/integrations/providers";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["not_connected", "connected", "error", "disabled"]).optional(),
  accountLabel: z.string().max(200).optional().nullable(),
  configJson: z.record(z.unknown()).optional(),
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
    const validProvider = INTEGRATION_PROVIDERS.some((p) => p.key === provider);
    if (!validProvider) return jsonError("Unknown provider", 400);

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
    const update: Record<string, unknown> = {};
    if (data.status !== undefined) update.status = data.status;
    if (data.accountLabel !== undefined) update.accountLabel = data.accountLabel;
    if (data.configJson !== undefined) update.configJson = data.configJson;
    if (data.isEnabled !== undefined) update.isEnabled = data.isEnabled;

    const conn = await db.integrationConnection.upsert({
      where: { provider },
      create: {
        provider,
        ...(update as Record<string, unknown>),
      },
      update,
    });

    return NextResponse.json(conn);
  });
}
