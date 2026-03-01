/**
 * Email channel — sends via Resend when RESEND_API_KEY is configured,
 * otherwise returns unsupported so the system doesn't queue deliveries.
 */

import type { ChannelAdapterResult, SendPayload } from "../types";

export async function sendEmail(
  payload: SendPayload,
  config: Record<string, unknown>
): Promise<ChannelAdapterResult> {
  const to = config.to as string | undefined;
  if (!to || typeof to !== "string") {
    return { ok: false, error: "Email recipient not configured" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set — email channel disabled" };
  }

  const from = process.env.SITE_FROM_EMAIL ?? "Client Engine <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `[${payload.severity}] ${payload.title}`,
        text: payload.message,
        html: `<p><strong>${payload.title}</strong></p><p>${payload.message}</p>${payload.actionUrl ? `<p><a href="${payload.actionUrl}">View</a></p>` : ""}`,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      return { ok: false, error: `Resend API ${res.status}: ${errText.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}
