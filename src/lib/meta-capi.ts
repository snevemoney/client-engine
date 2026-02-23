/**
 * Meta Conversions API (CAPI) - server-side event tracking.
 * Sends Lead events when website form submissions create leads.
 * Requires META_PIXEL_ID and META_CAPI_ACCESS_TOKEN in env.
 */

import { createHash } from "node:crypto";

function sha256hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type SendLeadEventOpts = {
  eventId: string;
  email: string;
  leadId: string;
  contentName?: string;
  clientIp?: string;
  clientUserAgent?: string;
  /** URL where the lead form was submitted (e.g. Referer). Enables Meta to attribute events to production domain. */
  eventSourceUrl?: string;
};

/**
 * Send a Lead event to Meta Conversions API.
 * Fires asynchronously; does not throw. Logs errors.
 */
export async function sendLeadEvent(opts: SendLeadEventOpts): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId?.trim() || !token?.trim()) return;

  try {
    const normalizedEmail = normalizeEmail(opts.email);
    const emHash = normalizedEmail ? sha256hex(normalizedEmail) : undefined;

    const userData: Record<string, string> = {};
    if (emHash) userData.em = emHash;
    if (opts.clientIp) userData.client_ip_address = opts.clientIp;
    if (opts.clientUserAgent) userData.client_user_agent = opts.clientUserAgent;

    const body = {
      data: [
        {
          event_name: "Lead",
          event_time: Math.floor(Date.now() / 1000),
          event_id: opts.eventId,
          event_source_url: opts.eventSourceUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://evenslouis.ca",
          action_source: "website",
          user_data: userData,
          custom_data: {
            content_name: opts.contentName ?? "Website inquiry",
            lead_id: opts.leadId,
          },
        },
      ],
      access_token: token,
    };

    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("[meta-capi] Lead event failed:", res.status, text);
    }
  } catch (e) {
    console.warn("[meta-capi] Lead event error:", e instanceof Error ? e.message : String(e));
  }
}
