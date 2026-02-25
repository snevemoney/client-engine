/**
 * GET/PATCH /api/notification-channels/[id] — Get or update channel.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { NotificationSeverity } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/notification-channels/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const channel = await db.notificationChannel.findUnique({ where: { id } });
    if (!channel) return jsonError("Channel not found", 404);

    return NextResponse.json({
      id: channel.id,
      key: channel.key,
      title: channel.title,
      type: channel.type,
      isEnabled: channel.isEnabled,
      isDefault: channel.isDefault,
      severityMin: channel.severityMin,
      configJson: channel.configJson,
      lastTestedAt: channel.lastTestedAt?.toISOString() ?? null,
      lastSuccessAt: channel.lastSuccessAt?.toISOString() ?? null,
      lastErrorAt: channel.lastErrorAt?.toISOString() ?? null,
      lastErrorMessage: channel.lastErrorMessage ?? null,
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
    });
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/notification-channels/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const channel = await db.notificationChannel.findUnique({ where: { id } });
    if (!channel) return jsonError("Channel not found", 404);

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (body?.title !== undefined) updates.title = String(body.title).trim();
    if (body?.isEnabled !== undefined) updates.isEnabled = !!body.isEnabled;
    if (body?.isDefault !== undefined) updates.isDefault = !!body.isDefault;
    if (body?.severityMin !== undefined) {
      if (["info", "warning", "critical"].includes(body.severityMin)) {
        updates.severityMin = body.severityMin as NotificationSeverity;
      }
    }
    if (body?.configJson !== undefined) updates.configJson = body.configJson;
    if (body?.clearErrors === true) {
      updates.lastErrorAt = null;
      updates.lastErrorMessage = null;
    }

    const updated = await db.notificationChannel.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      id: updated.id,
      key: updated.key,
      title: updated.title,
      isEnabled: updated.isEnabled,
    });
  });
}
