/**
 * GET/POST /api/notification-channels — List or create channels.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { NotificationChannelType } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["in_app", "webhook", "email", "discord_webhook"];

export async function GET() {
  return withRouteTiming("GET /api/notification-channels", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const channels = await db.notificationChannel.findMany({
      orderBy: { key: "asc" },
    });

    return NextResponse.json({
      items: channels.map((ch) => ({
        id: ch.id,
        key: ch.key,
        title: ch.title,
        type: ch.type,
        isEnabled: ch.isEnabled,
        isDefault: ch.isDefault,
        severityMin: ch.severityMin,
        lastTestedAt: ch.lastTestedAt?.toISOString() ?? null,
        lastSuccessAt: ch.lastSuccessAt?.toISOString() ?? null,
        lastErrorAt: ch.lastErrorAt?.toISOString() ?? null,
        lastErrorMessage: ch.lastErrorMessage ?? null,
        createdAt: ch.createdAt.toISOString(),
        updatedAt: ch.updatedAt.toISOString(),
      })),
    });
  });
}

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/notification-channels", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));
    const key = body?.key?.trim();
    const title = body?.title?.trim();
    const type = body?.type;

    if (!key || !title || !type) {
      return jsonError("Missing required: key, title, type", 400);
    }
    if (!VALID_TYPES.includes(type)) {
      return jsonError("Invalid type. Must be: in_app, webhook, email, discord_webhook", 400);
    }

    const existing = await db.notificationChannel.findUnique({ where: { key } });
    if (existing) return jsonError("Channel key already exists", 409);

    const channel = await db.notificationChannel.create({
      data: {
        key,
        title,
        type: type as NotificationChannelType,
        isEnabled: body?.isEnabled ?? true,
        isDefault: body?.isDefault ?? false,
        severityMin: body?.severityMin ?? undefined,
        configJson: body?.configJson ?? undefined,
      },
    });

    return NextResponse.json({
      id: channel.id,
      key: channel.key,
      title: channel.title,
      type: channel.type,
      isEnabled: channel.isEnabled,
    });
  });
}
