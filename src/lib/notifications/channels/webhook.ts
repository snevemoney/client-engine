/**
 * Phase 2.8.6: Webhook channel — POST JSON to configured URL with timeout.
 */

import type { ChannelAdapterResult, SendPayload } from "../types";
import { sanitizeNotificationMeta } from "../sanitize";

const DEFAULT_TIMEOUT_MS = 10_000;

export async function sendWebhook(
  payload: SendPayload,
  config: Record<string, unknown>
): Promise<ChannelAdapterResult> {
  const url = config.url as string | undefined;
  if (!url || typeof url !== "string") {
    return { ok: false, error: "Webhook URL not configured" };
  }

  const body = {
    eventKey: payload.eventKey,
    title: payload.title,
    message: payload.message,
    severity: payload.severity,
    sourceType: payload.sourceType ?? null,
    sourceId: payload.sourceId ?? null,
    actionUrl: payload.actionUrl ?? null,
    meta: sanitizeNotificationMeta(payload.meta ?? {}),
    occurredAt: payload.occurredAt,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(typeof config.headers === "object" && config.headers !== null
        ? Object.fromEntries(
            Object.entries(config.headers as Record<string, unknown>).map(([k, v]) => [
              k,
              String(v ?? ""),
            ])
          )
        : {}),
    };
    // Redact Authorization if present in config
    if (headers.authorization || headers.Authorization) {
      headers.authorization = "[redacted]";
      headers.Authorization = "[redacted]";
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const text = await res.text();
    let responsePayload: unknown = text;
    try {
      responsePayload = JSON.parse(text);
    } catch {
      // keep as string
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        response: sanitizeNotificationMeta(responsePayload as Record<string, unknown>),
      };
    }

    return {
      ok: true,
      providerMessageId: res.headers.get("x-request-id") ?? undefined,
      response: sanitizeNotificationMeta(responsePayload as Record<string, unknown>),
    };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
