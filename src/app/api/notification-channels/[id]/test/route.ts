/**
 * POST /api/notification-channels/[id]/test — Send test notification (rate-limited).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { db } from "@/lib/db";
import { getAdapterForChannelType } from "@/lib/notifications/channels";
import { sanitizeNotificationMeta } from "@/lib/notifications/sanitize";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/notification-channels/[id]/test", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(_request, session?.user?.id);
    const rl = rateLimitByKey({
      key: `rl:notification-channel-test:${clientKey}`,
      windowMs: 60_000,
      max: 5,
    });
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: true, message: "Rate limit exceeded", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { id } = await params;
    const channel = await db.notificationChannel.findUnique({ where: { id } });
    if (!channel) return jsonError("Channel not found", 404);
    if (!channel.isEnabled) return jsonError("Channel is disabled", 400);

    const payload = {
      eventKey: "test",
      title: "Test notification",
      message: "This is a test notification from the operator app.",
      severity: "info" as const,
      sourceType: "test",
      sourceId: null,
      actionUrl: null,
      meta: null,
      occurredAt: new Date().toISOString(),
    };

    const adapter = getAdapterForChannelType(channel.type);
    if (!adapter) {
      return jsonError(`No adapter for channel type: ${channel.type}`, 400);
    }

    const config = (channel.configJson as Record<string, unknown>) ?? {};
    const result = await adapter.send(payload, config);
    const now = new Date();

    if (result.ok) {
      await db.notificationChannel.update({
        where: { id },
        data: { lastTestedAt: now, lastSuccessAt: now, lastErrorAt: null, lastErrorMessage: null },
      });
      return NextResponse.json({ ok: true, providerMessageId: result.providerMessageId ?? null });
    }

    await db.notificationChannel.update({
      where: { id },
      data: {
        lastTestedAt: now,
        lastErrorAt: now,
        lastErrorMessage: result.error ?? "Unknown error",
      },
    });
    return NextResponse.json(
      { ok: false, error: result.error, response: result.response != null ? sanitizeNotificationMeta(result.response as Record<string, unknown>) : null },
      { status: 500 }
    );
  });
}
